# P6 OA、营销与报表：后端契约状态

> 2026-07-29 已从后端 `ebf7ef8` 的真实 `/v3/api-docs` 刷新快照；不再使用历史手写快照。OA、营销、公开营销、仪表盘与报表的成功 JSON 响应均为具名 schema，分页具有具名 `*PageResponse` 与 `objectList` 元素类型，P6 身份、版本、状态、枚举和公开上传能力的关键字段已在 OpenAPI 中声明。前端应只消费此快照并执行 `api:generate`、`api:coverage`、`api:check`。

## 通用规则

1. 每个 P6 JSON 成功响应使用具名 DTO，并由 `/v3/api-docs` 导出字段、必填项、枚举与分页；不得以无字段 `type: object` 或无泛型包装退化 schema。公开 FILE 草稿和上传端点也明确 `application/json` 成功内容类型，二进制上传为 `application/octet-stream`。
2. 所有内部端点按租户、当前成员、记录可见性、字段权限、状态机和数据范围裁决。P6 当前不下发资源级 `allowedActions`；前端只能以 bootstrap 的有效 authority 做粗粒度 UI guard，绝不能由 actor、创建人、收件人或本地数据范围推断资源动作，最终以服务端命令裁决为准。
3. 所有可变资源的读取投影和 mutation 都带非负 `version`。写入必须提交该 version；冲突返回 `409 + VERSION_CONFLICT`，不能由浏览器重试或覆盖。
4. 错误使用稳定 `errCode`，浏览器不直接渲染 `errMsg`。敏感动态字段、审批事实、收件人、内部投递状态、外部凭证与文件存储实现细节不得因为“管理”投影而被无条件回显。

### 已完成的共通语义

- 页面、详情、提交回执和公开表单所依赖的身份、版本、状态、分页与枚举字段已标记 `required`；`DashboardPreferenceResponse.version` 例外地可空，表示该成员尚未保存偏好。
- 公开营销端点不再声明或接受内部 `Authorization`；匿名文件能力必须经必填 `X-Public-Upload-Capability` 传递，且 OpenAPI 明示它不是 Bearer token。
- 公开上传成功 schema、状态枚举与撤销回执已独立于内部附件 DTO；上传 request body 为 `application/octet-stream`。

## 1. OA 表单与 OA 申请

### 1.1 表单管理

`GET /api/v1/oa/forms` 返回 `Pager<OaFormSummary>`；`GET /api/v1/oa/forms/{formId}` 返回完整的
`OaFormDetail`。至少包含 `id`、`name`、`status`、`version`、`fields`、`approvalDefinitionId`（若可见）、
`allowedActions` 和时间。字段必须是具名 `OaFormFieldView`，包括稳定 `code`、展示名、`inputType`、`required`、
受约束的候选/长度/数值范围与 FILE 限制；不能让浏览器按字段名猜类型。

```json
{
  "id": 301,
  "name": "出差申请",
  "status": "INACTIVE",
  "version": 4,
  "fields": [
    {
      "code": "destination",
      "name": "目的地",
      "inputType": "TEXT",
      "required": true,
      "maxLength": 100
    }
  ],
  "approvalDefinitionId": 81,
  "allowedActions": ["UPDATE", "ACTIVATE", "DELETE"]
}
```

- `OaFormStatusUpdateRequest.status`、表单 `status` 和 `allowedActions` 均须为 OpenAPI enum。状态 mutation 返回
  `OaFormMutationResult { id, version, status, allowedActions }`。
- `POST`、`PUT`、`DELETE` 和状态变更必须重新验证字段 code 唯一性、审批定义当前可用性、已有申请/引用、当前成员能力和 version。
- `GET /api/v1/oa/forms/available` 返回当前调用人可发起的 `OaFormAvailableSummary`；
  `GET .../available/{formId}` 返回 `OaFormSubmissionDefinition`。后者只能包含该成员可提交的字段、候选、文件规则与可用审批定义，不能复用管理详情或返回其他成员范围。

### 1.2 申请、预览和文件

`POST /api/v1/oa/requests/preview` 返回具名 `OaRequestPreview`，最少有 `formId`、`executable`、可选稳定
`blockerCode`、安全的审批步骤摘要和 `previewVersion`。提交时必须重新验证预览有效性与字段权限，不能把浏览器传入的
facts 当作最终审批事实。

真实契约使用必填 `formId`、`formVersion`、`definitionId`、`definitionVersion`、`autoApproved` 和安全审批步骤摘要。预览失败由稳定错误码返回；前端不得把成功预览缓存当作提交授权，提交时仍由服务端重新验证。

`POST /api/v1/oa/requests` 返回 `OaRequestMutationResult { id, version, status, formId }`；提交以
`(tenant, actor, idempotencyKey)` 幂等。`GET /api/v1/oa/requests` 返回 `Pager<OaRequestSummary>`，
`GET .../{requestId}` 返回服务器裁决后的 `OaRequestDetail`。详情仅回显当前调用人可看的申请状态、提交时间、字段投影、审批关联摘要和 `allowedActions`；申请人、审批任务 key、隐藏字段和附件元数据必须按读取策略过滤。

OA FILE 字段使用独立的记录/字段作用域草稿流程：

1. `POST /oa/forms/{formId}/file-field-drafts` 返回 `OaFileFieldDraftResponse { draftId, formId, fieldCode, expiresAt }`；只对当前可提交的表单字段创建。
2. 需要上传时返回具名 upload intent（`fileId`、`uploadUrl`、`uploadMethod`、`requiredHeaders`、`expiresAt`），并有最小状态 DTO（`fileId`、`displayName`、`mediaType`、`size`、`status`）。
3. `OaRequestSubmitRequest` 仅可提交同一表单、同一字段、同一未过期草稿内 `UPLOADED` 的 file ID；服务端在提交时复核归属和字段仍可写。
4. 受保护下载继续由带认证的受控 fetch + blob 完成；不得借内部资源 URL 绕过记录可见性。

真实 `OaRequestResponse` 已必填 `id`、表单/审批关联、`approvalStatus`、字段投影、文件投影与 `version`；`OaFormFieldResponse` 也声明了稳定 field code、类型、可用性、排序、候选与访问投影。当前专用 OA FILE 草稿流沿用 P5 的受限 `FileFieldDraftResponse`，前端必须从该服务端草稿响应取得精确 form/field 上下文，不能自行构造文件关联。

当前可用表单的 `USER`、`DEPARTMENT` 字段候选，以及每个 `APPLICANT_SELECT` 审批选择步骤，均提供受表单、租户、当前成员和在职状态约束的 `keyword`、`page`、`size` 查询。前端以这些服务端分页结果构建选择器，不能退回全局成员目录或本地已加载候选过滤。

## 2. OA 公告与收件箱

管理目录 `GET /oa/announcements` 返回 `Pager<OaAnnouncementSummary>`；详情返回
`OaAnnouncementDetail`，其中包含 `id`、`version`、标题、正文/正文摘要、`status`、发布时间/计划时间、
管理者可见的 audience 定义和 `allowedActions`。`PUBLISH`、`SCHEDULE`、`CANCEL_SCHEDULE`、`WITHDRAW`、
`UPDATE`、`DELETE` 必须都由服务端按资源响应的 capability 允许。

个人收件箱不能复用管理详情：

- `GET /oa/announcements/mine` 返回 `Pager<OaAnnouncementInboxItem>`，仅含安全的 `announcementId`、标题/摘要、
  发布/计划状态、可读时间与 `read`；服务端根据收件人和可见性裁决。
- `GET .../mine/{announcementId}` 返回当前收件人的 `OaAnnouncementInboxDetail`；`POST .../read` 返回同 ID 的
  `OaAnnouncementReadResult { announcementId, read: true }` 并可幂等。
- `GET /oa/announcements/unread-count` 返回 `OaAnnouncementUnreadCount { count }`，且 count 为当前调用人
  非负、已授权的未读数量。

所有公告 mutation 返回 `OaAnnouncementMutationResult { id, version, status, allowedActions }`，并重新验证 audience、
调度时间、发布/撤回状态机、当前成员和乐观锁。

公告管理、收件箱、已读回执和未读计数的身份、状态、版本、时间及非负计数已按真实 JSON 字段声明为 required。收件箱资源键为 `id`，已读回执为 `announcementId` 与首次 `readTime`；二者不应混用。

## 3. 营销表单：内部管理与公开应用

### 3.1 内部管理

`GET /marketing-forms` 返回 `Pager<MarketingFormSummary>`；详情返回完整、版本化的
`MarketingFormDetail`，具有 `id`、`publicId`、名称、状态、字段定义、版本、可用统计窗口和
`allowedActions`。`publicId` 可以显示或复制，但不得成为内部记录/租户枚举入口。

`POST`、`PUT`、`DELETE`、`PUT .../status` 成功返回
`MarketingFormMutationResult { id, publicId, version, status, allowedActions }`。字段定义必须指定稳定 code、
展示名、`inputType`、`required`、限制、枚举候选和 FILE policy，且写入时服务端重新校验。

提交趋势与列表分别返回 `MarketingSubmissionTrendResponse` 和 `Pager<MarketingSubmissionSummary>`，仅包含已授权、
聚合或安全化字段；原始匿名提交的敏感字段不能因趋势或导出而默认泄露。

### 3.2 公开表单与匿名文件

公开端点不得要求或接受内部认证、Dev Header、租户/actor 参数，公开应用壳也不得加载内部 `/authorization/me`、
`/navigation` 或内部 Query cache。

- `GET /open/marketing-forms/{publicId}` 返回 `PublicMarketingFormDefinition`：公开标题/说明、可提交字段与
  限制、提交策略、版本或反重放 token。只有 ACTIVE 且公开可访问的表单才返回；不存在与不可访问统一返回安全错误，
  不能泄露租户或内部 status。
- `POST .../submissions` 返回 `PublicMarketingSubmissionResult { submissionId?, accepted, idempotencyKey }` 或等价
  的最小确认 DTO。服务端必须校验 public form、字段约束、来源限制和同一浏览器的幂等键；不得接受任意 internal
  form ID 或跨草稿 file ID。
- `POST .../file-drafts` 返回短时 `PublicMarketingFileDraft`，其中 `draftId`、可用 `fieldCode`、过期时间和
  不可猜测的短期 `uploadCapability` 明确标注。能力仅允许内存持有，不能出现在 URL、日志、持久浏览器存储或分析事件。
- `POST .../upload-intents` 返回 `PublicMarketingUploadIntent { draftId, fieldCode, fileId, uploadUrl, uploadMethod,
requiredHeaders, expiresAt }`；文件内容上传请求不可携带内部身份。`GET .../upload-status` 返回同一草稿/字段/file 的
  `PublicMarketingFileUploadStatus`，至少含 `fileId`、显示名、媒体类型、大小和 `PENDING|UPLOADED|FAILED`。
- 撤销草稿返回 `PublicMarketingFileDraftWithdrawalResult { draftId, withdrawn: true }`。提交时服务端再次验证 file
  的 draft、publicId、fieldCode、过期和 `UPLOADED` 状态，拒绝历史或跨表单 file ID。

公开端应限流并提供稳定的匿名错误码，例如 `PUBLIC_FORM_NOT_AVAILABLE`、`PUBLIC_FORM_RATE_LIMITED`、
`PUBLIC_FILE_CAPABILITY_INVALID`、`PUBLIC_FILE_UPLOAD_INCOMPLETE`。不得把文件存储路径、租户、内部成员或原始异常泄露给匿名调用方。

公开应用所需契约已完成：可渲染字段的必填与类型枚举、提交幂等键与最小回执、短时 draft capability、专用 intent/status/withdrawal DTO，以及二进制 content body 都已在真实快照中声明。字段的最终长度、数值、FILE 容量及反重放验证仍只由服务端执行；浏览器只能用 schema 做交互提示，不能作为安全裁决。

## 4. 仪表盘与报表

`GET /dashboard/preferences` 返回 `DashboardPreferenceResponse`，`PUT` 返回更新后的相同 DTO：仅包含当前成员的
时间范围、数据范围和允许的固定卡片偏好；不得回显成员资料、其他成员偏好或未经授权的数据范围。

`GET /dashboard/overview` 返回 `DashboardOverviewResponse`。每张固定卡片是具名 `DashboardCard`，具有稳定 `key`、
`status: AVAILABLE|UNAVAILABLE`、标题、类型、最小安全数据和可选 `unavailableCode`；单张不可用时必须局部降级，
不能使其他卡片或整个首页失败。

报表严格以 server catalog 驱动：

- `GET /reports/catalog?objectType=...` 返回 `ReportFieldCatalog`；首次可省略 `objectType`，服务端返回当前成员第一个可读来源作为 `objectType`，并只在 `supportedObjectTypes` 中列出该成员可读的来源。对象、可选维度、可选 measure、运算、筛选字段、最大分组/时间范围、数据范围和每个项的稳定 code 都由服务端给出。
- 固定趋势、排行、定义列表/详情、创建/更新、运行分别使用具名 DTO：
  `ReportTrendResponse`、`ReportRankingResponse`、`Pager<ReportDefinitionSummary>`、
  `ReportDefinitionDetail`、`ReportDefinitionMutationResult`、`ReportRunResponse`。
- 浏览器只能提交 catalog 当前下发的维度、measure、聚合、筛选和范围；后端在写入/运行时再次按当前成员字段策略、
  记录可见性和数据范围复核。不可用的字段/维度使用稳定 blocker 或 errCode，而不是静默忽略。

仪表盘 overview、偏好、卡片、点位，以及报表 catalog、趋势、排行、定义、运行及分页投影均已声明实际必填字段和闭合集合。`DashboardPreferenceUpdateRequest.version` 保持可选：首次保存没有现有版本，后续更新仍由服务端按当前版本执行乐观锁校验。catalog 以当前可用字段、维度、measure、operator 和粒度作为浏览器唯一构造来源，服务端继续执行所有上限和组合验证。

## 5. 错误码、OpenAPI 刷新与验收

至少稳定以下错误码：

```text
VERSION_CONFLICT
OA_FORM_ACTION_NOT_ALLOWED
OA_REQUEST_NOT_EXECUTABLE
OA_FILE_DRAFT_INVALID
OA_ANNOUNCEMENT_ACTION_NOT_ALLOWED
MARKETING_FORM_ACTION_NOT_ALLOWED
PUBLIC_FORM_NOT_AVAILABLE
PUBLIC_FORM_RATE_LIMITED
PUBLIC_FILE_CAPABILITY_INVALID
PUBLIC_FILE_UPLOAD_INCOMPLETE
DASHBOARD_CARD_UNAVAILABLE
REPORT_CATALOG_ITEM_NOT_ALLOWED
REPORT_DEFINITION_ACTION_NOT_ALLOWED
```

后端完成后应在真实部署实例上导出 `/v3/api-docs`，确认上述每个端点的 `200` 不再是 `type: object`，然后由前端执行：

```bash
ATOM_CRM_OPENAPI_URL=https://<backend>/v3/api-docs pnpm api:snapshot
pnpm api:generate
pnpm api:coverage
pnpm api:check
```

验收至少覆盖：跨租户/不可见资源拒绝；过期 version 返回 `VERSION_CONFLICT`；个人公告收件箱不泄露 audience；
公开表单不加载内部认证；匿名 FILE capability 过期、跨字段和跨 publicId 均被拒绝；仪表盘单卡不可用局部降级；
报表无法提交 catalog 之外的字段或维度。
