# OpenAPI 快照

`atom-crm.json` 是从正在运行的 `atom-crm` 开发环境导出的、受版本控制的契约快照。它是前端类型生成和覆盖矩阵的唯一输入，不应手工修改。

```bash
pnpm api:snapshot
pnpm api:generate
pnpm api:coverage
```

默认请求 `http://localhost:8080/v3/api-docs`。若后端不在默认地址，请设置 `ATOM_CRM_API_ORIGIN`，或用 `ATOM_CRM_OPENAPI_URL` 指定完整文档地址。刷新前必须先启动后端的 `dev` profile；脚本不会发送开发身份 Header，也不会写入任何凭证。

提交快照更新时，必须同时提交生成的 `src/api/generated/schema.d.ts`、更新后的覆盖矩阵，以及对不兼容接口变更的说明。首份真实快照已于 2026-07-25 从本地 `dev` profile 导出；后续刷新仍不能用手写 DTO 替代契约。
