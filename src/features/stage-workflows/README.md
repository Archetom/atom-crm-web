# 阶段工作流

`/workflows` 只向 `workflows:read` 成员开放，并由服务端返回的
`workflow.definitions` 菜单项导航。目录固定只发送 URL 中的页码和每页数量，不提供
对象类型、状态或关键字等浏览器筛选。响应在写入缓存前仅保留正流程 ID、名称、业务对象
和非负 version；阶段、任务、字段、审批门、适用成员/部门、状态、时间与
`allowedActions` 一律丢弃。

`workflows:manage` 成员可从目录新建停用流程，并在详情打开资源级配置管理。创建只消费服务端
配置目录中的对象类型、可作必填项的字段和审批定义，以及专用 MEMBER/DEPARTMENT 候选分页；编辑
只在同一详情下发 `UPDATE + version` 且全部阶段 `editable=true` 时开放完整替换。状态操作只使用
同一资源下发的 `CHANGE_STATUS + allowedStatuses + version`。全局 authority 仅守卫入口，任何资源
级资格、状态转换、引用和作用范围始终由服务端复核。

`/workflows/:workflowId` 的普通详情以路径中的正 ID 读取一个服务端授权的完整定义，但仅保留流程名称、
业务对象、成功/失败结果名称和可渲染的阶段投影。阶段投影只含名称、顺序、概率、必填字段码、
任务名称/必填标记以及“含审批门”布尔值；状态、适用范围、资源级 capability、阶段/任务码和
审批定义 ID 一律丢弃。仅当管理入口主动查询同一路径并收到完整的 manager baseline 时，才在独立
缓存中保留作用范围、stage/task code、审批定义 ID、`editable`、`allowedActions`、`allowedStatuses`
和 version，用于完整重建请求；任一基线字段缺失时写入失败关闭。

客户详情中的“启动阶段工作流”只在用户主动打开后读取当前客户的服务端适用流程，并只对
`canStart=true` 项发起启动请求。成功后跳转 `/workflow-records/:workflowRecordId`，运行记录页在
`workflows:read` 守卫内只显示受限状态、当前阶段名称/顺序、任务名称/必填标记及审批门提示；
除 `COMMENT` 与受限 `ADVANCE` 收敛为布尔 capability 外，只有在 `ADVANCE` 存在时才保留审批人选择、当前允许完成任务和可写基础字段的受限投影；
审批实例、进度、附件和时间均不会进入运行记录缓存。失败只保留服务端下发的结果标签与备注约束；专门字段录入仍是独立切片。

当运行记录同时回显 `ADVANCE`、非负 version，且所有可写字段均为完整、受审查的输入基线时，页面显示“推进阶段”二次确认。基础字段只保留未遮罩的 code、名称、类型、值域和当前值；USER、DEPARTMENT、RELATION 候选字段只读取同一运行记录 + field code 的专用分页，并只提交返回且类型匹配的 ID；ADDRESS 只保留服务端枚举的分量与结构化当前值。FILE 只在当前记录恰有一个 `FILE_DRAFT` 基线时开放：浏览器创建同一记录/字段的草稿，按具名 intent 的 URL、方法和 headers 上传且不附加身份，再查询同一草稿/字段/file ID 的状态；仅 `UPLOADED` ID 可随 `fileFieldDraftId + fileFields` 提交。当前允许完成的任务会以名称和必填标记展示，只有成员显式勾选的 code 才会作为 `completedTaskCodes` 提交，所有必填任务须勾选。没有审批人选择时它只发送 version；有选择时，每个候选分页都仅按当前运行记录和 selection code 读取，浏览器必须显式选择每项至少一名候选后才发送 `selectedApprovers + version`。成功响应必须是同一记录的完整安全投影；冲突或失败不会自动重试，成员可以明确刷新运行记录。多 FILE 字段、过期/未确认文件或任一专门字段不完整时，整次字段推进失败关闭，不做部分提交。只有同一记录同时下发 `FAIL + version + allowedOutcomes` 时，才显示“结束为未完成”；浏览器只提交所选服务端 outcome code 与符合 `remarkRequired` / `remarkMaxLength` 的备注。

运行记录页会读取当前记录的服务端评论分页，只保留评论 ID、同一运行记录 ID、内容、可选创建时间、
非负 version 与 `canDelete`。评论人、更新时间及其余字段在解码边界丢弃。仅在记录的 `canComment=true`
时显示发表框；删除只在该条评论的 `canDelete=true` 时显示，并携带该条服务端 version。两种写操作都由
服务端再次校验，浏览器不根据当前身份、流程状态或当前阶段推断资格。
