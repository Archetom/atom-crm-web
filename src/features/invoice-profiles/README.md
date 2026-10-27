# 开票资料功能边界

## 移动端交互参考

仅借鉴旧 H5 在客户开票流程中管理抬头信息的上下文；不复用 Vue、全局缓存、旧请求层、账单金额或收件信息展示。

## 首个 Web 切片

客户详情在同时拥有 `invoices:read` 和 `customers:read` 时提供内部路由
`/crm/customers/:customerId/invoice-profiles`，不新增服务端 navigation 尚未下发的侧栏菜单。列表只使用路径客户 ID 调用 `GET /api/v1/invoice-profiles`；服务端会再次复核发票读取权限和该客户的当前可见性。

OpenAPI 快照尚未描述成功响应。运行时只保留稳定的资料 ID、customer ID、version、抬头类型、抬头、税号和更新时间，并要求每一条回显当前路径客户。银行名称、账户、注册地址、电话和备注不会进入 Query 缓存、页面或日志。

## 个人抬头新建

列表中的新建入口与 `/crm/customers/:customerId/invoice-profiles/new` 同时要求
`invoices:write` 与 `customers:read`。首期固定提交 `INDIVIDUAL`、路径客户 ID 和用户明确输入的抬头；税号、银行名称、账户、注册地址、电话和备注不会出现在表单、请求、缓存或日志中。成功后仅在同时拥有 `invoices:read` 且服务端回显相同客户 ID 时返回列表；否则只显示安全的成功编号。

## 个人抬头编辑

服务端回显 `INDIVIDUAL` 的条目可在列表中编辑个人抬头。弹窗只用窄投影中的标题作为初值，调用 `PATCH /api/v1/invoice-profiles/{profileId}` 时严格只提交用户确认的新标题与原始 version；不会发送 customer ID、titleType、税号、银行名称、账户、注册地址、电话或备注。更新响应仍须经同一窄投影解码，并且只在回显当前路径客户时更新同一身份列表缓存；服务端最终复核客户可见性、资料状态、字段规则和并发，409 不自动重试。组织抬头及其他敏感资料字段继续没有编辑入口。

## 版本化删除

每个列表条目的删除入口只在 `invoices:delete` 下显示，必须经过显式确认，并只发送该条目窄投影中的资料 ID 和 version。成功后失效同一身份下的当前客户列表；客户可见性、所有者范围、软删除状态和并发版本继续由服务端裁决，409 不会自动重试。
