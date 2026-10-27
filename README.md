# atom-crm-web

[English](README.en.md)

`atom-crm-web` 是 `atom-crm` 后端配套的独立、响应式 React Web 应用。两个仓库分别构建和部署，使用同一套 API 契约联调。它使用 React Router Framework Mode、TypeScript strict、Ant Design 和 OpenAPI 驱动的客户端类型。

项目仓库：[Archetom/atom-crm-web](https://github.com/Archetom/atom-crm-web)；配套后端：[Archetom/atom-crm](https://github.com/Archetom/atom-crm)。取得两个仓库的代码后，可按下面的步骤本地运行。

## 当前状态

> 本节只描述当前已交付的范围。逐次变更记录在 `docs/functional-parity.md`，导航与路由基线在 `docs/navigation.md`；两者是追加式日志，出现分歧时以本节和代码为准。

应用已覆盖 `src/features/` 下的业务模块，包括：工作台与报表、客户 / 联系人 / 线索 / 商机 / 产品及其公海、合同 / 回款 / 回款计划 / 发票 / 开票抬头、回访与跟进时间线、任务与周期任务、阶段工作流、审批、市场活动与营销表单、OA（表单 / 申请 / 公告）、通知、保存视图、组织与成员、用户 / 角色 / 字段 / 业绩目标 / 嵌入页面 / 连接器 / 企业数据，以及首次安装与密码登录。`app/routes.ts` 是路由的唯一真实来源。

产品菜单提供服务端范围的目录列表、详情、新建、分类树与完整编辑。完整编辑已随具名 `ProductResponse` 契约落地（见 [P3 产品完整编辑后端契约](docs/backend-p3-product-contract-requirements.md)），并且只在服务端回显完整安全编辑基线时开放；目录价仅格式化或按用户确认数值原样提交。

契约与类型：OpenAPI 快照是 API 类型的唯一来源，不使用手写 DTO。服务端数据归 TanStack Query，可恢复状态进 search params，身份键参与每个 query key 且身份切换会清空缓存。

## 前置条件

- Node.js 24.12.0（`.node-version`、CI 和生产构建镜像使用的版本；`package.json` 的最低要求为 24.12.0）
- pnpm 11.9.0，与 `package.json` 的 `packageManager` 和 CI 一致
- 用于联调的配套 `atom-crm` 后端，按其 README 启动 MySQL、构建全部模块并启动 `dev` profile

## 快速开始

在已安装上述 Node.js 和 pnpm 的环境中运行：

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

仓库已提交 OpenAPI 快照和生成类型，首次运行不需要重新拉取契约。打开终端显示的前端地址，首次安装进入 `/setup` 创建工作区管理员；已有安装进入 `/login`。系统没有默认账号或密码。正常密码登录不需要启用开发身份。

后端默认地址为 `http://localhost:8080`。详见 [联调与 E2E 约定](docs/deployment.md)；契约刷新规则见 [OpenAPI 说明](openapi/README.md)，已核验的菜单与路由边界见 [导航基线](docs/navigation.md)。

本地开发身份必须显式开启，且只能用于后端 `dev`/`test` 环境：

```bash
VITE_ENABLE_DEV_AUTH=true pnpm dev
```

打开 `/dev/session`，填写本地租户中的成员 ID 和租户 ID（E2E 默认均为 `900001`）。该身份只保存在当前标签页的 `sessionStorage`。生产构建会拒绝 `VITE_ENABLE_DEV_AUTH=true`。

## 校验

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bundle:check
```

`pnpm api:check` 用于 CI 检查类型生成结果是否有未提交漂移。仅在后端契约变化时按 [OpenAPI 说明](openapi/README.md) 刷新快照、类型和覆盖矩阵。前端安全边界见 [安全记录](docs/security.md)，正常会话登录与部署要求见 [部署说明](docs/deployment.md)。

`pnpm test:e2e:a11y` 会自行启动（或本地复用）开发服务器，运行无需后端的 axe WCAG A/AA、移动抽屉键盘焦点和浏览器运行时错误审计；CI 会安装 Chromium 并执行该检查。

`pnpm bundle:check` 需要在构建后执行；它验证生产产物不包含开发身份代码，并限制任一浏览器 JavaScript 资源为 100 KiB gzip 以下。

生产环境可使用仓库的多阶段 `Dockerfile` 提供静态 SPA，并由其 Nginx 模板将同源 `/api/` 代理到经生产认证的后端。镜像构建、`ATOM_CRM_API_UPSTREAM` 配置、缓存策略和 TLS/身份网关职责见 [生产静态部署说明](docs/deployment.md#生产静态部署与同源代理)。

`pnpm test:e2e` 需要先按部署文档启动后端、执行 `pnpm e2e:seed`，再使用上面的开发身份命令启动前端。

> **注意：完整 E2E 套件目前不在 CI 中执行。** CI 只运行 `pnpm test:e2e:a11y`（即 `tests/e2e/accessibility.spec.ts` 一个文件）。`tests/e2e/` 下其余规格需要活的后端与已 seed 的租户，只能本地运行；修改相关页面后请手动执行对应规格。

## 参与与支持

- [贡献指南](CONTRIBUTING.md)：开发流程、契约同步和验证要求。
- [安全漏洞报告](SECURITY.md)：私密报告渠道和敏感信息要求。
- 普通问题或功能建议请使用本仓库的 Issue 模板，并附上前后端提交号及脱敏复现步骤。
- [部署说明](docs/deployment.md)、[架构](docs/architecture.md)、[API 覆盖](docs/api-coverage.md)。

## 许可证

本项目使用 [MIT License](LICENSE)。`package.json` 中的 `private: true` 用于防止意外发布 npm 包，不影响源代码的开源许可。第三方依赖遵循各自许可证。
