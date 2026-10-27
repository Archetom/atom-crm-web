# 贡献指南

欢迎通过 Issue 报告问题、讨论功能，或提交聚焦的 Pull Request。功能设计或跨前后端契约调整应先说明目标、兼容性和验证方法。普通讨论请勿包含客户资料、账号、Cookie、令牌或生产日志。漏洞使用 [安全报告流程](SECURITY.md)。

前端仓库为 [Archetom/atom-crm-web](https://github.com/Archetom/atom-crm-web)，配套后端为 [Archetom/atom-crm](https://github.com/Archetom/atom-crm)。

## 开发环境

使用 Node.js 24.12.0、pnpm 11.9.0，按 [README](README.md#快速开始) 安装锁定依赖并启动。首次 checkout 使用已提交的 API 契约；仅在后端契约变化时重新生成。`.env` 只用于本地配置，不能加入密钥或开发身份 ID；所有 `VITE_*` 值都应视为可公开的浏览器配置。

先阅读 [AGENTS.md](AGENTS.md)、[架构](docs/architecture.md) 与 [安全记录](docs/security.md)。保持严格类型、feature 的公开入口、服务端授权与字段策略边界；不要手工修改 `src/api/generated`，也不要用前端状态推断租户、角色或权限。

## 提交改动

1. 从当前主分支创建功能分支；保持 PR 聚焦，保留无关工作。
2. 为改变的行为补充有意义的回归测试，更新涉及的部署、路由或功能说明。
3. 如后端契约变化，先更新配套后端，按 [OpenAPI 说明](openapi/README.md) 刷新快照并生成类型及覆盖矩阵。提交快照、生成产物和兼容性说明，不使用临时手写 DTO。
4. 运行下面的基线检查，在 PR 中记录实际结果与未覆盖项。

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bundle:check
```

契约变更还需运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`；最后一个命令检查生成结果与已提交文件是否一致，应在提交生成产物后再次执行。页面改动运行对应浏览器测试，并检查键盘操作、小屏布局与错误状态。

`pnpm test:e2e:a11y` 运行不依赖后端的浏览器审计。完整 `pnpm test:e2e` 需要 [隔离后端和 seed 数据](docs/deployment.md)，不得连接生产或真实客户数据库。未运行完整 E2E 时，应明确说明，不把无后端检查通过表述为联调通过。

## Pull Request

说明用户能观察到的问题、变更后的行为、验证结果，以及配套后端提交或契约更新。若涉及界面，附不含个人或业务信息的截图；若涉及接口，说明版本兼容与迁移步骤。依赖升级提交锁文件并检查生产构建和依赖审计。不要在功能 PR 中混入无关格式化或依赖升级。

贡献受本仓库现有 [MIT License](LICENSE) 约束。请确保有权提交所包含的代码、图片和数据，保留第三方版权声明。交流中尊重不同背景的参与者，围绕问题与代码讨论。
