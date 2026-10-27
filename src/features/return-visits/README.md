# 回访功能边界

## 移动端交互参考

仅借鉴旧 H5 在客户上下文中进入关联业务记录的交互位置；不复用其 Vue 状态、全局选择桥接、旧对象类型、文件上传或关系写回逻辑。

## 首个 Web 切片

客户详情在同时拥有 `return-visits:read` 时提供内部路由
`/crm/customers/:customerId/return-visits`，不新增未下发的侧栏菜单。列表只以路径中的客户 ID、URL 中的页码/每页数量/关键词调用生成的 `ReturnVisitQueryRequest`；服务端会再次复核回访 authority、`CUSTOMER` 字段的未遮罩读取权限和客户记录可见性。

列表编号可进入同一客户上下文的 `/crm/customers/:customerId/return-visits/:returnVisitId`，同样不产生侧栏入口。详情只请求服务端授权的回访 ID，并要求其未遮罩的 customer ID 与路径一致；不匹配或缺失即失败关闭。

跨客户 `/crm/return-visits` 的编号与移动摘要使用正安全 `returnVisitId` 打开同一详情 Drawer。Drawer 只按回访 ID 请求服务端详情，客户关系、字段可见性和数据范围仍由服务端裁决；关闭和详情内返回只移除该参数，并保留关键词、场景、筛选、排序、保存视图和分页。Drawer 内编辑会将此列表 query 安全封装为 `returnTo`，取消或保存后恢复同一回访 Drawer；客户上下文直达路由继续要求详情 customer ID 与路径一致。

新建路由 `/crm/customers/:customerId/return-visits/new` 仅在 `return-visits:write` 下开放。它提交路径客户、用户确认的回访时间、可选回访形式/满意度/客户反馈，以及可选联系人和合同关系；未选择回访人时由服务端默认当前成员。联系人选择额外要求 `contacts:read + customers:read`，合同选择额外要求 `contracts:read + customers:read`；候选只从当前客户的服务端可见目录读取，运行时仅保留同一客户的正 ID 和非空名称，不能手输关联 ID。可选回访人额外要求 `return-visits:assign + organization:read`，候选只来自服务端可见的在职成员目录；仅用户明确选择时才发送 `ownerActorId`，否则省略。`fields:read` 下创建页还按当前身份的 RETURN_VISIT 字段目录提交标量动态字段；USER/DEPARTMENT 只使用 `organization:read` 下受限目录，FILE 只绑定 `files:write` 下同一 RETURN_VISIT 私有草稿中确认 `UPLOADED` 的文件 ID。目录、候选或必填附件不可用时保持关闭，RELATION 不降级为自由文本或 ID。选择结果只在当前表单和认证请求中携带，不进入 URL、持久化存储或日志；候选仍是按身份隔离的服务端查询数据。没有相应读取权限时保持未关联或由服务端默认。成功响应必须回显相同 customer ID 才会进入详情缓存或跳转。

编辑路由 `/crm/customers/:customerId/return-visits/:returnVisitId/edit` 同时需要回访读写权限。它仅在详情返回 version、回访时间和未遮罩备注时开放，避免把隐藏备注误写为空；在完整基线上只编辑回访时间和备注，并使用 B15 后端契约省略 `contactId`、`contractId`，由服务端保留未提交关联；409 需要用户显式选择保留或放弃草稿。负责人仍在独立切片中处理。`fields:read` 下详情会将当前响应已裁剪/脱敏的 ACTIVE 非内置非 FILE 自定义标量值只读展示；它们不进入编辑基线。若详情同一响应回显 FILE 字段附件，`return-visits:read + files:read` 下的只读卡片只保留后端 `FieldCode` 格式的 code 和有效文件元数据，并以当前详情 ID 发起认证下载；编辑不会把它们当作更新基线。

详情工具区另有独立的“编辑自定义字段”弹窗：同时需要 `return-visits:read + return-visits:write + fields:read`，且同一详情必须未遮罩地回显回访时间和反馈，才能作为生成更新契约的安全基础值原样保留。动态字段从空白开始，只有用户明确填写或清除的 ACTIVE、非内置标量 code 才随 PUT 合并；未触碰 code 保持服务端原值，详情显示值绝不回写。USER/DEPARTMENT 候选仅来自 `organization:read` 的受限目录，FILE/RELATION 仍无伪造入口。

负责人变更使用 `PUT /api/v1/return-visits/{returnVisitId}/owner`，详情入口同时需要 `return-visits:assign` 与 `organization:read`。候选只来自服务端可见的在职成员目录，保存携带当前 version；成员状态、可分配范围与 `OWNER_ACTOR` 字段权限均由服务端复核。

详情删除使用已生成的 `DELETE /api/v1/return-visits/{returnVisitId}?version=…`，仅在 `return-visits:delete` 下以详情原始 version 经二次确认提交。成功后只失效同一身份的回访列表并关闭详情；浏览器不从负责人、关系、附件或缓存推断删除资格、版本、软删除状态或附件撤回条件。服务端重新校验写入范围、版本并撤回该回访的附件和 FILE 绑定；409 不会自动重试。

详情中的联系人/合同选择使用同一个版本化 `PUT /api/v1/return-visits/{returnVisitId}`：联系人入口额外需要 `contacts:read` 与 `customers:read`，合同入口额外需要 `contracts:read` 与 `customers:read`。两个候选目录均按当前客户查询，运行时只保留同时回显当前 customer ID、正 ID 和非空名称的选项；详情也必须具有未遮罩的回访时间、备注，并收到连贯的 `VISIBLE`/`EMPTY` 关系状态才会开放选择、替换或确认清除。服务端再次校验候选可见性、关联归属、字段写权限和 version。

### 回访关系清除契约

提交的 OpenAPI 快照已将 `ReturnVisitUpdateRequest.contactId` 与 `contractId` 发布为 `number | null`。页面仅在用户确认后发送当前关系的显式 `null` 和服务端详情原始 version，并保留另一个关系字段的省略语义，避免把清除扩展为无意的关联替换。

`ReturnVisitResponse` 已发布具名 schema；运行时列表解码器仍只要求稳定的回访 ID 与 version，详情和创建/编辑响应额外要求 customer ID，其他业务字段可因字段级隐藏或遮罩而为 `null`，且不会被浏览器补全。全局列表与详情仅在 `fields:read` 下读取 RETURN_VISIT 字段目录，以活动、非内置、非 FILE 定义命名同一服务端已过滤的 `customFields` 值；详情值只读且不构成更新基线。

全局排序默认仅使用服务端静态目录。字段目录确认当前调用者可见的活动、非内置、可排序标量后，页面可恢复 `sort=custom:<fieldCode>:asc|desc`，并映射为生成契约的 `customSortFieldCode/sortDirection`；未知、停用、不可排序或无目录的 URL 值回退默认排序，浏览器不二次排序。
