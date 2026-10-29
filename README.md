# atom-crm-web

面向 [atom-crm](https://github.com/Archetom/atom-crm) 的开源 CRM Web 前端，基于 React、TypeScript 与 Ant Design，支持桌面和移动端。

[English](README.en.md) · [快速开始](#快速开始) · [文档](#文档) · [后端项目](https://github.com/Archetom/atom-crm)

## 主要功能

- **客户与销售**：客户、联系人、线索、商机、产品与公海。
- **合同与回款**：合同、发票、回款、回款计划与开票资料。
- **团队协作**：跟进记录、工作任务、审批、公告与通知。
- **数据与管理**：工作台、报表、仪表盘、组织成员、角色与字段配置。
- **响应式界面**：适配桌面和移动端，菜单与操作入口遵循服务端授权。

前后端分别构建和部署，通过 OpenAPI 契约联调。安装依赖、运行单元测试和构建可独立完成；使用业务功能需要启动配套后端。

## 快速开始

### 环境要求

- Node.js 26.13.0，版本见 [`.node-version`](.node-version)
- pnpm 12.16.1，与 [`package.json`](package.json) 一致
- 按[后端 README](https://github.com/Archetom/atom-crm#快速开始)启动 MySQL 和后端服务

### 启动前端

```bash
git clone https://github.com/Archetom/atom-crm-web.git
cd atom-crm-web
cp .env.example .env
pnpm install --frozen-lockfile
pnpm dev
```

打开终端显示的地址。开发服务器默认将 API 请求代理到 `http://localhost:8080`；需要修改时，在 `.env` 中设置 `VITE_API_PROXY_TARGET`。OpenAPI 快照和生成类型已随仓库提供，首次运行无需刷新。

### 首次安装

在 `/setup` 创建首个工作区管理员，之后通过 `/login` 登录。系统没有默认账号或密码，普通使用无需开启开发身份。

以上为本地开发流程。生产容器、HTTPS、同源代理及开发身份联调方式见[部署指南](docs/deployment.md)。

## 开发与测试

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm bundle:check
```

`pnpm test:e2e:a11y` 运行无需后端的浏览器可访问性检查；完整业务 E2E 需要隔离后端和种子数据，目前不在 CI 中执行。操作步骤见[部署与测试说明](docs/deployment.md)，API 契约变更见 [OpenAPI 指南](openapi/README.md)。

## 文档

| 文档                                  | 内容                          |
| ------------------------------------- | ----------------------------- |
| [部署指南](docs/deployment.md)        | 本地联调、生产部署与 E2E 测试 |
| [架构设计](docs/architecture.md)      | 目录组织、技术选型与数据流    |
| [OpenAPI 指南](openapi/README.md)     | 契约快照、类型生成与接口同步  |
| [API 覆盖](docs/api-coverage.md)      | 接口与前端功能的覆盖情况      |
| [导航说明](docs/navigation.md)        | 菜单、路由与页面边界          |
| [功能记录](docs/functional-parity.md) | 已交付功能与逐次变更          |
| [安全说明](docs/security.md)          | 身份认证、权限与敏感数据处理  |

## 参与贡献

欢迎提交 Issue 和 Pull Request。开始前请阅读[贡献指南](CONTRIBUTING.md)；安全问题请按[安全政策](SECURITY.md)私下报告。

## 许可证

[MIT](LICENSE)
