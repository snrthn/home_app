# 管理端角色权限设计文档（RBAC）

> 状态：**已实施并上线（2026-08 全量落地）**  ·  版本：v1.1  ·  设计定稿：2026-08-11
> 适用范围：仅管理端（运营端 `/admin`）。用户端 / 师傅端不在本设计内。
>
> **实施情况**（2026-08-21 核对）：四实体（StaffRole/Permission/StaffRolePermission + User.staffRoleId）已入库；`PermissionGuard` + `@RequirePerm` 真相源校验已挂高风险接口；JWT 已扩容 `staffRole` + `perms`；7 个预设岗位角色已 seed；前端 `admin-menu.ts` perm 过滤 + `usePerm` 已接；角色权限管理页 `/admin/settings/roles` 已建；后台账号编辑表单含「所属岗位角色」下拉。2026-08-21 起新增 `complaints:handle` / `tickets:manage` 权限码已随 `nest/prisma/seed.js` 入库并绑定 `cs_agent` / `ops_lead`（详见 `complaints-tickets-design.md`）。

---

## 0. 设计目标

把「**谁能干什么**」从硬编码里抽出来，变成可运行时配置的能力，同时保证：

1. **用户 → 角色 → 权限 → 功能** 四层绑定，全链路可解释、可审计。
2. 权限是**真相源**：既驱动前端菜单/按钮显隐（体验），也驱动后端接口守卫（安全）。
3. 粒度适中：用 `resource:action` 抽象权，不按页面、也不按每个按钮。
4. 现有 `Role` 枚举（admin/master/customer）不被污染，另行建立管理端内部岗位角色。

---

## 1. 两条角色边界（最重要，先锁死）

当前系统只有一套"角色"——`Role` 枚举的 `admin/master/customer`，它是**账号类型 / 入口角色**：决定你进哪个端、被 `@Roles()` 守卫拦截。

管理端「角色权限」想管的是**另一套**：管理端内部的**岗位角色**（运营、客服、财务…），只在 admin 端内部生效。

二者必须分离，否则未来会乱：

| 层 | 名称 | 取值 | 存哪 | 作用 |
|---|---|---|---|---|
| ① 账号类型（已有） | `Role` | `admin` / `master` / `customer` | 现有 `User.role` + JWT | 决定进哪个端；`@Roles(Role.Admin)` 作入口闸门 |
| ②a 内部岗位角色（待建） | `StaffRole` | `super_admin` / `运营主管` / `客服专员` / … | 新建 `StaffRole` 表 + `User.staffRoleId` | 决定 admin 端内**能干什么** |

> 结论：把岗位角色塞进现有 `Role` 枚举 = 错误。新增独立的 `StaffRole` 实体。

---

## 2. 四实体 + 三个绑定

```
User(后台账号, role=admin)
   │  绑定 1 个 StaffRole
   ▼
StaffRole(岗位角色)
   │  绑定 N 个 Permission
   ▼
Permission(resource:action，如 orders:refund)
   │  绑定 N 个 Function
   ▼
Function(功能点：菜单项 / 按钮 / 接口)  —— 代码注册表，非 DB
```

| 层 | 实体 | 绑定方式 | 落地 |
|---|---|---|---|
| 用户→角色 | `User.staffRoleId` | 单角色（初期）；预留 `user_staff_roles` 多对多 | DB |
| 角色→权限 | `StaffRolePermission(roleId, permissionId)` | 中间表 | DB |
| 权限→功能 | `FUNCTION_POINTS` 注册表里每个功能点声明 `perm` | 反查即可，不单独建表 | 代码 |

**「功能」是什么**：具体功能点 = 一个菜单路由 / 一个操作按钮 / 一个 API 接口。它是权限的落地执行点。
**「权限」是什么**：抽象权（如 `orders:refund` = "能退款"）。一个权限可绑多个功能点——
例如 `orders:refund` 同时绑住：订单详情页「退款」按钮、退款确认弹窗、`POST /orders/:id/refund` 接口。

> 好处：前端隐藏按钮、后端拦截接口，用**同一个 perm 码**，源头唯一，不会两边对不上。

---

## 3. 关键工程决策

1. **功能层用代码注册表（`FUNCTION_POINTS`），不放 DB。**
   功能点（菜单/按钮/接口）是构建期确定的，做成可增删的 DB 表是过度工程；权限定义**必须放 DB**，才能运行时改角色不碰代码。
   `权限→功能` 映射从注册表按 `perm` 反查即得，管理页展示"该权限控制了哪些功能"现算即可。

2. **权限同时驱动两层**：
   - 前端：菜单/按钮按用户权限集过滤（仅 UX，可被绕过）。
   - 后端：`@RequirePerm()` 守卫做**真相源**校验（不可绕过）。
   - 菜单隐藏 ≠ 有权限。缺 API 层校验 = 没权限。

3. **初期单角色 / 单用户**：一个后台账号绑一个岗位角色，不上来就做用户-多角色多对多，除非有硬需求。

4. **`super_admin` 为系统角色**：不可删、不可改权限、默认全权，保证永不锁死。

5. **迁移兼容**：现有 `role=admin` 的账号自动映射为 `super_admin`，否则老账号丢权限。

---

## 4. 完整权限码表（对齐当前 8 模块菜单）

> 菜单路径来自 `next/src/lib/admin-menu.ts`（2026-08-11 现状）。`perm` 为空 = 对所有人可见（如工作台、个人中心）。

| 菜单 | 路径 | 权限码 | 说明 |
|---|---|---|---|
| 工作台 | `/admin` | —（始终可见） | 首页仪表盘 |
| **用户管理** | | | |
| 后台账号 | `/admin/users/admins` | `users:admin_read` / `users:admin_manage` | 查看 / 新增·编辑·启停 |
| 客户管理 | `/admin/users/customers` | `users:customer_read` / `users:customer_toggle` | 查看 / 启停 |
| 师傅管理 | `/admin/users/masters` | `users:master_read` / `users:master_toggle` / `users:master_verify` | 查看 / 启停 / 审核 |
| 认证审核 | `/admin/users/verifications` | `users:verify` | 实名认证审核 |
| **服务与类目** | | | |
| 服务类目 | `/admin/services/categories` | `services:category_manage` | |
| 服务项目 | `/admin/services/items` | `services:item_manage` | |
| 服务区域 | `/admin/services/areas` | `services:area_manage` | |
| **调度派单** | | | |
| 智能派单 | `/admin/dispatch/smart` | `dispatch:smart` | 推荐师傅 + 一键指派 |
| **订单管理** | | | |
| 全部/待接单/进行中 | `/admin/orders/*` | `orders:read` / `orders:edit` | 查看 / 状态变更 |
| 退款/售后 | `/admin/orders/refund` | `orders:refund` | **高风险，单独授权** |
| **评价客服** | | | |
| 用户评价 | `/admin/reviews/ratings` | `reviews:read` / `reviews:moderate` | 查看 / 处置 |
| 投诉处理 | `/admin/reviews/complaints` | `complaints:handle` | |
| 工单管理 | `/admin/reviews/tickets` | `tickets:manage` | |
| **内容管理** | | | |
| 协议/公告/帮助 | `/admin/content/*` | `content:manage` | 统一内容管理权 |
| **数据报表** | | | |
| 经营/绩效/增长 | `/admin/reports/*` | `reports:view` | 仅查看 |
| **系统设置** | | | |
| 个人中心 | `/admin/me` | —（本人可见） | 改自己资料/密码 |
| 角色权限 | `/admin/settings/roles` | `settings:role_manage` | **仅 super_admin** |
| 操作日志 | `/admin/settings/logs` | `logs:view` | |

---

## 5. 预设 7 个岗位角色（开箱即用）

| 角色 | key | 权限范围 |
|---|---|---|
| 超级管理员 | `super_admin`（系统） | 全部权限，不可删/不可改 |
| 运营主管 | `ops_lead` | 用户读、服务、调度、订单读/改、内容、报表 |
| 客服专员 | `cs_agent` | 用户读、评价处置、工单、投诉、订单退款、订单读 |
| 财务 | `finance` | 订单读、报表、结算相关 |
| 审核员 | `auditor` | 认证审核、评价处置 |
| 内容编辑 | `editor` | 内容管理 |
| 调度员 | `dispatcher` | 智能派单 |

> 不让每个客户从零配——预设 7 个覆盖典型岗位，空白角色也允许自建。

---

## 6. 数据模型（Prisma 草图）

```prisma
model StaffRole {
  id          String   @id @default(cuid())
  key         String   @unique          // 'super_admin' / 'ops_lead' ...
  name        String                  // 中文显示名
  description String?
  isSystem    Boolean  @default(false) // 系统角色不可删
  permissions StaffRolePermission[]
  users       User[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Permission {
  id          String   @id @default(cuid())
  code        String   @unique          // 'orders:refund'
  name        String                  // '订单退款'
  resource    String                  // 'orders'
  action      String                  // 'refund'
  group       String                  // 分组（用于管理页展示）
  description String?
  roles       StaffRolePermission[]
  createdAt   DateTime @default(now())
}

model StaffRolePermission {
  roleId       String
  permissionId String
  role         StaffRole @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  @@id([roleId, permissionId])
}

// User 增加（仅 role=admin 有意义）：
model User {
  // ... 现有字段
  staffRoleId String?            // 单角色；预留 user_staff_roles 多对多
  staffRole   StaffRole? @relation(fields: [staffRoleId], references: [id])
}
```

**功能点注册表（代码，非 DB）** `next/src/lib/function-points.ts`：

```ts
export interface FunctionPoint {
  code: string;        // 功能点唯一 id，如 'btn:orders:refund'
  label: string;       // '退款按钮'
  perm: string;        // 所需权限码 'orders:refund'
  type: 'menu' | 'button' | 'api';
  path?: string;       // 菜单/接口路径
}
export const FUNCTION_POINTS: FunctionPoint[] = [ /* 全量登记 */ ];
```

---

## 7. 后端改造点

- 保留 `@Roles(Role.Admin)` 作入口闸门（不变）。
- 新增 `@RequirePerm('orders:refund')` 装饰器 + `PermissionGuard`：
  从请求里读该用户的权限集，**默认拒绝**（白名单思维）。
- JWT 扩容：`JwtPayload` 增补 `staffRole` + `perms: string[]`；DB 为真相源，改角色时刷新 token。
- 新增 `rbac` 模块接口：
  - `GET /rbac/permissions` — 列出全量权限码（按 group 分组，供角色编辑页勾选）
  - `GET/POST/PUT/DELETE /rbac/roles` — 角色 CRUD
  - `PUT /rbac/roles/:id/permissions` — 设置某角色权限集
  - `GET /rbac/roles/:id/functions` — 反查该角色权限覆盖的功能点（用 `FUNCTION_POINTS` 现算）
- 复用现有 `PATCH /users/admins/:id`：扩展 `staffRoleId` 字段，让后台账号编辑时挂角色。

---

## 8. 前端改造点

- `ADMIN_MENU` 节点增加可选 `perm?: string` 字段；侧边栏按当前用户权限集过滤（无 `perm` 的节点对所有人可见）。
- `useCurrentUser` 补充暴露 `perms: string[]`（来自 JWT / profile）。
- 按钮级：封装 `Permitted` 组件或 `usePerm('orders:refund')` hook，无权限时不渲染或禁用。
- 新增**角色权限管理页** `/admin/settings/roles`：列出角色、勾选权限码、查看覆盖功能点。
- **后台账号编辑表单**同步增加「所属岗位角色」下拉（咬合用户→角色绑定）。

---

## 9. 与既有模块的咬合关系

| 既有能力 | 本设计如何衔接 |
|---|---|
| 后台账号（已落地：新增/编辑/启停） | 编辑表单加「所属岗位角色」→ 完成用户绑定角色 |
| `@Roles()` 守卫 | 保留作入口闸门，新增 `@RequirePerm()` 作内部校验 |
| `Role` 枚举 | 仅作账号类型，不混入岗位角色 |
| 菜单 directory/route 语义 | 不变；只是 route 节点多一个可选 `perm` 字段 |

---

## 10. 实现路线（建议分 PR）

1. **P1 数据层**：Prisma 三张表 + 迁移（admin→super_admin）。
2. **P2 后端**：`rbac` 模块 + `PermissionGuard` + JWT 扩容 + 后台账号挂角色。
3. **P3 前端基建**：`FUNCTION_POINTS` 注册表 + `ADMIN_MENU.perm` + 侧边栏过滤 + `usePerm`。
4. **P4 管理页**：角色权限管理页 + 后台账号编辑加角色下拉。
5. **P5 收口**：对高风险接口（退款、账号启停、角色管理）补 `@RequirePerm`；操作日志接入。

---

## 11. 须避开的坑

1. 把岗位角色塞进现有 `Role` 枚举（混淆两层）。
2. 只在菜单层做权限（漏掉 API 层 = 没权限）。
3. 权限粒度过细（每按钮一码）→ 维护灾难；过粗（整页一码）→ 误伤。
4. 一上来做用户-多角色多对多（除非有硬需求）。
5. 预设角色把 `super_admin` 做成可删 → 可能全员锁死。
