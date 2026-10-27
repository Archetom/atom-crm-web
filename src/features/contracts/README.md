# 合同功能边界

## 移动端交互参考

只借鉴旧 H5 的合同名称/编号搜索、响应式列表密度和从关联客户进入合同的交互位置；不复用 Vue、Vuex、全局筛选、统计页、合同详情、审批入口、金额/回款进度计算或旧 API 数据格式。

## 首个 Web 切片

客户详情在同时拥有 `contracts:read` 和 `customers:read` 时提供内部路由
`/crm/customers/:customerId/contracts`，不新增尚未由服务端 navigation 下发的侧栏菜单。列表只以路径中的客户 ID、URL 中的页码/每页数量/关键词调用生成的 `ContractQueryRequest`；服务端会再次复核合同读取权限、`CUSTOMER` 字段的未遮罩读取权限和客户记录可见性。

合同查询分页仍使用生成的泛型分页容器；详情、创建和更新成功响应已发布为具名 `ContractResponse`。运行时解码器只保留稳定的合同 ID、version、未遮罩的 customer ID、名称、编号、日期、关联联系人/负责人 ID 和状态；详情响应 ID 还必须精确匹配请求路径，没有回显当前 customer ID 的行会失败关闭。单行金额、折扣和产品明细不会进入列表 Query 缓存、页面或日志；详情回显的结构化 `fileFields` 只保留正 file ID、显示名、可选媒体类型/大小和字段 code，并且仅在 `contracts:read + customers:read + files:read` 下以固定 `contract` target 认证下载。协作者不从合同详情投影读取，只在独立管理对话框短暂保留服务端权威基线。

全局合同列表另以生成的 `ContractListSummaryResponse` 请求 `POST /api/v1/contracts/summary`。它只在同时拥有 `contracts:read + receivables:read` 时使用当前相同的关键词、场景、客户/商机确认筛选、保存视图或临时条件请求；查询键刻意不含分页和排序。响应只含服务端计算的总合同额、已回款额和未回款额，浏览器仅格式化，绝不从当前页、产品行或回款缓存合计；字段或范围条件不满足、接口失败或响应缺失时不显示汇总。

合同编号可进入同一客户上下文的 `/crm/customers/:customerId/contracts/:contractId`，同样不产生侧栏入口。详情只请求服务端授权的合同 ID，并要求其未遮罩的 customer ID 与路径一致；不匹配或缺失即失败关闭。产品区域仅在 `products:read` 下显示服务端返回的产品名称、编码、分类、单位和数量；产品价格、折扣和行金额始终丢弃，且不会从合同、客户或本地数据补全被服务端隐藏的快照。详情另仅在 `fields:read` 下按当前身份读取 `CONTRACT` 字段目录，并只显示同一响应回显的 ACTIVE、非内置、非 FILE 自定义标量值；目录只负责标题与格式，不可证明读取/写入权限，也不成为编辑、范围或更新基线。未知、停用、内置、FILE、空值或目录失败均失败关闭。`contracts:write + fields:read` 下另提供从空白开始的“编辑自定义字段”弹窗：只有用户明确填写或清除的标量 code 才随 version 化 PATCH 合并，详情回显值绝不预填或回写；USER/DEPARTMENT 候选只来自 `organization:read` 的受限目录，FILE/RELATION 没有伪造入口。

跨客户 `/crm/contracts` 列表的合同编号、名称和移动摘要标题会把正安全整数写入 `contractId` search param，并在原列表上方打开同一合同详情 Drawer。详情仍由既有 `GET /api/v1/contracts/{contractId}`、`contracts:read`、`customers:read` 和服务端数据范围/字段权限裁决；全局列表不从行缓存推断客户 ID。关闭、返回列表、删除或退出协作只移除 `contractId`，保留关键词、场景、筛选、排序、保存视图和分页；直接访问客户上下文详情路由则继续要求响应 customer ID 与路径完全一致。

参考站合同列表可勾选后转移、导出选中、删除和调整团队成员。本地桌面列表仅在当前页已选记录上显示这些操作：`contracts:assign + organization:read` 时可从服务端在职成员目录转移负责人，或通过可搜索的多选下拉选择成员后指定只读/读写及“不限/截止到”的有效时间、从团队移除；请求分别走 `PUT /api/v1/contracts/batch/owner`、`PUT /api/v1/contracts/batch/collaborators` 与 `DELETE /api/v1/contracts/batch/collaborators`，每项只携带当前服务端行的 `contractId + version`。截至日以 nullable `effectiveUntil` 传递；浏览器只作必填/日期输入约束，服务端拒绝过去日期且在该日期后不再把成员纳入协作者 read/write scope。`contracts:export` 时还可通过 `POST /api/v1/contracts/batch/export/csv` 下载已选行：浏览器只提交这些返回的 ID/version，经认证 Blob 保存一次性文件，不发送查询、列、关系或自定义字段。后端同时重验 `contracts:read` 和 export owner scope、每项版本及字段策略，只写入固定未遮罩列并保护公式前缀；下载不清空选择也不把文件、目标或错误写入 URL/持久化状态。批量添加只合并所选成员并保留每份合同的其他协作者，批量移除经确认且绝不允许移除负责人；`contracts:delete` 时仍可确认调用 `POST /api/v1/contracts/batch/delete`。切换列表语义或身份即废弃选择，成功后重新读取同一身份合同列表，失败显示服务端错误码的中文映射。后端对至多 100 项在同一事务中全量校验版本、数据范围、成员在职状态、负责人排除与删除依赖，任一失败均不部分更新。

拥有 `contracts:delete` 时，详情提供明确确认的软删除。请求只使用当前窄投影回显的合同 ID 和原始 version；服务端重新校验 owner scope 和并发版本，并拒绝已有发票、回款或回款计划的合同，随后撤回附件和文件字段绑定。前端不从合同金额、产品、状态、客户、本地负责人、关联业务或缓存推断删除资格；409 不自动重试。成功后仅失效同一身份的合同列表并回到该客户的列表页。

服务端回显状态为 `ACTIVE` 且拥有 `contracts:write` 时，详情还提供明确确认的合同作废。请求只携带 ID 和原始 version；服务端重新裁决合同写入范围、`STATUS` 字段写权限、当前 ACTIVE 状态与并发版本。成功后前端失效同一身份的详情和列表并重新读取状态；浏览器不从状态缓存、金额、产品、关联业务或本地 authority 推导可作废性，409 不自动重试。

同时拥有 `contracts:assign` 与 `organization:read` 时，详情提供负责人选择器。候选只来自服务端返回的在职成员目录；前端只提交所选成员 ID 和当前 version，不能手输成员 ID、缓存成员或推断其可分配范围。服务端复核合同 owner scope、`OWNER_ACTOR` 字段写权限、成员在职与可分配范围及并发。成功响应仍经合同窄投影解码，并只更新同一身份的详情和列表；409 不自动重试。

列表中的新建入口与 `/crm/customers/:customerId/contracts/new` 同时要求 `contracts:write` 与 `customers:read`。表单提交路径客户、用户确认的名称与编号、可选的签约/履约日期、合同类型、付款方式、备注和 `0..100` 的整单折扣；可选产品只能从 `products:read` 的服务端目录选择，并提交产品 ID、数量和可选成交单价，缺少该权限时仍可显式提交空 `products` 数组。单价留空时请求刻意省略该字段，由服务端采用目录价；仅 `contacts:read` 或 `opportunities:read` 时才会分别显示联系人或商机目录，候选必须由服务端回显当前路径客户，明确选择才发送相应 ID。仅 `contracts:assign + organization:read` 可从服务端在职成员目录选择负责人，未选择时省略 `ownerActorId` 并由服务端默认当前成员。浏览器不计算或展示行金额、折后金额和合同总额，也不会补协作者、动态字段或附件。成功响应必须回显同一客户 ID 才会写入详情缓存或跳转；当前成员无合同读取权限时只显示安全的成功编号。

### 合同部分编辑边界

当前 `PUT`/`PATCH /api/v1/contracts/{contractId}` 已承诺保留省略字段、只改变提交的非空字段。详情同时回显未遮罩名称与编号时，`contracts:write` 成员可打开基础编辑弹窗；它只用这两个字段和 version 组成 PATCH，且只发送用户实际修改的字段。额外拥有 `fields:read` 时，独立的动态字段弹窗只从当前目录接收用户明确修改的 ACTIVE 非内置标量 code；空数组仅表达该 code 的显式清除，遗漏 code 由服务端保留。详情已使用具名、字段裁决后的 `ContractResponse`，但它仍不返回每个字段的可见/遮罩状态，因此不能用详情投影、缓存或类型断言拼装客户/关系、金额、动态字段或产品成交价。

产品关系是独立的例外：`contracts:write + products:read` 时，“管理合同产品”仅在打开对话框后请求具名的 `GET /api/v1/contracts/{id}/products` 完整版本基线。解码器要求正合同/产品 ID、非负 version、非空产品名称/编码、正数量、非负成交单价和唯一产品集合，异常时失败关闭；普通详情的无金额产品快照绝不参与替换。新增候选只来自当前服务端可售目录，单价留空才让服务端采用目录价。保存严格以基线 version 调用 `PUT /products` 发送完整行集合，成功后使普通详情和列表失效重读；浏览器不计算或展示折扣、行金额、合同总额，也不推断发票、回款或回款计划下限。

### 合同协作者管理

`PUT /api/v1/contracts/{contractId}/collaborators` 是完整替换。管理对话框只在 `contracts:assign` 下先请求 `GET /collaborators`，并失败关闭地解码完整的 `actorId`、access、version 和 callerState；绝不使用合同详情中的空数组当作替换基线。候选只从 `organization:read` 下的服务端在职成员目录添加，保存严格使用协作者基线 version。`DELETE /collaborators/me` 在 `contracts:write` 下经过显式确认并使用详情 version；浏览器不推断当前调用者是否为协作者，服务端最终确认身份、范围和并发。成功后只更新或失效同一身份的合同详情、列表和协作者基线；409 不自动重试。
