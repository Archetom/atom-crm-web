# P3 产品完整编辑：后端契约改造清单

> 目的：使 Web 能安全实现产品完整编辑。2026-07-30 审核的 `openapi/atom-crm.json` 已有 `PUT /api/v1/products/{productId}` 与具名 `ProductUpdateRequest`，但 `GET`、创建和所有产品 mutation 的成功响应仍导出为裸 `object`。浏览器不能将不完整或被遮罩的详情当作全量替换基线。

## 现有阻塞

后端 `ProductCommandServiceImpl.update` 会将请求的 `categoryId`、`unit` 和 `description` 直接传给 `Product.replaceDetails`。省略这些可选请求字段会清空已保存值，并非部分更新；`customFields` 仍独立保留，`fileFields` 由专用绑定流程处理。

但当前 `GET /api/v1/products/{productId}`、`POST /api/v1/products`、`PUT /api/v1/products/{productId}`、`PUT .../availability` 和 `PUT .../owner` 的成功响应都是无字段的 `object`。当前详情投影也不能可靠地区分“字段实际为空”和“字段因策略隐藏/遮罩而不可读”。因此 Web 不能安全构造全量 `ProductUpdateRequest`，更不能用缓存、产品分类树或本地默认值补齐字段。

## 必须发布的契约

### 1. 具名产品响应

上述产品读取和 mutation 的 `200` 响应必须在 Springdoc 中声明为具名 `ProductResponse`，而非裸 `object`。最小字段如下；字段访问策略不可见或遮罩的业务字段可省略或为 `null`，但 `id` 和 `version` 必须始终存在：

```json
{
  "id": 42,
  "version": 7,
  "name": "入门套餐",
  "code": "PLAN-A",
  "categoryId": 9,
  "categoryName": "订阅",
  "unit": "license",
  "listPrice": 99.9,
  "description": "基础套餐",
  "availability": "AVAILABLE",
  "status": "ACTIVE",
  "createdTime": "2026-07-30T00:00:00",
  "updatedTime": "2026-07-30T00:00:00"
}
```

`id` 应为正整数，`version` 为非负整数；`listPrice` 为非负金额。`categoryId`、`unit` 与 `description` 必须在 schema 中保留其可空/可选语义。`customFields` 和 `fileFields` 不需要为了这个基础编辑切片暴露给 Web。

### 2. 明确的完整替换编辑基线

仅有普通 `ProductResponse` 仍不足以支持全量 `PUT`：当任何可替换字段受当前调用者的字段策略隐藏或遮罩时，前端无法区分它与业务空值，发送 `null` 会误清空服务器值。

后端必须选择并实现以下一种明确契约，推荐方案 A：

#### A. 推荐：专用编辑基线

新增：

```text
GET /api/v1/products/{productId}/editable-baseline
```

成功返回具名 `ProductEditableBaselineResponse`：

```json
{
  "id": 42,
  "version": 7,
  "editable": true,
  "name": "入门套餐",
  "code": "PLAN-A",
  "categoryId": 9,
  "unit": "license",
  "listPrice": 99.9,
  "description": "基础套餐"
}
```

- 该端点要求当前产品可见性和 `products:write`；服务端仍须在后续 `PUT` 重做所有授权、字段策略、分类、状态与乐观锁校验。
- 只有所有 `PUT` 会替换的基础字段都可安全读取且可写时，才返回 `editable: true` 和完整字段值；否则返回 `editable: false`，且不得通过缺失字段泄露隐藏或遮罩值。
- `editable: true` 时 `name`、`code`、`listPrice` 必填；`categoryId`、`unit`、`description` 必须保留其真实空值，使前端可以做不丢字段的完整替换。
- 前端只使用此端点返回的值和 version 构造 `ProductUpdateRequest`；读取失败、`editable: false`、字段缺失或 version 不匹配时关闭编辑。

#### B. 可选：把现有更新改为安全部分更新

若不新增编辑基线，应新增版本化 `PATCH /api/v1/products/{productId}`，并明确在 OpenAPI 声明：仅已提交的非 `null` 字段改变，省略或 `null` 保留原值。请求必须始终携带 `version`，但不要求浏览器回传不可读字段。现有全量 `PUT` 可保持兼容，但 Web 不调用它。不得把普通 `PUT` 的省略字段语义留给浏览器猜测。

## 后端实施与刷新步骤

1. 在 `ProductController` 为产品成功响应补 `@ApiResponse` / `@Schema(implementation = ProductResponse.class)`；若采用方案 A，再增加具名 `ProductEditableBaselineResponse`、controller、facade、application service 与字段策略测试。
2. 覆盖：完整基线、任一基础字段隐藏或遮罩时 `editable=false`、跨租户/无写权限不可读、分类不存在/不可用、`VERSION_CONFLICT`，以及 `PUT` 不会因为 Web 编辑丢失 `categoryId`、`unit` 或 `description`。
3. 在 `atom-crm` 仓库执行 reactor `install`，重启 `start` 服务，再导出 `/v3/api-docs`。不能只重启旧安装的 `start` 模块。
4. Web 刷新并验证：

```bash
ATOM_CRM_OPENAPI_URL=http://127.0.0.1:8080/v3/api-docs pnpm api:snapshot
pnpm api:generate
pnpm api:coverage
pnpm api:check
pnpm exec vitest run src/api/client/api-client.test.ts --maxWorkers=1
```

之后 Web 才能补产品编辑路由、完整 baseline 的表单、`409` 冲突处理与端到端回归。
