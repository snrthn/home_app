# Git 提交规范

> 本文档定义项目的 Git 提交信息格式规范，由 commitlint + husky 自动强制执行。
> 所有提交必须遵循 Conventional Commits 规范，否则本地 hooks 拦截 + CI 门禁阻断。

## 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### type（必填）

| type | 含义 | 示例 |
|---|---|---|
| `feat` | 新功能 | `feat(nest): 订单退款阶梯分账实现` |
| `fix` | 修复 bug | `fix(next): TabBar 警告修复` |
| `refactor` | 重构，不改变功能 | `refactor(nest): 详情弹窗布局优化` |
| `perf` | 性能优化 | `perf(nest): 派单查询加索引` |
| `style` | 代码格式 | `style: 统一缩进` |
| `test` | 测试相关 | `test(nest): 售后链 e2e 补充` |
| `docs` | 文档变更 | `docs: 提交规范文档` |
| `ci` | CI/CD 配置 | `ci: typecheck 设为阻塞` |
| `build` | 构建/依赖 | `build: 升级 turbo 到 2.0` |
| `deploy` | 部署相关 | `deploy: sync prod config` |
| `chore` | 杂项 | `chore: 清理临时文件` |
| `revert` | 回滚提交 | `revert: feat: 订单退款` |

### scope（可选）

标注改动所属模块，便于过滤和定位：

| scope | 说明 |
|---|---|
| `nest` | 后端 NestJS |
| `next` | 前端 Next.js |
| `shared` | 共享包 |
| `docs` | 文档 |
| `ci` | CI/CD |
| `deps` | 依赖 |
| `root` | 根目录 / 跨模块 |

### subject（必填）

- **中文**，简短描述改动内容
- **不超过 72 字**（commitlint 强制）
- **不加句号**结尾
- 用**祈使句**语气（「修复」「实现」而非「修复了」「实现了」）

### body（可选）

正文用于补充上下文，每行不超过 100 字：

- **改了什么**：具体改动的文件/函数
- **为什么改**：业务原因或技术原因
- **影响范围**：受影响的功能/模块

### footer（可选）

- `BREAKING CHANGE: <说明>` —— 标注破坏性变更
- `Closes #<issue>` —— 关联 issue 自动关闭

## 示例

### 简单提交

```
fix(next): TabBar 警告修复
```

### 带正文

```
feat(nest): 订单退款阶梯分账实现

- 新增 split.util.ts 提纯 splitNormal/splitRefund
- payments.refund 接入三方分账（full/tiered/keep_commission）
- settlements.createCompensation 生成待审核补偿单

Closes #12
```

### 破坏性变更

```
refactor(nest)!: 退款接口签名改为 stageStatus 参数

BREAKING CHANGE: refund() 第二参数从 orderId 改为 stageStatus，
调用方需同步更新。
```

## 工具链

| 工具 | 作用 |
|---|---|
| [commitlint](https://commitlint.js.org/) | 提交信息格式校验 |
| [husky](https://typicode.github.io/husky/) | Git hooks 管理 |
| `.gitmessage` | `git commit` 模板提示 |

### 本地校验流程

1. `git commit` 触发 `commit-msg` hook → commitlint 校验格式
2. 不合规 → 拒绝提交，提示修正
3. 合规 → 提交通过

### CI 校验

GitHub Actions `deploy.yml` 的 verify job 中包含 commitlint 检查步骤，
不合规的提交信息会被 CI 阻断，无法部署。

## 快速修复历史不合规提交

如果提交信息被 commitlint 拒绝，使用 `git commit --amend` 修改后重新提交：

```bash
git commit --amend -m "feat(nest): 正确的提交信息"
```
