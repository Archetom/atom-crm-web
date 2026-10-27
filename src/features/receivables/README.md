# 回款功能边界

全局 `/crm/receivables` 桌面列表已对齐参考站的当前页批量“转移 / 删除”：`receivables:assign + organization:read` 时负责人只可从服务端在职成员目录选择，`receivables:delete` 时有明确确认。每个请求仅带当前行的 `receivableId + version`；切换关键词、场景、关系筛选、分页或身份会废弃选择。服务端独立重验范围、字段和并发，并保证一项失败时整批不转移或删除。

## 首个 Web 切片

客户详情在同时拥有 `receivables:read` 与 `customers:read` 时提供内部路由
`/crm/customers/:customerId/receivables`，不新增服务端 navigation 尚未下发的侧栏菜单。列表只使用路径客户 ID、URL 页码和每页数量调用生成的 `ReceivableQueryRequest`；服务端再次复核回款读取权限、客户字段未遮罩读取权限和客户可见性。

当前 OpenAPI 快照将分页成功响应标为泛型对象。运行时只保留服务端已授权的回款 ID、version、customer ID、合同/回款计划引用、编号、日期、金额、收款方式、备注、负责人、时间戳和 `customFields`；隐藏或脱敏字段仍由服务端省略或遮罩，浏览器不会补全。全局列表仅在 `fields:read` 下读取 RECEIVABLE 字段目录，以目录中的活动、非内置、非 FILE 字段生成可选动态列；值只来自同一列表响应。

全局回款列表另以生成的 `ReceivableListSummaryResponse` 请求 `POST /api/v1/receivables/summary`。它在 `receivables:read` 下使用当前完全相同的关键词、负责人场景、客户/合同/回款计划确认筛选、保存视图或临时条件；查询键刻意不含分页和排序。响应只含服务端计算的记录数与回款金额，浏览器仅格式化且不会从当前页、合同或回款缓存合计；字段或范围条件不满足、接口失败或响应缺失时不显示汇总。

全局排序默认只使用服务端静态目录。字段目录确认当前调用者可见的活动、非内置、可排序标量后，页面才接受 `sort=custom:<fieldCode>:asc|desc` 并映射为生成契约的 `customSortFieldCode/sortDirection`；未知、停用、不可排序或无目录的 URL 值回退默认排序，浏览器不二次排序。

回款编号可进入同一客户上下文的 `/crm/customers/:customerId/receivables/:receivableId`。详情只请求该回款；回显客户 ID 缺失或不等于路径客户时失败关闭。详情显示服务端按当前字段策略返回的金额、收款方式、备注、负责人和审计时间；`fields:read` 下还会按需读取 ACTIVE、非内置、非 FILE 的 RECEIVABLE 字段目录，并仅展示同一响应已回显的字段值，缺少目录、值或权限时不显示替代值。这些值不是编辑基线。额外具有 `files:read` 时，详情仅为本次响应返回的 FILE 条目使用固定 `receivable` target type、当前 ID、字段 code 和 file ID 发起认证下载，服务端继续裁决。仅在服务端回显回款日期时，拥有 `receivables:write` 与 `contracts:read` 的成员可编辑该日期。PATCH 仅发送本次实际变更的非空日期与 version；关联计划、金额、支付方式、备注、负责人、动态字段和附件不会由该操作修改。

跨客户 `/crm/receivables` 的回款编号与移动摘要使用正安全 `receivableId` 打开同一详情 Drawer。Drawer 只按回款 ID 重新请求服务端详情，不从列表缓存推断客户关系；关闭、详情内返回或删除只移除该参数，并保留关键词、场景、筛选、排序、保存视图和分页。客户上下文直达路由继续要求详情 customer ID 与路径一致。

同时拥有 `receivables:assign` 与 `organization:read` 时，详情提供负责人选择器。候选只来自服务端返回的在职成员目录；前端只提交所选成员 ID 和当前 version，不能手输成员 ID、缓存成员或推断其可分配范围。列表/详情中已回显的负责人 ID 只作引用展示，不证明可分配范围；服务端复核回款 owner scope、`OWNER_ACTOR` 字段写权限、成员在职与可分配范围及并发。成功响应只有 ID 和客户回显匹配路径时才更新同一身份的详情和列表；409 不自动重试。

拥有 `receivables:delete` 时，详情提供明确确认的软删除。请求只使用当前窄投影回显的回款 ID 和原始 version；服务端复核 owner scope 和并发版本，并撤回附件与文件字段绑定。前端不从回款金额、合同、计划、本地负责人、状态或缓存推断删除前提；409 不自动重试。成功后仅失效同一身份的回款列表并回到该客户的列表页。

## 回款新建与可选计划关联

客户详情及回款列表中的 `/crm/customers/:customerId/receivables/new` 需要
`receivables:write`、`contracts:read` 与 `customers:read`。合同只能从同一客户的服务端可见合同查询中选择，不能手输 ID；请求包含所选合同 ID、用户明确输入的到账日、正回款金额、收款方式和可选备注。额外拥有 `receivable-plans:read` 时，用户可从该合同的服务端可用计划目录选择一个关联计划；每个候选必须回显同一合同和路径客户，金额字段会在解码边界丢弃，缺少读取权限时只能新建未关联回款。仅同时拥有 `receivables:assign` 与 `organization:read` 时才显示负责人目录；候选只来自服务端可见在职成员，明确选择才发送 `ownerActorId`，未选择时由服务端默认当前成员。`fields:read` 下表单按当前身份的 `RECEIVABLE` 字段目录提交活动、非内置的标量动态字段；USER/DEPARTMENT 仅使用 `organization:read` 下受限的成员或部门目录，FILE 仅绑定 `files:write` 下同一 `RECEIVABLE` 私有草稿中确认 `UPLOADED` 的文件 ID。字段目录、必填候选或必填附件不可用时创建保持关闭，RELATION 不降级为自由文本或 ID。备注只保留在当前表单及本次认证请求中，不进入 URL、查询缓存、持久化存储或日志。服务端继续复核合同处于可回款状态、合同/客户可见性、计划归属、剩余可回款金额、负责人范围与字段写权限；成功响应必须回显路径客户，拥有 `receivables:read` 时才失效列表并进入详情，否则只显示返回编号。全量编辑保持关闭。

全量编辑需要回放金额、收款方式、备注、动态/文件字段与不可变计划关联的完整版本化基线；当前详情虽可显示服务端已授权值，却不能充当完整写基线，前端不猜测或用 `null` 覆盖它们。除回款日期的受控 PATCH 外，后端提供可安全重放的写基线前，不注册其他编辑入口。

## 移动端交互参考

交互参考范围为移动端回款列表、条目摘要和详情的信息层级。

Web 仅借鉴客户上下文、列表到详情的可达性、编号、日期与状态的信息层级；不继承旧 Vue 状态缓存、旧 API、全局筛选或金额展示/计算。计划关联仅使用新的服务端可用目录，不迁移旧入口的本地可用金额推断。新实现以认证后的生成 OpenAPI 客户端和服务端资源/字段授权为准。
