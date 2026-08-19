# WS 推送「按订阅」改造方案

> **状态：✅ 已实施并验证（2026-08-19）** — 鉴权中间件 + 房间定向两类验证均 PASS，临时钩子/脚本已清理。
> 目标：把当前「无鉴权 + 全端广播」的 WS 推送，改成「JWT 鉴权 + 按订阅（room）」推送。
> 关联：HANDOFF.md 中 P1「WS 广播安全」。本方案与已完成的状态机执行器统一（OrdersService.transition 公开化）可平滑衔接。

---

## 0. 问题定性（两处根因，均有代码证据）

当前链路：`4 个触发动作 → 2 个事件 → 3 个前端消费页`，但每个 emit 都是 `server.emit` 全端群发，且连接零校验。

| 根因 | 现状代码 | 后果 |
|---|---|---|
| **无鉴权** | 前端 `useOrderSocket` 裸连 `io(base, {path:'/ws'})`（无 token / auth / withCredentials）；后端 `handleConnection()` 仅打日志，无校验 | 任何人连上 `/ws` 都能收全平台订单流 |
| **全端广播** | `broadcastOrderUpdate` / `broadcastNewOrder` 都用 `this.server.emit(...)`（`orders.gateway.ts:25-32`） | 任意订单变更推给**所有在线连接**，含客户手机号/地址/姓名/验收码 |

- 后端鉴权体系是标准 **JWT Bearer**：`jwt.strategy.ts:13` 用 `ExtractJwt.fromAuthHeaderAsBearerToken()`，payload 含 `sub`(userId)、`role`、`jti` 等。
- 前端 token 存储：`lib/auth.ts` 按角色分槽位存 localStorage，`getToken()`（`auth.ts:76-80`）**按当前路由角色**（`roleFromPath()` 看 `/master` `/client` `/admin`）取 token —— 三端通用 hook 直接用 `getToken()` 即可，不存在带错身份的问题。

---

## 1. 目标

1. **连接鉴权**：WS 握手必须带合法 JWT；无 token / 过期 / 已拉黑 → 拒绝握手。
2. **按订阅推送**：
   - 订单详情页**只收自己看的那个单**的变更；
   - 接单池**只收新订单与「离开接单态」的变更**，不再把任意订单推给全平台。

---

## 2. Room 设计

| Room | 成员 | 谁加入 | 推送内容 |
|---|---|---|---|
| `order:<id>` | 打开该订单详情的人（客户 / 师傅 / 管理员） | 前端进入详情 → `emit('subscribe-order', id)` | 该订单的 `order-update` |
| `pool` | 在线接单态**师傅** | 前端进接单池 → `emit('join-pool')`，后端校验 `role==='master'` 才 `join` | `new-order` + 离开接单态的 `order-update` |
| `role:admin`（可选，本期不强制） | 管理员 | admin 连接后 `join` | 平台级事件（预留） |

**为何选「前端主动订阅 order room」而非「后端按订单归属自动 join」**：
契合现有"打开详情才需要实时"的用法；后端保持无状态、零额外 DB 查询；房间成员天然只含相关方（客户打开自己的单、师傅打开派给自己的单），比按 role 细分更精准。

---

## 3. 后端改造

### 3.1 `GatewayModule` 依赖（`gateway.module.ts`）
- 注入 `ConfigService`（取 `JWT_ACCESS_SECRET`）。`ConfigModule` 已是全局 `forRoot({isGlobal:true})`，故 `ConfigService` 随处可注入。
- `import { isBlacklisted } from '../auth/token-blacklist'`（纯函数，无 Nest 依赖）。
- **实际落地**：用 `JwtService`（`@nestjs/jwt`）而非裸 `jsonwebtoken`。原因：pnpm 严格依赖隔离下，`jsonwebtoken` 只是 `@nestjs/jwt` 的传递依赖，业务代码无法直接 `import`（`tsc` 报 `Cannot find module 'jsonwebtoken'`）。`JwtModule.registerAsync` 读 `JWT_ACCESS_SECRET` 注入 `JwtService`，复用同一 secret，零新增依赖、无需联网安装。

### 3.2 鉴权中间件（`orders.gateway.ts` 加 `afterInit`）
```ts
import { verify } from 'jsonwebtoken';

afterInit(server: any) {
  server.use((socket: any, next: (err?: Error) => void) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));
    try {
      const payload = verify(token, this.config.get('JWT_ACCESS_SECRET')) as any;
      if (isBlacklisted(payload.jti)) return next(new Error('unauthorized'));
      socket.data.user = { sub: payload.sub, role: payload.role };
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });
}
```
> 未授权连接：socket.io 在握手阶段断开，前端 `connect_error` 收到 `Error: unauthorized`。

### 3.3 订阅事件（`@SubscribeMessage`）
```ts
@SubscribeMessage('subscribe-order')
handleSub(@ConnectedSocket() socket, @MessageBody() orderId: string) {
  socket.join('order:' + orderId);
}
@SubscribeMessage('unsubscribe-order')
handleUnsub(@ConnectedSocket() socket, @MessageBody() orderId: string) {
  socket.leave('order:' + orderId);
}
@SubscribeMessage('join-pool')
handleJoinPool(@ConnectedSocket() socket) {
  if (socket.data.user?.role === 'master') socket.join('pool'); // 仅师傅可入接单池
}
@SubscribeMessage('leave-pool')
handleLeavePool(@ConnectedSocket() socket) {
  socket.leave('pool');
}
```

### 3.4 广播路由（替换原 `server.emit`）
```ts
broadcastNewOrder(order)   { this.server?.to('pool').emit('new-order', order); }
broadcastOrderUpdate(order) { this.server?.to('order:' + order.id).emit('order-update', order); }
broadcastPoolUpdate(order)  { this.server?.to('pool').emit('order-update', order); } // 新增
```
**pool 补推**（解决接单后池子刷新）：在 `OrdersService.transition()` 内，状态变更后增加：
```ts
// fromStatus 为变更前状态（order.status）
if (fromStatus === OrderStatus.PendingAccept && to !== OrderStatus.PendingAccept) {
  this.gateway?.broadcastPoolUpdate(updated);
}
```
语义：订单被接走（离开 `pending_accept`）→ 推给接单池，让其他师傅的池子移除该单。`OrdersService` 本就持有 `OrdersGateway`（transition 内已用），无需新增依赖。

---

## 4. 前端改造

### 4.1 `lib/useOrderSocket.ts`
```ts
export function useOrderSocket(
  handlers: OrderSocketHandlers,
  options?: { orderId?: string; pool?: boolean },
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const optsRef = useRef(options);
  optsRef.current = options;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const base = process.env.NEXT_PUBLIC_API_BASE
      ? process.env.NEXT_PUBLIC_API_BASE.replace(/\/api$/, '')
      : `http://${window.location.hostname}:3721`;

    const socket: Socket = io(base, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      auth: { token: getToken() ?? undefined }, // ← 带当前角色 JWT
    });

    socket.on('new-order', (o) => handlersRef.current.onNewOrder?.(o));
    socket.on('order-update', (o) => handlersRef.current.onOrderUpdate?.(o));
    socket.on('connect_error', (err) => {
      if (err.message === 'unauthorized') {
        // 提示重新登录 / 触发 refresh 后重连（见风险②）
        console.warn('WS 鉴权失败，请重新登录');
      }
    });

    // 进入即订阅
    if (optsRef.current?.orderId) socket.emit('subscribe-order', optsRef.current.orderId);
    if (optsRef.current?.pool) socket.emit('join-pool');

    return () => {
      if (optsRef.current?.orderId) socket.emit('unsubscribe-order', optsRef.current.orderId);
      if (optsRef.current?.pool) socket.emit('leave-pool');
      socket.disconnect();
    };
  }, []);
}
```

### 4.2 三个消费页接入
- `master/orders/[id]/page.tsx:81` → `useOrderSocket({ onOrderUpdate }, { orderId: id })`（`if (o?.id === id) refresh()` 保留冗余无害）
- `client/orders/[id]/page.tsx:71` → 同上
- `master/orders/pool/page.tsx:39` → `useOrderSocket({ onNewOrder, onOrderUpdate }, { pool: true })`

---

## 5. 验证方案（实际执行记录）

> 实际验证用 **3723**（个人调试端口）。注：原计划写 3722，但环境里残留一个 3722 孤儿进程（PID 10804，沙箱非管理员杀不掉），故改用 3723，避开冲突、不动用户恒定端口 3721/3824。

1. `npx tsc --noEmit`（nest）→ **EXIT 0**；前端 tsc 亦 0。
2. `PORT=3723 npx nest start` → boot 成功，`GatewayModule dependencies initialized`，4 个 subscribe 消息注册到位，无循环依赖告警，`backend listening on http://localhost:3723`。
3. **鉴权中间件验证**（临时脚本 `ws-verify.cjs`，已删）：
   - 无 token 连接 → `connect_error: unauthorized` ✅
   - 假 token `not.a.real.jwt` 连接 → `connect_error: unauthorized` ✅
   - 结论：**PASS — 鉴权中间件生效，裸连不可达**。
4. **房间隔离验证**（临时脚本 `ws-isolate.cjs`，已删；触发用临时 `__debug_emit` 钩子，验证后**已移除**）：
   - 造 master / customer 两种合法 JWT（dev secret 手写 HS256），三客户端分别订阅 `order:A`、`order:B`、`pool`。
   - T1 池广播 `new-order` → 仅 master 收到，两 customer 未收到 ✅
   - T2 订单A 更新 → 仅订阅 A 的 customer 收到，另一 customer / master 未收到 ✅
   - T3 customer `emit('join-pool')` 被后端 `role==='master'` 拦截 → 收不到池消息 ✅
   - 结论：**PASS — 房间定向正确，全局广播已消除**。
5. **清理**：验证后 `Stop-Process -Force` 杀 3723 进程，netstat 确认 `LISTEN` 与 `TIME_WAIT` 均释放；临时脚本与调试钩子全部删除，仓库仅留正式代码。

---

## 6. 风险与注意

1. **全局单例**：`OrdersGateway` 是全局唯一，middleware/broadcast 改动影响所有 WS 连接，需全量回归。
2. **token 过期重连**：socket.io v4 重连时不会自动带新 `auth`。若 `connect_error='unauthorized'` 且本地有 refreshToken，应 `refresh → 更新 socket.io.auth → reconnect`；否则提示重新登录。本期先做"提示重新登录"，精细化自动刷新可单列。
3. **前后端同步部署**：旧前端不带 `auth` 会被握手拒绝，上线需前后端同批发布。
4. **admin 端**：本期不订阅具体内容（保持现状无监听），但连接受鉴权保护（防裸连）。
5. **room 名大小写敏感**：统一 `order:` / `pool` 前缀，避免拼写不一致。

---

## 7. 分步实施（对应任务）

| 步 | 内容 | 文件 |
|---|---|---|
| ① | gateway JWT 鉴权中间件 + Module 依赖 | `orders.gateway.ts` / `gateway.module.ts` |
| ② | room 订阅事件 + broadcast 路由 + pool 补推 | `orders.gateway.ts` / `orders.service.ts` |
| ③ | 前端 `useOrderSocket` 改造 | `lib/useOrderSocket.ts` |
| ④ | 三个消费页接入订阅 | `master/orders/[id]` / `client/orders/[id]` / `master/orders/pool` |
| ⑤ | 起 3722 多角色验证 | 验证脚本 + boot |

---

## 8. 不在本期范围（同源待办，可单列）

- **admin 订单列表实时订阅**：增强项，给管理员订单管理页接入 `order:<id>` 订阅。
- **订单内 IM 聊天**：独立 WS 通道（HANDOFF P1），需单独设计消息 room 与持久化。
- **真实支付联调 / 阶梯退款真实渠道**：HANDOFF P3。
- **同源 `payments.applyPaid` 绕过 transition**：支付成功入池那条路径也绕过了状态机执行器，P2，与本次"按订阅"正交，可另排。
