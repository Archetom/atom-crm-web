# P5 审批与阶段工作流：后端契约改造清单

> 目的：追踪 `atom-crm-web` P5 后续切片的后端契约前置条件。2026-07-28 刷新的 OpenAPI 已补齐审批动作、阶段运行记录、评论、推进字段/任务和记录专用审批人候选等主要具名 DTO；Web 已据此完成相应的受限交付。下列“仍需补齐”项是在该快照上复核出的剩余阻塞，浏览器不能通过本地状态、自由输入或成员目录推断补齐。

## 交付规则

1. 任何成功响应不得再标注为无字段的 `object`；控制器必须返回具名 DTO，并让 Springdoc/OpenAPI 导出完整 schema、枚举、分页和错误响应。
2. 租户、记录可见性、当前处理人/申请人/管理员、字段访问、状态机和乐观锁均由服务端裁决。浏览器只消费响应中的 capability 和 version，不比较本地 actor ID、角色或任务归属。
3. 写操作必须携带服务端读取的 `version`，版本不匹配返回 `409 + VERSION_CONFLICT`；mutation 不可自动重试。
4. 错误使用稳定 `errCode`。`errMsg` 可供日志或人工诊断，但 Web 不直接展示。

## 1. Authorization 与导航

`GET /api/v1/authorization/me` 应采用明确的 `MemberAuthorizationResponse` schema，并在 `authorities` 中暴露以下全局入口权限：

```json
{
  "actorId": 1001,
  "authorities": ["approvals:read", "approvals:manage", "workflows:read", "workflows:manage"],
  "dataScopes": {},
  "roles": []
}
```

- `workflows:read`：读取流程定义、运行记录和服务端确认可见的评论。
- `workflows:manage`：创建、编辑和变更流程定义状态。
- `ADVANCE`、`FAIL`、`COMMENT`、审批处理、撤回、取消等资源级操作不能仅靠上述 authority 开放；必须由对应资源响应的 `allowedActions` 决定。
- 若阶段工作流需要正式侧栏入口，`NavigationCatalog` 应增加由 `workflows:read` 保护的菜单叶子（例如 `workflow.definitions` → `/workflows`）。

## 2. 审批实例、待办与动作

### 2.1 统一实例投影

`GET /api/v1/approvals/{instanceId}` 返回 `ApprovalInstanceView`：

```json
{
  "id": 8101,
  "version": 12,
  "status": "PENDING",
  "title": "客户折扣审批",
  "allowedActions": ["APPROVE", "REJECT", "TRANSFER"],
  "tasks": [
    {
      "stepOrder": 1,
      "stepName": "区域负责人审批",
      "status": "PENDING",
      "actedTime": null
    }
  ]
}
```

`status`、任务状态和 `allowedActions` 都必须在 OpenAPI 中声明为 enum。不得向该投影泄露审批事实、业务记录详情、申请人/处理人 ID、附件、内部任务 key 或备注。

`POST /api/v1/approvals/query` 的 `Pager.objectList` 应使用 `ApprovalWorkItemView`，至少返回 `id`、`version`、`status`、可选 `title` 和 `allowedActions`。批量操作只能选择服务端明确允许对应动作的条目。

### 2.2 单项动作

保留 `POST /api/v1/approvals/{instanceId}/actions`，但将 `ApprovalActionRequest.action` 改为 enum：

```json
{
  "version": 12,
  "action": "APPROVE",
  "remark": "同意"
}
```

支持 `APPROVE`、`REJECT`、`TRANSFER`。`TRANSFER` 必须携带 `transferActorId`，其他动作不得携带该字段。后端必须验证该动作位于当前调用人的 `allowedActions` 中，并重新验证并发、当前任务与转审候选资格。

成功响应使用：

```json
{
  "instance": {
    "id": 8101,
    "version": 13,
    "status": "APPROVED",
    "title": "客户折扣审批",
    "allowedActions": [],
    "tasks": []
  }
}
```

`POST /api/v1/approvals/{instanceId}/withdraw` 与 `.../cancel` 也应返回同一 `ApprovalActionResult`，且分别只在 `allowedActions` 包含 `WITHDRAW`、`CANCEL` 时允许执行。

新增受当前审批任务约束的转审候选接口：

```text
GET /api/v1/approvals/{instanceId}/transfer-candidates?page=1&size=50
```

返回 `Pager<TransferCandidateView>`（`actorId`、`displayName`）。候选列表不是授权证明；动作提交时仍必须复核成员状态与转审规则。

### 2.3 批量、计数、预览和发起

`POST /api/v1/approvals/actions/batch` 必须有明确原子结果：

```json
{
  "atomic": true,
  "applied": false,
  "items": [
    {
      "instanceId": 8101,
      "status": "REJECTED",
      "errCode": "VERSION_CONFLICT"
    }
  ]
}
```

任一项失败时不得部分提交。全部成功时每项返回新 `status` 与 `version`。

补齐以下 DTO：

| 接口                                                                     | 成功响应与约束                                                                                                    |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `GET /approvals/pending-count`                                           | `ApprovalPendingCountResponse { count }`，`count` 为非负整数且只统计当前调用人可处理的待办。                      |
| `POST /approval-definitions/{definitionId}/preview`                      | `ApprovalRoutePreviewResponse`：`definitionId`、`subjectId`、`executable`、可选 `blockerCode`、最小安全步骤投影。 |
| `GET /approvals/subjects/{objectType}/{subjectId}/start-options`（新增） | 当前调用人可发起的定义、所需审批人选择和记录能力；服务端验证记录可见性与字段权限。                                |
| `POST /approvals`                                                        | 成功返回 `ApprovalInstanceView` 或等价 mutation result；服务端按 `(tenant, actor, idempotencyKey)` 实现幂等。     |

对已存在的业务记录，审批路由 facts 必须由后端读取，不能接受浏览器任意提交的 `facts` 作为持久化审批依据。若确有草稿预览需求，应另设带完整字段约束、字段访问校验和明确生命周期的草稿接口。

## 3. 阶段工作流

当前快照中的 `/api/v1/stage-workflows*` 和 `/api/v1/stage-workflow-records*` 已使用下列具名 DTO；其中运行记录的 `ADVANCE`、评论和记录专用审批人候选已可由 Web 消费：

| DTO                           | 必要字段                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `StageWorkflowSummary`        | `id`、`name`、`objectType`、`status`、`version`                                               |
| `StageWorkflowDetail`         | Summary 字段、完整 stages、适用成员/部门基线、`allowedActions`、`allowedStatuses`             |
| `StageWorkflowRecord`         | `id`、`workflowId`、`recordId`、`version`、`status`、当前阶段、任务、审批门、`allowedActions` |
| `StageWorkflowComment`        | `id`、`content`、`createdTime`、`canDelete`                                                   |
| `StageWorkflowMutationResult` | `id`、`version`、`status`                                                                     |

接口映射：

| 接口                                                                           | 成功响应                                                                   |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `POST /stage-workflows/query`                                                  | `Pager<StageWorkflowSummary>`                                              |
| `GET /stage-workflows/{workflowId}`                                            | `StageWorkflowDetail`                                                      |
| `POST /stage-workflows`、`PUT /stage-workflows/{workflowId}`、`PUT .../status` | `StageWorkflowMutationResult`                                              |
| `GET /stage-workflows/applicable`                                              | `StageWorkflowApplicableResponse`，只含当前记录可启动的流程与 `canStart`。 |
| `POST /stage-workflows/{workflowId}/records/{recordId}`                        | `StageWorkflowRecord`                                                      |
| `GET /stage-workflow-records/{workflowRecordId}`                               | `StageWorkflowRecord`                                                      |
| `PUT .../advance`、`PUT .../outcome`                                           | 更新后的 `StageWorkflowRecord`                                             |
| 评论 GET/POST/DELETE                                                           | `Pager<StageWorkflowComment>` / `StageWorkflowComment` / 删除确认 DTO      |

运行记录的最小安全投影示例：

```json
{
  "id": 7001,
  "workflowId": 301,
  "recordId": 501,
  "version": 9,
  "status": "RUNNING",
  "currentStage": {
    "code": "qualification",
    "name": "资格确认",
    "order": 1,
    "tasks": [
      { "code": "verify-owner", "name": "确认负责人", "required": true, "completed": false }
    ]
  },
  "allowedActions": ["ADVANCE", "FAIL", "COMMENT"],
  "writableFieldCodes": ["industry", "estimatedAmount"],
  "allowedTaskCodes": ["verify-owner"],
  "approvalGate": { "status": "NOT_REQUIRED" }
}
```

`StageAdvanceRequest.fieldValues`、`completedTaskCodes`、`selectedApprovers` 只能接受上述运行记录明确下发的字段、任务和候选；服务端必须在提交时再次验证。字段定义、枚举候选、遮罩值和文件元数据也必须仅返回当前调用人可读写的部分。

将当前 `GET /api/v1/stage-workflow-records/{recordId}` 的参数命名统一为 `{workflowRecordId}`，避免与业务记录 `recordId` 混淆。若修改路径会造成兼容性风险，新增正确命名路径并将旧路径标为 deprecated。

评论响应不得依赖前端比较作者 ID；由服务端提供 `canDelete` 并在删除时重新验证。阶段文件应先通过记录投影或单独元数据接口返回可见的 `fileId`、`fileName`、`mediaType`，内容下载端点继续校验记录可见性与文件权限。

### 3.1 已补齐的运行记录契约（2026-07-28 快照）

1. `StageOutcomeRequest.outcome` 已导出为 `FAILED` 枚举；运行记录在可失败时同时下发必填的 `allowedOutcomes`，其中包含 `code`、`label`、`remarkRequired` 和 `remarkMaxLength`。浏览器只能提交同一记录广告出的 code 与 version。
2. `StageWritableFieldResponse.input` 已声明专用 `inputType`、候选/草稿要求、关联对象类型、地址组成和稳定 `blockerCode`。`GET /stage-workflow-records/{workflowRecordId}/writable-fields/{fieldCode}/candidates` 提供记录和字段作用域内的 USER、DEPARTMENT、RELATION 分页候选；`POST .../file-drafts` 提供 FILE 草稿；ADDRESS 通过 `StageAddressValueRequest` 结构化提交。推进请求的 typed maps 与服务端复核禁止用成员目录、自由文本或既有文件 ID 绕过作用域。
3. `StageWorkflowRecordResponse.version`、`allowedOutcomes`、当前阶段投影与 `StageWorkflowActionResult.record` 已在 OpenAPI 中标为必填（终态记录的 `currentStageCode` 可为 `null`）。动作成功可用完整服务端回显安全替换缓存。

### 3.2 已补齐的流程配置契约（2026-07-28 快照）

1. `StageWorkflowStatusRequest.status`、`StageWorkflowMutationResult.status` 与详情 `allowedActions` 已导出为枚举；mutation 成功结果的 `id`、`version`、`status` 均为必填。
2. `GET /stage-workflows/configuration-options` 返回受 `workflows:manage` 和字段访问约束的对象类型、字段和审批定义目录；`GET .../configuration-options/candidates` 返回同一权限范围内的 MEMBER/DEPARTMENT 分页候选。浏览器不得枚举本地 object type 或复用全局组织目录。
3. `StageWorkflowDetailResponse` 现在提供 versioned 的适用成员/部门、阶段、任务和审批定义基线；每个阶段额外返回 `editable` 与稳定 `blockerCode`，未被服务端支持的复杂或专用配置会显式关闭编辑，而不是接受部分覆盖写入。

### 3.3 本轮已补齐的可执行写入细节（本次快照）

1. `POST /file-field-drafts/{draftId}/fields/{fieldCode}/upload-intents` 现在返回 `FileFieldUploadIntentResponse`：`draftId`、`fieldCode`、`fileId`、`uploadUrl`、`uploadMethod`、`requiredHeaders`、`expiresAt` 均为必填。内容上传与上传状态查询均返回最小 `FileFieldUploadedFileResponse`（`fileId`、`displayName`、`mediaType`、`size`、`status`）。
2. 阶段草稿持久化绑定到 `workflowRecordId`。推进时服务端复核草稿、记录、字段和每个 file ID 的同一作用域，并要求上传完成、未过期且字段仍可写；历史附件或其他草稿/字段的 ID 不可被提交消费。
3. `GET /stage-workflows/configuration-options/candidates` 的 `candidateType` 已为 `MEMBER | DEPARTMENT` 枚举，分页项使用专用 `StageWorkflowConfigurationCandidateResponse` 并回显枚举 `valueType`。
4. `StageWorkflowDetailResponse.allowedStatuses` 仅在 `allowedActions` 包含 `CHANGE_STATUS` 时提供目标状态；服务端领域状态机仍在写入时复核转换。
5. ADDRESS 字段在 `StageWritableFieldResponse.currentAddress` 返回结构化 `StageAddressValueResponse`；非 ADDRESS 字段为空且不再要求浏览器解析 `currentValues`。

## 4. Work 周期任务契约（已由本轮快照发布）

`/api/v1/work/task-series*` 的成功响应现均为具名 schema，不再导出裸 `object`：

- 列表为 `WorkTaskSeriesListPageResponse`，每项为 `WorkTaskSeriesListItemResponse`；详情为
  `WorkTaskSeriesDetailResponse`，提供完整 recurrence、版本、编辑基线和服务端裁决的
  `allowedActions`/`actionBlockers`。
- 创建、更新、停止、暂停、激活均返回必填的
  `WorkTaskSeriesMutationResultResponse { id, version, status, allowedActions }`。
- `status` 以 OpenAPI 枚举下发 `DRAFT`、`ACTIVE`、`PAUSED`、`STOPPED`、`ENDED`；
  `allowedActions` 枚举为 `UPDATE`、`ACTIVATE`、`PAUSE`、`STOP`，可为空。浏览器不得从本地身份、
  创建人字段或角色推断这些动作。
- `actionBlockers` 当前以 `SCHEDULER_UNAVAILABLE`、`PARTICIPANT_INELIGIBLE` 解释可管理系列的
  不可用动作。激活写入仍在服务端复核 version、调用方、当前状态、recurrence、时区、参与人资格和调度器就绪度。
- 全部写端点在 OpenAPI 声明 `400`、`403`、`404`、`409`、`422`。状态、权限和乐观锁失败仍由服务端决定，
  不以浏览器隐藏按钮作为授权依据。

## 5. 错误码、OpenAPI 与验收

所有写端点声明 `400`、`403`、`404`、`409`、`422` 响应。至少增加或稳定以下错误码：

```text
VERSION_CONFLICT
CONCURRENT_OPERATION
APPROVAL_ACTION_NOT_ALLOWED
APPROVAL_ALREADY_PROCESSED
TRANSFER_TARGET_INVALID
BATCH_ACTION_REJECTED
WORKFLOW_ACTION_NOT_ALLOWED
WORKFLOW_STATUS_TRANSITION_INVALID
WORKFLOW_STAGE_REQUIREMENT_UNMET
WORK_TASK_SERIES_ACTION_NOT_ALLOWED
WORK_TASK_SERIES_STATUS_INVALID
WORK_TASK_SERIES_SCHEDULER_UNAVAILABLE
```

后端验收必须覆盖：

1. 非当前审批人获得空 `allowedActions`，且绕过 UI 的动作请求被拒绝。
2. 过期 version 返回 `409 + VERSION_CONFLICT`。
3. 批量审批中任一项失败时，全部状态保持不变。
4. 不可见、停用或不合规的转审候选被拒绝。
5. 阶段运行记录仅返回当前调用人可写字段与可执行动作。
6. 评论删除仅由服务端 `canDelete` 和最终作者校验决定。
7. 周期任务的列表、详情及所有 mutation 成功响应均为具名 DTO，创建人和管理员动作均以服务端
   `allowedActions` 判断；调度器未就绪的激活请求被拒绝。
8. OpenAPI 导出后，上述成功响应不再出现裸 `type: object`。

本轮已用包含上述实现的后端快照刷新 Web `openapi/atom-crm.json`，并执行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`。后续工作是消费这些已发布的 capability 建设前端表单，而非等待后端契约或人工决策。
