# 回款计划功能边界

## 首个 Web 切片

回款页在 `receivable-plans:read` 下提供同属现有回款工作区的“回款计划”入口，路由为 `/crm/receivable-plans`；不新增服务器 navigation 尚未下发的侧栏菜单。全局列表通过生成的 `ReceivablePlanQueryRequest` 读取 URL 可恢复的关键词、页码、每页数量、全部/我负责/下属负责场景、已确认客户和合同筛选，以及保存方案 ID；临时高级筛选条件只保留在页面内存。下属场景只发送 `subordinateOwnerOnly=true`，不发送成员或部门 ID；服务端依据当前身份、组织树和已裁决的数据范围得出负责人集合，空集合保持为空结果。保存方案和高级筛选只在 `saved-views:read` 下显示；服务端会重新确认方案成员所有权、RECEIVABLE_PLAN 对象类型、字段目录、值类型、关系可见性和数据范围。客户详情仍在同时拥有 `receivable-plans:read` 与 `customers:read` 时提供 `/crm/customers/:customerId/receivable-plans` 内部上下文入口；任何客户或合同筛选都继续由服务端复核字段访问和关系可见性。

当前 OpenAPI 快照将分页成功响应标为泛型对象。运行时只保留稳定的计划 ID、version、可空的客户/合同引用、期数、到期日期、计划/实际/未回款金额、收款方式、提醒天数、备注、负责人、进度、状态和时间戳；所有值都只在服务端按当前字段策略回显时显示，金额不会由浏览器重算。全局行只有客户关系实际回显时才可进入客户上下文详情；缺少该关系不会拼接路径。服务端已裁剪的 `customFields` 仅在 `fields:read` 下由当前 RECEIVABLE_PLAN 字段目录命名后展示。结构化 `fileFields` 只保留正 file ID、显示名、可选媒体类型/大小和字段 code，且只在 `receivable-plans:read + customers:read + files:read` 下以认证下载重新由服务端裁决。

全局页另通过生成的 `ReceivablePlanListSummaryResponse` 请求 `POST /api/v1/receivable-plans/summary`。它使用当前列表完全相同的关键词、负责人场景、客户和合同筛选、保存方案或临时高级筛选条件；查询键刻意不含分页但包含 `subordinateOwnerOnly`、`savedViewId` 和 `conditions`，避免将不同服务端谓词的金额缓存复用。在额外拥有 `receivables:read` 时仅格式化服务器返回的计划、实际与未回款三项金额。服务器独立重新裁决计划 `planned_amount`、回款 `amount` 以及两类数据范围；权限或字段条件不满足、接口失败或响应缺失时不显示汇总，也不以行金额、进度或缓存补零。

列表“更多”操作在同时具有 `receivable-plans:export` 时提供“导出当前筛选”。它将当前全局列表的关键词、负责人场景、客户、合同、保存方案和临时高级筛选原样交给生成客户端，但不发送页码或每页数量；字段选择固定为经审阅的回款计划目录。浏览器通过受控 `Blob` 下载处理成功的 CSV，不将文件地址、筛选结果或导出内容写入 URL、缓存或持久化状态。服务端继续以独立的读取和导出数据范围交集、字段可见性、关系可见性、单次容量阈值和公式安全编码裁决结果；下载失败仅显示受审阅的错误反馈。

全局行在同时具有 `receivables:write + contracts:read + customers:read + receivable-plans:read`，并且当前服务端投影同时回显客户与合同关系时提供“新建回款”。它只写入固定客户上下文路由、固定 `receivable-plans` 返回目标与正计划 ID；回款表单会重新读取计划、合同和该合同当前可用计划目录，三项严格匹配当前客户后才预选。URL、列表缓存与行数据都不能直接进入创建请求；验证失败时不预选且允许用户按既有受限目录手动选择。创建成功会失效同一身份的回款和计划列表（包括汇总）缓存，并将详情的返回操作带回原计划列表查询。

期数可进入同一客户上下文的 `/crm/customers/:customerId/receivable-plans/:planId`。详情只请求该计划，再以同一窄投影解码；回显客户 ID 缺失或不等于路径客户时失败关闭。`fields:read` 下只展示同一响应中已回显的 ACTIVE、非内置、非 FILE 动态值；额外具有 `files:read` 时仅为本次响应返回的 FILE 条目使用固定 `receivable-plan` target type、当前 ID、字段 code 和 file ID 发起认证下载，服务端继续裁决。详情不提供全量编辑；仅在服务端回显到期日期时，拥有 `receivable-plans:write` 与 `contracts:read` 的成员可编辑该日期。PATCH 仅发送本次实际变更的非空日期与 version；计划、已收或剩余金额、支付方式、备注、负责人、动态字段或附件不会读取、预填或写入。

同时拥有 `receivable-plans:delete` 与 `contracts:read` 时，详情提供明确确认的软删除。请求只使用当前窄投影回显的计划 ID 和原始 version；服务端重新校验计划 owner scope、关联合同可见性与并发版本，并拒绝已有回款历史的计划，随后撤回附件和文件字段绑定。前端不从计划进度、金额、合同、本地负责人、状态或缓存推断删除资格；409 不自动重试。成功后仅失效同一身份的计划列表并回到该客户的列表页。

## 单条回款计划新建

客户详情及计划列表中的 `/crm/customers/:customerId/receivable-plans/new` 需要
`receivable-plans:write`、`contracts:read` 与 `customers:read`。合同只能从同一客户的服务端可见合同查询中选择，不能手输 ID；单条计划请求包含所选合同 ID、用户明确输入的到期日、正计划金额、收款方式和非负整数提醒天数，及可选备注。空白备注在请求中省略；提醒和备注只存在当前表单与本次认证请求，不进入 URL、查询缓存、持久化存储或日志。`fields:read` 下表单按当前身份的 RECEIVABLE_PLAN 目录提交标量动态字段；USER/DEPARTMENT 仅使用 `organization:read` 下受限目录，FILE 仅绑定 `files:write` 下同一 RECEIVABLE_PLAN 私有草稿中确认 `UPLOADED` 的文件 ID。目录、候选或必填附件不可用时关闭创建，RELATION 不降级为自由文本或 ID。服务端继续复核合同处于可计划状态、合同/客户可见性、剩余可计划金额、提醒/备注及其他字段写权限与默认负责人范围；成功响应必须回显路径客户，拥有 `receivable-plans:read` 时才失效列表并进入详情，否则只显示返回编号。全量编辑保持关闭。

## 批量回款计划新建

同一权限下，列表额外提供 `/crm/customers/:customerId/receivable-plans/batch-new`。合同仍只能从当前客户的服务端可见目录选择；每条计划提交用户直接填写的到期日、正计划金额、收款方式及可选非负整数提醒天数和备注，最多 100 条。空白备注在对应行请求中省略；`fields:read` 下每行还按当前身份的 RECEIVABLE_PLAN 目录提交标量动态字段，USER/DEPARTMENT 候选仅来自 `organization:read` 下的受限目录。生成的批量请求没有文件草稿绑定，因此不提供附件；任一必填 FILE 或 RELATION 无法安全表达时明确关闭批量提交。浏览器不计算、分摊或显示计划总额，也不提交负责人；负责人固定由服务端为当前成员确定。提醒和备注仅随当前行的认证请求传递，不进入 URL、查询缓存、持久化存储或日志。服务端原子校验合同活跃状态、每条字段写权限和全部计划的累计可用额度；成功响应必须全部经窄投影解码并回显路径客户，拥有读取权限时仅失效并返回列表，409 不自动重试。

全量编辑需要回放计划金额、收款方式、提醒、备注与动态/文件字段的完整版本化基线；当前详情投影会安全丢弃这些字段，且服务端会拒绝已有回款历史的计划。除到期日的受控 PATCH 外，后端提供可安全重放的写基线前，不注册其他编辑入口。

## 移动端交互参考

交互参考范围为移动端合同内的回款计划概览和创建入口。

Web 仅借鉴客户/合同上下文、列表到详情的可达性、期数和进度的信息层级；不继承旧 Vue 状态缓存、旧 API、金额展示/计算或批量创建入口。新实现以认证后的生成 OpenAPI 客户端和服务端资源/字段授权为准。
