# 本地联调与 E2E 环境

## 正式浏览器登录与找回密码

后端与 Web 必须指向同一站点或受控反向代理，使 `/api` 请求携带 host-only、`HttpOnly`、`SameSite=Strict` 的会话 Cookie。生产必须配置至少 32 字节 base64url 的 `ATOM_AUTHENTICATION_SIGNING_KEY`、HTTPS 下的 `atom.authentication.cookie-secure=true`、`ATOM_AUTHENTICATION_PASSWORD_RESET_URL`（Web 的 `/password-reset/confirm` 绝对落地地址；服务端会附加编码后的 `token` 查询参数）、`ATOM_AUTHENTICATION_PASSWORD_RESET_MAIL_ENABLED=true`、`ATOM_AUTHENTICATION_PASSWORD_RESET_MAIL_FROM` 与标准 `spring.mail.*` SMTP 配置。不可将签名密钥、密码、重置令牌或开发身份 ID 写入 Web `.env`、构建产物或浏览器存储。

发布认证契约时，先重启后端并依次运行 `pnpm api:snapshot`、`pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`。联调至少验证：未登录访问受保护页面跳转 `/login`；正确密码仅列出该成员的活动租户；同一登录 challenge 只能创建一次会话；创建会话后 `/authorization/me` 与 `/navigation` 才加载；退出清除 Cookie；错误密码/过期或已消费 challenge/过期 reset token 返回审阅后的通用反馈；未配邮件投递时 reset 请求明确 503。开发身份仅可通过 Vite 开发模式的 `VITE_ENABLE_DEV_AUTH=true` 和当前标签页 `sessionStorage` 使用，不能替代或改变生产 Cookie 登录。

## 首次安装管理员

首次部署必须先让后端 Flyway 完成迁移，再从与 API 同源的 Web `/setup` 创建工作区 1 的 owner 管理员；系统没有默认账号、密码或部署环境变量形式的 bootstrap 凭据。反向代理必须允许同源的 `GET /api/v1/installation` 与 `POST /api/v1/installation/tenant-admin`，并继续保留认证会话响应中的 `Set-Cookie`。前端快照应来自已包含这两个路由的同一后端实例，依次运行 `pnpm api:snapshot`、`pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`。验收应覆盖：空库或仅有无登录用户的历史租户数据时显示表单；第一次提交创建会话并进入工作区；第二次或并发提交只得到已完成状态；已有可登录 active owner 的升级库不开放表单。生产 HTTPS、会话签名密钥和 Cookie 安全属性仍遵循上节正式认证要求。

产品和合同列表的部署快照必须发布 `ProductPageResponse`、`ContractPageResponse`，其 `objectList` 分别只能是字段裁决后的 `ProductResponse`、`ContractResponse`。刷新后运行 `pnpm api:snapshot`、`pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 及产品/合同页面与 API client 回归；具名分页不改变金额、价格、折扣、协作者、动态字段、数据范围或字段可见性的服务端裁决，前端仍应做既有窄投影解码。

Work 任务和通知部署快照必须为 `POST /api/v1/work/tasks/query`、`GET /api/v1/work/tasks/{taskId}/comments`、`GET /api/v1/work/task-series/{seriesId}/occurrences` 与 `GET /api/v1/notifications` 分别发布 `WorkTaskPageResponse`、`WorkTaskCommentPageResponse`、`WorkTaskSeriesOccurrencePageResponse`、`NotificationPageResponse`，其 `objectList` 只能为已按当前成员资格和字段范围裁决后的 `WorkTaskResponse`、`WorkTaskCommentResponse`、`WorkTaskSeriesOccurrenceResponse`、`NotificationResponse`。刷新后运行 `pnpm api:snapshot`、`pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 以及 Work/通知 API client、模型和页面回归；前端仍只解码既有窄投影，不把任务参与人、评论作者、通知任务 ID、提醒投影、外部投递或生命周期字段写入缓存或界面。

跟进时间线的部署快照必须为 `POST /api/v1/activities/query` 发布 `ActivityPageResponse`，其 `objectList` 只能是服务端对当前成员与目标记录裁决后的 `ActivityResponse`。刷新后运行 `pnpm api:snapshot`、`pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 及活动时间线/API client 回归；具名分页不改变目标记录可见性、活动权限或字段策略，前端继续丢弃作者、关系、版本、创建/更新时间和其他未审阅字段。

销售管线管理的部署快照必须为 `POST /api/v1/opportunity-pipelines/query` 和 `POST /api/v1/opportunity-pipelines/{pipelineId}/stages/query` 分别发布 `OpportunityPipelinePageResponse`、`OpportunityPipelineStagePageResponse`，其 `objectList` 只能为服务端租户目录中的 `OpportunityPipelineResponse`、`OpportunityPipelineStageResponse`。刷新后运行 `pnpm api:snapshot`、`pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 及管线管理页/API client 回归；前端继续丢弃创建时间、更新时间等未用于现有窄目录投影的值，不能因类型具名化推断成员权限或商机数据范围。

线索和联系人列表的部署快照必须为 `GET /api/v1/leads`、`POST /api/v1/leads/query`、`GET /api/v1/contacts` 与 `POST /api/v1/contacts/query` 同时发布 `LeadPageResponse`、`ContactPageResponse`，且其 `objectList` 分别只能是字段裁决后的 `LeadResponse`、`ContactResponse`。刷新后运行 `pnpm api:snapshot`、`pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 及线索/联系人页面与 API client 回归；前端仍以既有窄投影解码，不能因具名分页显示、缓存或推断动态字段、地址、协作者、关联对象、字段权限或数据范围。

部门成员工作台依赖同一后端实例发布 `DepartmentMemberProfilePageResponse`：刷新快照后运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 和组织页面/API client 回归。联调应验证 `departmentName` 始终由服务端成员资格解析，只有 `users:read`/`roles:read` 分别存在时才回显 `loginName`/活动 `roleNames`；前端不得从用户目录、角色缓存或部门树补造这两项。

## 线索与联系人批量操作契约刷新

部署包含线索或联系人列表批量操作时，快照必须同时含 `leads/batch/{owner,delete}` 与 `contacts/batch/{owner,delete}`。刷新后运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 和 API client 回归；联调必须覆盖一个过期 version、一个不可见目标、一个仍有活动下级的删除目标、无负责人分配范围以及整批不得部分更新。成员选择器只能读取当前身份服务端可见的在职成员；禁止手写 `src/api/generated`、输入 actor ID 或在旧快照上隐藏操作。

商机批量操作要求同一快照同时发布 `opportunities/batch/{owner,delete}`；联调同样覆盖 1–100 目标、旧 version、不可见记录、无可分配范围和整批回滚。成员候选只能来自当前身份受限目录，前端不得用列表或详情推断负责人资格。

## 回款与发票批量操作契约刷新

部署包含回款或发票列表批量操作时，快照必须同时含 `receivables/batch/{owner,delete}` 与 `invoices/batch/{owner,reset,delete}`。刷新后运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 和 API client 回归；联调必须覆盖一个过期 version、一个不可见目标、发票状态不符、无负责人分配范围以及整批不得部分更新。禁止手写 `src/api/generated` 或以旧快照隐藏操作。

## 合同批量操作契约刷新

部署包含合同批量转移、选中导出、团队成员或删除时，前端快照必须来自同时发布 `PUT /api/v1/contracts/batch/owner`、`POST /api/v1/contracts/batch/export/csv`、`PUT`/`DELETE /api/v1/contracts/batch/collaborators` 和 `POST /api/v1/contracts/batch/delete` 的同一后端实例。刷新后运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 和 API client 回归；禁止手工修改 `src/api/generated` 或在旧快照上隐藏操作。联调需覆盖至多 100 个目标、一个过期 version、不可见合同、缺少 `contracts:read` 或 `contracts:export`、被遮罩导出列、不可分配成员和一个存在发票/回款/计划依赖的合同均导致对应动作失败；团队添加只能接受在职成员并保留未指名协作者，接受 null（不限）或未来/当天的 inclusive `effectiveUntil`，到期后该成员不得再通过协作者身份读取或写入合同；移除拒绝负责人且对不存在协作者保持幂等。导出必须验证仅当前列表 ID/version 可被提交、响应使用认证 Blob、文件无关系/自定义字段且被公式保护，不能缓存或暴露可复用下载 URL。

## 市场活动关联对象能力目录联调

后端从同一隔离实例发布 `MarketingActivityConfigurationOptionsResponse.relatedObjectTypes[]`，每项必须具名包含闭合 `code`、`displayName` 与非空 `supportsMarketingForm`，并发布列表中一项的 `defaultRelatedObjectType`。刷新快照后执行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 以及市场活动模型/页面回归。联调应验证目录加载失败时前端显示错误并关闭关联对象筛选、编辑选择与保存；新建默认值、内嵌营销表单只在服务端发布和生成 `MarketingFormTargetObjectType` 支持时使用，浏览器不默认客户、扩展对象或公开表单能力。

## 仪表盘趋势图形联调

趋势面板只消费同一 `DashboardOverviewResponse.cards[].points` 中当前指标的服务端时间点。以有概览读取权限且该指标为 `AVAILABLE`、存在时间点的同一开发身份联调时，默认应显示金额折线图；切换“柱状图”或切回“折线图”只能改变图形呈现，不得写入 URL、偏好或浏览器持久化存储，也不得发起第二次概览请求、重排、补点或重算金额/数量。图形必须保留具名 SVG 标题，辅助技术可读取每个服务端周期的金额和数量；空 `points` 与 `UNAVAILABLE` 继续使用原有非图形状态，不能伪造坐标或零值。可运行：

```bash
./node_modules/.bin/vitest run src/features/dashboard/components/dashboard-trend-panel.test.tsx
```

## 仪表盘提醒卡显示偏好联调

后端必须从同一隔离实例发布 `DashboardPreferenceResponse.hiddenModules`，并仅允许其生成枚举 `CUSTOMER_CONTACT_REMINDER`；迁移后必须重启 `start`，刷新 OpenAPI 快照、生成类型和 API 覆盖记录。联调应以有 `reports:read` 的同一成员验证：默认或空列表显示提醒卡；“关闭”携带完整时间/范围/模块/version 偏好并在成功后移除卡片；工具栏“显示客户遗忘提醒”使用更新后的 version 恢复卡片；陈旧 version 和未知模块由服务端给出稳定失败，浏览器保留当前页面状态而不自动重试。该流程不调用客户或活动列表，也不向 URL 或浏览器持久化存储写入客户明细或关闭标记。可运行：

```bash
./node_modules/.bin/vitest run src/features/dashboard/model/dashboard-preference.test.ts src/features/dashboard/components/dashboard-preference-card.test.tsx src/features/dashboard/components/dashboard-customer-contact-reminder.test.tsx src/features/dashboard/pages/dashboard-page.test.tsx
```

## 仪表盘客户联系提醒联调

后端必须从同一隔离实例在 `DashboardOverviewResponse` 中发布具名 `customerContactReminder`、`CustomerContactReminderResponse` 与 `CustomerContactReminderBucketResponse`，并在重启 `start` 后刷新快照。前端依次执行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 及提醒卡/API client 回归。联调须验证六个固定档位只统计当前身份可见的活动客户；前五档由最新有效客户跟进或客户创建时间回退产生，逾期档只由最新有效跟进的过期下次联系时间产生。缺少客户或活动读取、成员资格或任一必要未遮罩客户字段时，必须返回并展示不含档位的 `UNAVAILABLE`；浏览器不得从客户列表、活动缓存或本地时间补零、补档或展示客户明细。

## 仪表盘销售漏斗联调

后端必须从同一隔离实例在 `DashboardOverviewResponse` 中发布具名 `salesFunnel`、`SalesFunnelResponse`、`SalesFunnelPipelineResponse` 与 `SalesFunnelStageResponse`，并在重启 `start` 后刷新快照。前端依次执行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 及销售漏斗组件/API client 回归。联调须验证流程和阶段仅来自当前身份可读的活动目录，汇总只使用当前偏好时间窗内可见商机，流程切换与金额/数量模式不写 URL、不发二次查询；缺少流程目录、商机读取能力或任一必要未遮罩字段时必须以不含数值的 `UNAVAILABLE` 失败关闭，空目录返回 `EMPTY`，不能展示本地零值或缓存值。

## 联系人新建关联客户

该流程不需要刷新 OpenAPI：它复用既有 `POST /api/v1/customers/query`、`POST /api/v1/customers`、`GET /api/v1/customers/{customerId}` 和 `POST /api/v1/contacts`。联调需确认拥有 `contacts:write + customers:read` 的成员在全局联系人新建页只能从受限客户目录选择候选，并且每次选择都会以当前身份重新读取详情，只有精确匹配的服务端 ID 才会写入创建请求；确认期间表单不可提交。拥有 `customers:write + contacts:write + customers:read` 的成员从客户创建续建时也走同一复核路径。缺少 `contacts:write` 时不显示续建按钮；缺少 `customers:read`、篡改 `customerId` 或客户不可见时关闭已请求的关联创建；篡改 `returnTo` 时只回落联系人列表。可运行：

```bash
./node_modules/.bin/vitest run src/features/customers/components/customer-base-form.test.tsx src/features/contacts/model/contact-form.test.ts src/features/contacts/model/contact-create-route.test.ts
./node_modules/.bin/playwright test tests/e2e/customer-create-contact.spec.ts
./node_modules/.bin/playwright test tests/e2e/contact-create-customer.spec.ts
```

## 客户新建负责人选择

客户新建的可选负责人不需要刷新 OpenAPI：它复用 `GET /api/v1/organization/members` 与既有 `POST /api/v1/customers`。联调需确认只有同时具备 `customers:assign + organization:read` 的成员才会看到负责人目录；候选仅是当前身份服务端可见且在职的成员，关键词请求不得改为浏览器本地过滤。选择后仅在本次创建请求发送该 `ownerActorId`，不选择、目录失败或缺少任一权限时均省略，由服务端默认当前成员。可运行：

```bash
./node_modules/.bin/vitest run src/features/customers/model/customer-form.test.ts src/features/customers/components/customer-base-form.test.tsx
./node_modules/.bin/playwright test tests/e2e/customer-create-owner.spec.ts
```

## 客户新建标签

客户新建标签不需要刷新 OpenAPI：它复用 `GET /api/v1/customers/tags` 与既有 `POST /api/v1/customers`。联调需确认只有 `customers:read` 且 TAGS 字段未遮罩时才请求受限候选目录；用户仍可明确输入新标签，客户端只拒绝空白、超长或规范化重复值。目录失败不能伪造候选或清除用户草稿，最终由服务端复核 TAGS 写权限。可运行：

```bash
./node_modules/.bin/playwright test tests/e2e/customer-create.spec.ts
```

客户新建的可选上级客户不需要刷新 OpenAPI：它复用 `POST /api/v1/customers/query`、`GET /api/v1/customers/{customerId}` 与既有 `POST /api/v1/customers`。联调需确认候选仅在 `customers:read` 下显示且每次选择都以当前身份重新读取详情；只有精确匹配的服务端正 ID 才会写入 `parentCustomerId`，确认期间表单不可提交。缺少读取权限、详情不可见或读取失败时关闭已请求层级创建；清除选择会省略字段，服务端继续复核客户可见性、循环层级和容量限制。可运行 `./node_modules/.bin/playwright test tests/e2e/customer-create.spec.ts`。

客户新建详细地址不需要刷新 OpenAPI：它复用既有 `CustomerCreateRequest.addresses` 与 `GET /api/v1/customers/{customerId}` 回显。联调需确认只输入地区、城市或邮编时不能提交，详细地址为空时地址字段整体省略；填写后仅发送一个 `primary=true` 的地址记录，服务端继续复核 ADDRESSES 字段写权限、长度、地址容量与区域格式。详情只能呈现服务端可见或已脱敏的地址回显，不能从本地创建草稿补齐。可运行 `./node_modules/.bin/playwright test tests/e2e/customer-create.spec.ts`。

客户新建自定义字段不需要刷新 OpenAPI：它复用 `GET /api/v1/fields/objects/CUSTOMER?includeInactive=false`、`GET /api/v1/organization/members`、`GET /api/v1/organization/departments`、`POST /api/v1/file-field-drafts`、命名上传 intent/status 以及既有 `POST /api/v1/customers`。联调需确认仅 `fields:read` 才读取当前身份字段目录；Web 按目录 options/required/order 提交明确填写的标量 `customFields`，USER/DEPARTMENT 仅在 `organization:read` 下从受限目录选取 ID，FILE 仅在 `files:write` 下经同一 CUSTOMER 草稿、上传意图和 `UPLOADED` 状态提交同一 draft 的文件 ID。必填候选目录、必填文件权限/上传或字段目录失败时保持关闭；RELATION 仍因后端没有客户所属模块而失败关闭，绝不降级为自由文本。后端继续按当前成员的字段写策略、字段类型、选项、成员/部门有效性、文件草稿归属、必填性和数据范围逐项验证。可运行 `./node_modules/.bin/vitest run src/api/client/api-client.test.ts src/components/dynamic-field/model/custom-field-form.test.ts src/features/customers/model/customer-form.test.ts src/features/customers/components/customer-create-file-field-controls.test.tsx`。

客户详情自定义字段编辑同样不需要刷新 OpenAPI：它复用既有 `GET /api/v1/fields/objects/CUSTOMER?includeInactive=false`、组织受限目录和 `PUT /api/v1/customers/{customerId}`。联调须确认只有 `customers:write + fields:read` 才出现编辑器；表单从空白开始，仅提交本次明确填写或清除的 ACTIVE 非内置标量 `customFields` code 与详情原始 version，未触碰 code 必须由服务端保留。USER/DEPARTMENT 候选仍需 `organization:read`，目录异常时禁用保存；FILE 与 RELATION 没有替代写入入口。后端继续裁决记录可见性、字段写策略、候选有效性、必填性和乐观锁。可运行 `./node_modules/.bin/vitest run src/features/customers/model/customer-form.test.ts`。

发票与回款计划的基础读写成功响应也必须随部署同步刷新：发票查询使用 `InvoicePageResponse`，详情、创建、编辑、负责人变更、开票与重置使用 `InvoiceResponse`；回款计划查询使用 `ReceivablePlanPageResponse`，详情、创建、编辑使用 `ReceivablePlanResponse`，可关联计划和批量创建分别返回具名响应数组。它们仍是字段裁决后的窄投影，不能据此补造金额、客户/合同关系、权限或数据范围。变更后运行 `pnpm api:snapshot`、`pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 以及相应 API 与页面回归。

联系人新建负责人同样复用 `GET /api/v1/organization/members` 与 `POST /api/v1/contacts`：仅 `contacts:assign + organization:read` 显示受限在职成员目录，明确选择才发送 `ownerActorId`，否则由服务端默认当前成员。可运行 `./node_modules/.bin/playwright test tests/e2e/contact-create-owner.spec.ts`。

联系人全局新建的标签候选使用 `GET /api/v1/contacts/tags`，创建继续使用既有 `POST /api/v1/contacts`。目录仅在 `contacts:read` 且 TAGS 字段未遮罩时请求；联调需验证用户输入或选择的有效标签才发送，目录异常不伪造候选也不丢弃已经明确输入的草稿，服务端继续校验 TAGS 写权限。可运行 `./node_modules/.bin/playwright test tests/e2e/contact-create.spec.ts`。

联系人新建自定义字段不需要刷新 OpenAPI：它复用 `GET /api/v1/fields/objects/CONTACT?includeInactive=false`、`GET /api/v1/organization/members`、`GET /api/v1/organization/departments`、`POST /api/v1/file-field-drafts`、命名上传 intent/status 与既有 `POST /api/v1/contacts`。联调需确认仅 `fields:read` 才读取当前身份字段目录；Web 按目录 options/required/order 提交明确填写的标量 `customFields`，USER/DEPARTMENT 仅在 `organization:read` 下从受限目录选取 ID，FILE 仅在 `files:write` 下经同一 CONTACT 草稿、上传意图和 `UPLOADED` 状态提交同一 draft 的文件 ID。必填候选目录、必填文件权限/上传或字段目录失败时保持关闭；RELATION 因后端没有联系人所属模块而失败关闭，绝不降级为自由文本。后端继续按当前成员的字段写策略、字段类型、选项、成员/部门有效性、文件草稿归属、必填性和数据范围逐项验证。可运行 `./node_modules/.bin/vitest run src/features/contacts/model/contact-form.test.ts src/features/contacts/components/contact-base-form.test.tsx src/components/dynamic-field/model/custom-field-form.test.ts src/features/customers/components/customer-create-file-field-controls.test.tsx`。

联系人详情自定义字段编辑同样不需要刷新 OpenAPI：它复用既有 `GET /api/v1/fields/objects/CONTACT?includeInactive=false`、组织受限目录和 `PUT /api/v1/contacts/{contactId}`。联调须确认只有 `contacts:write + fields:read` 才出现编辑器；表单从空白开始，仅提交本次明确填写或清除的 ACTIVE 非内置标量 `customFields` code 与详情原始 version，未触碰 code 必须由服务端保留。USER/DEPARTMENT 候选仍需 `organization:read`，目录异常时禁用保存；FILE 与 RELATION 没有替代写入入口。后端继续裁决记录可见性、字段写策略、候选有效性、必填性和乐观锁。可运行 `./node_modules/.bin/vitest run src/features/contacts/model/contact-form.test.ts`。

线索详情自定义字段编辑同样不需要刷新 OpenAPI：它复用既有 `GET /api/v1/fields/objects/LEAD?includeInactive=false`、组织受限目录和 `PUT /api/v1/leads/{leadId}`。联调须确认只有 `leads:write + fields:read` 才出现编辑器；表单从空白开始，仅提交本次明确填写或清除的 ACTIVE 非内置标量 `customFields` code 与详情原始 version，未触碰 code 必须由服务端保留。USER/DEPARTMENT 候选仍需 `organization:read`，目录异常时禁用保存；FILE 与 RELATION 没有替代写入入口。后端继续裁决记录可见性、字段写策略、候选有效性、必填性和乐观锁。可运行 `./node_modules/.bin/vitest run src/features/leads/model/lead-form.test.ts`。

线索新建负责人同样复用 `GET /api/v1/organization/members` 与 `POST /api/v1/leads`：仅 `leads:assign + organization:read` 显示受限在职成员目录，明确选择才发送 `ownerActorId`，否则由服务端默认当前成员。

线索新建自定义字段不需要刷新 OpenAPI：它复用 `GET /api/v1/fields/objects/LEAD?includeInactive=false`、`GET /api/v1/organization/members`、`GET /api/v1/organization/departments`、`POST /api/v1/file-field-drafts`、命名上传 intent/status 与既有 `POST /api/v1/leads`。联调需确认仅 `fields:read` 才读取当前身份字段目录；Web 按目录 options/required/order 提交明确填写的标量 `customFields`，USER/DEPARTMENT 仅在 `organization:read` 下从受限目录选取 ID，FILE 仅在 `files:write` 下经同一 LEAD 草稿、上传意图和 `UPLOADED` 状态提交同一 draft 的文件 ID。必填候选目录、必填文件权限/上传或字段目录失败时保持关闭；RELATION 因后端没有线索所属模块而失败关闭，绝不降级为自由文本。后端继续按当前成员的字段写策略、字段类型、选项、成员/部门有效性、文件草稿归属、必填性和数据范围逐项验证。可运行 `./node_modules/.bin/vitest run src/features/leads/model/lead-form.test.ts src/components/dynamic-field/model/custom-field-form.test.ts src/features/customers/components/customer-create-file-field-controls.test.tsx`。

线索全局新建的可选客户关联复用 `GET/POST /api/v1/customers` 目录与 `GET /api/v1/customers/{customerId}` 详情确认，再调用 `POST /api/v1/leads`。仅在 `leads:write + customers:read` 下显示目录；联调必须验证选择后详情精确回显同一正 ID 才允许发送 `customerId`，清除选择会省略该字段，目录或详情失败时不会把已选择关系降级为未关联创建。标签候选使用 `GET /api/v1/leads/tags`；它仅在 `leads:read` 且 TAGS 字段未遮罩时请求，目录异常不阻断用户明确输入新标签，但最终创建仍由服务端校验。可运行 `./node_modules/.bin/playwright test tests/e2e/lead-create.spec.ts`。

商机新建负责人同样复用 `GET /api/v1/organization/members` 与 `POST /api/v1/opportunities`：仅 `opportunities:assign + organization:read` 显示受限在职成员目录，明确选择才发送 `ownerActorId`，否则由服务端默认当前成员。联调还应验证客户、管线与阶段继续只能从各自服务端目录选择，成员目录失败不会把负责人降级为浏览器推断值。可运行 `./node_modules/.bin/playwright test tests/e2e/opportunity-create.spec.ts`。

商机新建的可选联系人复用 `GET /api/v1/contacts` 与既有 `POST /api/v1/opportunities`：只有 `contacts:read` 时才显示选择入口，且必须先选定客户；候选查询固定携带该客户 ID，并仅保留服务端回显同一客户的联系人。创建请求只发送页面中明确选择的去重正 ID，首要联系人只能从这组已选联系人中产生。后端迁移 `V96__enforce_opportunity_contact_customer.sql` 后，创建、完整客户替换、联系人替换和首要联系人更新都会复核可见联系人属于目标客户，且复合外键会拒绝绕过 HTTP 或并发写入造成的跨客户关联。联调应验证切换客户会清空联系人草稿、跨客户或不可见联系人被拒绝，并在隔离 MySQL 上运行服务端 `OpportunityIntegrationTest`；此行为不改变 OpenAPI schema。可运行 `./node_modules/.bin/playwright test tests/e2e/opportunity-create.spec.ts`。

商机新建的预计成交日期、预计成交金额、下次联系时间和说明复用既有 `OpportunityCreateRequest`，不新增目录或权限推断。四项都保持可选：空白不发送，说明会修剪空白；金额仅接受 `0..Number.MAX_SAFE_INTEGER` 的有限数，日期与时间仅由受控日期组件序列化。浏览器不计算金额、折扣、税率或默认联系时间；后端继续按每个已发送字段的写入策略校验。运行 `src/features/opportunities/model/opportunity-form.test.ts` 与商机创建 E2E 回归。

商机新建自定义字段不需要刷新 OpenAPI：它复用 `GET /api/v1/fields/objects/OPPORTUNITY?includeInactive=false`、`GET /api/v1/organization/members`、`GET /api/v1/organization/departments`、`POST /api/v1/file-field-drafts`、命名上传 intent/status 与既有 `POST /api/v1/opportunities`。联调需确认仅 `fields:read` 才读取当前身份字段目录；Web 按目录 options/required/order 提交明确填写的标量 `customFields`，USER/DEPARTMENT 仅在 `organization:read` 下从受限目录选取 ID，FILE 仅在 `files:write` 下经同一 OPPORTUNITY 草稿、上传意图和 `UPLOADED` 状态提交同一 draft 的文件 ID。必填候选目录、必填文件权限/上传或字段目录失败时保持关闭；RELATION 因后端没有商机所属模块而失败关闭，绝不降级为自由文本。后端继续按当前成员的字段写策略、字段类型、选项、成员/部门有效性、文件草稿归属、必填性和数据范围逐项验证。可运行 `./node_modules/.bin/vitest run src/features/opportunities/model/opportunity-form.test.ts src/components/dynamic-field/model/custom-field-form.test.ts src/features/customers/components/customer-create-file-field-controls.test.tsx --maxWorkers=1 --no-file-parallelism`。

## 浏览器支持矩阵

`vite.config.ts` 显式固定 `build.target`，不使用 Vite 的 `baseline-widely-available` 默认值——该关键字的浏览器下限会随 Vite 大版本移动，会在没有任何本仓库改动的情况下改变实际支持范围。

| 浏览器              | 最低版本 |
| ------------------- | -------- |
| Chrome              | 107      |
| Edge                | 107      |
| Firefox             | 104      |
| Safari / iOS Safari | 16       |

调整该矩阵时同时修改 `vite.config.ts` 的 `build.target` 与本表。仓库没有 browserslist 配置，`build.target` 是唯一来源。

构建与测试要求 Node.js 26.13.0 或更高、pnpm 12.16.1 或更高；仓库固定使用 `.node-version` 和 `package.json#packageManager` 中的版本，CI 直接读取这两个来源。Docker 构建使用同版本 Node Alpine 镜像，并从 `packageManager` 安装 pnpm；Node 26 不再随附 Corepack。

### 2026-10-29 依赖升级

直接运行依赖与开发工具按 npm `latest` 稳定标签升级并精确锁定（下述 TypeScript API 兼容依赖除外），包含 React 19.3.1、React Router 8.5.1、Ant Design 6.6.8、Vite 8.3.5、ESLint 10.13.0 与 Vitest 5.0.5；传递依赖同步更新到上游允许范围内的最新版本。Vite 8 使用 Rolldown/Oxc；上表的显式浏览器目标继续生效。React 渲染器独立分块，继续执行单个 JS 资产不超过 100 KiB gzip 的既有预算。生产容器使用 Nginx 1.31.8 Alpine 官方主线镜像。

应用类型检查使用 `typescript-native` 别名安装的 TypeScript 7.0.2，并由 `pnpm typecheck` 显式调用，避免两个编译器的 `tsc` 命令覆盖彼此。TypeScript 7 暂无旧 JavaScript 编译器 API；`openapi-typescript@7.13.0` 的 peer 要求为 `^5.x`，`typescript-eslint@8.72.1` 为 `>=4.8.4 <6.1.0`，因此工具链的 `typescript` 保留两者共同支持的 5.9.3。待上游支持后再移除此兼容依赖，不关闭严格 peer 检查或手工修改生成类型。参见 [TypeScript 7 发布说明](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)。

pnpm 的精确版本与严格 peer 设置位于 `pnpm-workspace.yaml`；pnpm 12 不再从 `.npmrc` 读取这些设置。新环境运行 `pnpm install --frozen-lockfile`，再执行格式、lint、类型、单测、构建、`bundle:check`、API 生成漂移和浏览器可访问性检查。完整业务 E2E 仍需下文约定的隔离后端与数据库；本次不改变后端及其数据库版本。

## 生产静态部署与同源代理

`Dockerfile` 构建的是不含开发身份的静态 SPA 镜像；运行时由 Nginx 将同源 `/api/` 转发给生产认证后的后端或网关。镜像不提供、存储或注入人员凭证，也会在代理层清空 `X-Dev-User-Id` 和 `X-Dev-Tenant-Id`。生产认证、Cookie 属性、SSO 回调、TLS 终止、限流和审计仍属于身份网关与后端的责任，不能通过 Web 容器模拟。

`pnpm build` 根据本次 `build/client/index.html` 中的内联启动脚本生成精确 SHA-256 CSP allowlist，并输出 `build/nginx/default.conf.template`；Docker 将它与同一次构建的静态文件一起复制。不能直接部署含占位符的源模板，也不能混用不同构建的 HTML 与配置。`script-src` 只允许同源脚本及这些哈希，不启用 `unsafe-inline` 或 `unsafe-eval`。自行托管静态文件时，也需将生成配置中的 CSP 同步到网关。

CI 构建并启动真实生产容器，然后运行 `pnpm test:e2e:production`，验证登录页 hydration、懒加载路由导航和 CSP 对未知内联脚本的拦截。该测试只模拟安装状态，不连接业务后端。默认目标为 `http://127.0.0.1:18089`，本地已启动其他端口的生产容器时可用 `ATOM_CRM_WEB_E2E_BASE_URL` 指定地址。

```bash
docker build -t atom-crm-web:local .
docker run --rm -p 8088:8080 \
  -e ATOM_CRM_API_UPSTREAM=http://host.docker.internal:8080 \
  atom-crm-web:local
```

部署环境必须将 `ATOM_CRM_API_UPSTREAM` 设为受审查的内部 HTTP(S) 上游地址，例如 `https://api.internal.example`；不要把它设为浏览器可控输入。容器使用 `8080` 端口，`/assets/` 以长期不可变缓存提供，`index.html` 不缓存，并以 history fallback 支持 React Router 的深链接。它发送 `nosniff`、同源嵌入限制、Referrer Policy、受控地理位置权限和 CSP：脚本、API、表单均限于同源，图片可使用受控的 `data:`/`blob:`，服务端验证后的嵌入页面仅允许 HTTPS frame。若由外层 Ingress/Nginx 提供 TLS，可保留此容器的 HTTP 上游；它必须转发 `X-Forwarded-Proto`，并由后端/认证网关信任范围配置决定是否采纳。部署前运行 `pnpm build`，不要在 build 或 image 环境传入 `VITE_ENABLE_DEV_AUTH=true`；Vite 会拒绝该生产构建。

`pnpm bundle:check` 必须在 `pnpm build` 后运行。它读取实际的 `build/client` 产物，确认其中不存在开发身份 Header、开发 sessionStorage 键、开发开关或 `/dev/session` 路由，并将任一浏览器 JavaScript 资源限制为 100 KiB gzip。当前构建会按路由分出工作台、用户管理等独立资源；该预算同时约束共享依赖膨胀。CI 在构建完成后自动执行此检查。

部署后可使用具有 `organization:request` 的真实生产会话验证 `/organization/tenants` 只展示认证服务已授权的访问目录；页面不提供会话切换按钮。若产品要求切换生产租户，身份网关必须签发新的受信凭据并使浏览器重新完成 `/authorization/me`、`/navigation` 与 identity 隔离的查询加载，不能让 Nginx、SPA 或 API 代理替换租户 Header。

## 下属负责人场景联调

后端发布 `CustomerQueryRequest`、`LeadQueryRequest`、`ContactQueryRequest`、`ContractQueryRequest`、`ReceivableQueryRequest`、`InvoiceQueryRequest`、`ReturnVisitQueryRequest` 与 `CustomerCsvExportRequest`、`LeadCsvExportRequest` 的 `subordinateOwnerOnly` 后，必须先以同一后端实例重新安装 reactor 并刷新本仓库快照，再执行 `pnpm api:generate`、`pnpm api:coverage` 和 `pnpm api:check`。前端只允许将 `scene=subordinates` 映射为该布尔字段；客户和线索导出也只透传同一个已生成字段。联调必须验证它不能与 `ownerActorId` 组合、无活动后代时列表和导出均为空，并且租户、本人或同部门范围不会被误解释为下属范围。

## 客户、线索、联系人、商机与产品临时高级筛选联调

后端必须同时发布 `POST /api/v1/customers/query`、`CustomerQueryRequest.conditions`、`CustomerCsvExportRequest.conditions`、`POST /api/v1/leads/query`、`LeadQueryRequest.conditions`、`LeadCsvExportRequest.conditions`、`POST /api/v1/contacts/query`、`ContactQueryRequest.conditions`、`ContactCsvExportRequest.conditions`、`OpportunityQueryRequest.conditions` 与 `ProductQueryRequest.conditions`，并在相应查询与客户/线索/联系人导出端拒绝 `savedViewId` 与非空 `conditions` 的组合。刷新快照后执行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 及 API client 回归。前端只能在当前页面内存保存未持久化条件，不能把条件值写入 URL 或持久浏览器存储；列表使用 body 查询，客户、线索和联系人导出复用同一条件集合。用户明确“保存为筛选方案”时，前端改走既有 `POST /api/v1/saved-views`，且只能采用服务端字段目录已允许的条件，成功后只使用回显的方案 ID。联调必须验证字段目录、字段读取/脱敏策略、无效操作符和值、重复条件、联系人或商机关系可见性、产品分类有效性与保存视图互斥都会由服务端拒绝，且清除筛选后列表和导出都恢复为默认/显式保存视图范围。

## CRM 动态列表字段联调

客户、线索、联系人、商机和产品不需要新端点：复用 `GET /api/v1/fields/objects/{objectType}?includeInactive=false`、`GET/PUT /api/v1/fields/objects/{objectType}/layout` 与五个既有列表查询。联调须验证仅在 `fields:read` 下请求字段目录和显示字段设置；目录中的 ACTIVE、非内置、非 FILE 自定义字段才进入桌面列候选，列表值只能来自同一查询响应已按当前调用者字段策略过滤和脱敏的 `customFields`。字段目录不可用或字段停用时不得显示或补全值；值未回显时保持空值。保存布局不得改变 URL、数据范围、动态排序或过滤能力。切换角色、租户或字段策略后必须以 identity 分区重新读取列表、目录和布局，避免复用先前调用者的字段标题或值。

## 合同、回款、发票与回访高级筛选联调

后端必须从同一实例发布 `ContractQueryRequest`、`ReceivableQueryRequest`、`InvoiceQueryRequest` 和 `ReturnVisitQueryRequest` 的 `savedViewId` 与 `conditions`，并由各自 `POST /query` 在服务端处理。刷新快照后依次运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 和 API client 回归。前端只能把临时条件放在当前页面内存并用 body 提交，不得写入 URL 或浏览器持久化；`savedView` URL 只保存方案标识。联调必须验证保存视图对象类型/归属、字段目录及读取/脱敏策略、重复字段、非法操作符和值、关系对象当前可见性和跨租户 ID 均由服务端拒绝，且条件与既有数据范围、负责人场景、客户/合同/计划关系筛选相交执行。

## 回款与回访审批状态投影联调

后端必须从同一隔离实例将 `approvalStatus` 明确发布到回款与回访的列表、详情及相应写入响应，类型为可空 `PENDING|APPROVED|REJECTED|WITHDRAWN|CANCELLED`；它表示当前调用者已可见业务记录的最新审批实例状态，不替代业务生命周期或下发审批 action。刷新快照后运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、API client 回归以及回款/回访投影模型测试。联调须验证跨租户、不可见或无审批记录不泄露实例信息；发起审批成功后，同一身份下的记录详情和所有回款/回访列表都会刷新该投影。业务列表不得依据此字段显示审批按钮或批量动作；批准、驳回等操作仍只经审批待办的服务端 capability + version 执行。

## 回访形式、满意度与客户反馈联调

后端先执行 `V95__add_return_visit_form_and_satisfaction.sql`，并从隔离 MySQL 实例发布 `ReturnVisitCreateRequest`、`ReturnVisitUpdateRequest` 与 `ReturnVisitResponse` 中的 `visitForm` 和 `satisfaction` 闭合枚举。`visitForm` 仅为 `IN_PERSON|PHONE|SMS|EMAIL|WECHAT`，`satisfaction` 仅为 `VERY_SATISFIED|SATISFIED|NEUTRAL|DISSATISFIED|VERY_DISSATISFIED`；更新请求必须允许省略以保留原值、允许显式 `null` 清空。刷新快照后运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、回访表单/投影模型测试与 API client 回归。联调须验证旧回访为空值仍可读、未变更字段不要求额外写权限、字段隐藏或无写权时服务端拒绝写入，且前端不会自行扩展枚举或把客户反馈用于 URL、日志或本地持久化。

## 回访新建联系人与合同联调

`ReturnVisitCreateRequest` 必须继续发布可选 `contactId` 与 `contractId`，并在创建时按当前客户、关联记录可见性及 `CONTACT`/`CONTRACT` 字段写权限逐项验证。前端仅在 `contacts:read + customers:read` 或 `contracts:read + customers:read` 下查询各自目录，候选必须回显同一客户后才能选择。运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、回访表单模型测试与 API client 回归；联调应验证跨客户、不可见、被遮罩或不可写的关系被服务端拒绝，空选择请求省略关系字段，且创建响应 customer ID 必须与路径一致。关系 ID 不得进入 URL、浏览器持久化存储或日志。

## 回访新建回访人联调

`ReturnVisitCreateRequest` 必须继续发布可选 `ownerActorId`。客户上下文和全局新建仅在 `return-visits:assign + organization:read` 同时存在时读取 `GET /api/v1/organization/members` 的在职候选；未选时必须省略字段，由服务端默认当前成员。运行回访表单模型测试和 API client 回归；联调应验证伪造、跨租户、离职、不可见或超出 owner scope 的成员均被服务端拒绝，且浏览器不从本地身份、缓存或 URL 推断回访人。成员选择不得写入 URL、查询缓存、持久化存储或日志。

回访创建自定义字段复用 `GET /api/v1/fields/objects/RETURN_VISIT?includeInactive=false`、组织成员/部门目录、`POST /api/v1/file-field-drafts`、命名上传 intent/status 与 `POST /api/v1/return-visits`，不刷新 OpenAPI。仅 `fields:read` 读取当前身份目录；USER/DEPARTMENT 仅取 `organization:read` 下受限候选，FILE 仅在 `files:write` 下通过同一 RETURN_VISIT 草稿且确认 `UPLOADED` 后绑定。必填目录、候选、文件权限或上传不可用时保持关闭，RELATION 不会降级为自由文本。可运行 `./node_modules/.bin/vitest run src/features/return-visits/model/return-visit-form.test.ts src/components/dynamic-field/model/custom-field-form.test.ts src/features/customers/components/customer-create-file-field-controls.test.tsx --maxWorkers=1 --no-file-parallelism`。

## 回访软删除联调

`DELETE /api/v1/return-visits/{returnVisitId}?version=…` 已由已提交快照发布。Web 仅在 `return-visits:delete` 下显示确认操作，且必须只提交详情原始版本；运行 API client 与回访删除 E2E 回归。联调应验证缺少权限、跨租户/不可见记录、过期 version 与不满足 owner scope 的请求都被服务端拒绝，成功删除会撤回该回访附件和 FILE 绑定、关闭详情并在同一身份下刷新列表。浏览器不预判附件状态或重试 409。

## 产品新建目录与动态字段联调

`POST /api/v1/products` 的同一隔离实例快照必须发布 `categoryId`、`unit`、`description`、`availability`、`customFields`、`fileFieldDraftId`、`fileFields` 和可选 `ownerActorId`，并保留名称、编码和目录价的必填约束。刷新快照后运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 与产品表单模型/API client 回归。联调应验证创建页只在 `products:read` 下请求 `GET /api/v1/product-categories`；候选仅为当前身份回显的 ID/名称路径。目录加载失败时可以不带分类创建，但伪造、跨租户、停用或不可写分类必须由服务端拒绝。负责人选择额外要求 `products:assign + organization:read`，候选只能来自同一身份的在职成员目录；未选择时必须省略 `ownerActorId`，伪造、离职、不可见或超出 owner scope 的成员须由服务端拒绝。`fields:read` 下仅按当前身份的 PRODUCT 字段目录渲染 ACTIVE 非内置标量字段；USER/DEPARTMENT 仅从 `organization:read` 的受限目录选取 ID，FILE 仅在 `files:write` 下以同一 PRODUCT 草稿、上传 intent 和 `UPLOADED` 状态取得的 ID 绑定。必填目录、文件权限或上传失败时创建关闭，RELATION 不得降级为自由文本；服务端继续复核字段写策略、文件草稿归属、字段类型、候选有效性与数据范围。`availability` 只能接受 `AVAILABLE|UNAVAILABLE`，空白单位/说明应省略，浏览器不计算派生金额。

## 产品编辑动态字段联调

`PUT /api/v1/products/{productId}` 必须继续发布完整基础字段、`version` 与可选 `customFields`、`fileFields`。联调须确认服务端以请求中明确出现的 `customFields` code 合并现存值：未出现的 code 保持原值，明确出现的空数组才走该字段的清除与必填规则；`fileFields` 也只替换明确出现的 FILE code，空数组清除该字段并重新执行必填规则，ID 顺序由服务端持久化。前端只在 `products:write` 且取得完整安全编辑基线时开放保存；`fields:read` 仅用于读取当前身份的 PRODUCT 目录，标量动态字段绝不能用详情投影预填。USER/DEPARTMENT 候选额外只来自 `organization:read` 的当前身份受限目录。FILE 另需 `products:read + files:read + files:write`，只从当前产品详情的服务端 FILE 投影保留既有 ID；新增候选必须走 `POST /api/v1/attachment-targets/{targetType}/{targetId}/file-fields/{fieldCode}/upload-intents`、认证二进制内容上传和状态查询，只有检查完成后的精确候选 ID 才可随 PUT 提交，取消/移除必须版本化撤回。RELATION 不能伪造为标量。运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、产品表单模型/API client/文件控件回归；联调应验证脱敏或只读详情值不会回写、伪造/停用/未知 code、无效选项、不可见成员或部门、越权字段、必填字段显式清除、检查未完成或被拒绝候选、过期 `version` 和跨租户产品均由服务端拒绝。字段值、搜索词、基线、version 和错误不得进入 URL、浏览器持久化存储或日志。

## 发票详情自定义字段联调

`PATCH /api/v1/invoices/{invoiceId}` 必须继续发布 `version` 与可选 `customFields`，并保持请求中非 null 字段的部分更新语义。联调须确认当前身份 INVOICE 目录中明确出现的 code 合并现存值，未出现的 code 保持原值，明确空数组才走清除与必填规则。前端只有 `invoices:read + invoices:write + customers:read + contracts:read + fields:read` 同时满足时才显示入口，且绝不以详情响应预填自定义值；USER/DEPARTMENT 候选额外只来自 `organization:read` 的受限目录，FILE 与 RELATION 不得伪造为标量。运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、发票表单模型/API client 回归；联调应覆盖脱敏或只读值不回写、未知/停用 code、无效选项、不可见成员或部门、越权字段、必填清除、过期 version、合同关系变化及跨租户发票均由服务端拒绝。字段值、搜索词、目录错误和 version 不得进入 URL、浏览器持久化存储或日志。

## 回款详情自定义字段联调

`PATCH /api/v1/receivables/{receivableId}` 必须继续发布 `version` 与可选 `customFields`，并保持请求中非 null 字段的部分更新语义。联调须确认当前身份 RECEIVABLE 目录中明确出现的 code 合并现存值，未出现的 code 保持原值，明确空数组才走清除与必填规则。前端只有 `receivables:read + receivables:write + customers:read + contracts:read + fields:read` 同时满足时才显示入口，且绝不以详情响应预填自定义值；USER/DEPARTMENT 候选额外只来自 `organization:read` 的受限目录，FILE 与 RELATION 不得伪造为标量。运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、回款表单模型/API client 回归；联调应覆盖脱敏或只读值不回写、未知/停用 code、无效选项、不可见成员或部门、越权字段、必填清除、过期 version、合同关系变化及跨租户回款均由服务端拒绝。字段值、搜索词、目录错误和 version 不得进入 URL、浏览器持久化存储或日志。

## 回访详情自定义字段联调

`PUT /api/v1/return-visits/{returnVisitId}` 必须继续发布 `version`、必填 `visitTime`、可选 `remark` 与可选 `customFields`，并保持请求中明确出现的自定义 code 的合并语义。联调须确认当前身份 RETURN_VISIT 目录中明确出现的 code 合并现存值，未出现的 code 保持原值，明确空数组才走清除与必填规则。前端只有 `return-visits:read + return-visits:write + fields:read` 同时满足，且当前详情安全回显回访时间与反馈时才显示入口；它们必须原样随请求保留，动态字段绝不以详情响应预填。服务端仍必须复核 VISIT_TIME、REMARK 和每个动态 code 的写权限。USER/DEPARTMENT 候选额外只来自 `organization:read` 的受限目录，FILE 与 RELATION 不得伪造为标量。运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、回访表单模型/API client 回归；联调应覆盖脱敏或只读值不回写、缺失基础基线关闭入口、缺失 VISIT_TIME 或 REMARK 写权限、未知/停用 code、无效选项、不可见成员或部门、越权字段、必填清除、过期 version 与跨租户回访均由服务端拒绝。字段值、反馈、搜索词、目录错误和 version 不得进入 URL、浏览器持久化存储或日志。

## 回款计划详情自定义字段联调

`PATCH /api/v1/receivable-plans/{planId}` 必须继续发布 `version` 与可选 `customFields`，并保持请求中非 null 字段的部分更新语义。联调须确认当前身份 RECEIVABLE_PLAN 目录中明确出现的 code 合并现存值，未出现的 code 保持原值，明确空数组才走清除与必填规则。前端只有 `receivable-plans:read + receivable-plans:write + customers:read + contracts:read + fields:read` 同时满足时才显示入口，且绝不以详情响应预填自定义值；USER/DEPARTMENT 候选额外只来自 `organization:read` 的受限目录，FILE 与 RELATION 不得伪造为标量。运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、回款计划表单模型/API client 回归；联调应覆盖脱敏或只读值不回写、未知/停用 code、无效选项、不可见成员或部门、越权字段、必填清除、过期 version、已有回款历史、合同关系变化及跨租户回款计划均由服务端拒绝。字段值、搜索词、目录错误和 version 不得进入 URL、浏览器持久化存储或日志。

## 回款计划新建提醒与备注联调

同一后端实例的 `ReceivablePlanCreateRequest` 与 `ReceivablePlanBatchCreateRequest.plans[]` 必须继续发布 `reminderDays`（非负 `int32`）、`remark`（至多 2000 字符）及每行 `customFields`；单条请求额外保留同一 RECEIVABLE_PLAN 私有草稿的 `fileFieldDraftId/fileFields`，而批量草稿不得伪造这些字段。前端以已提交的快照生成类型为准；运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、回款计划表单模型测试与 API client 回归。联调应验证负数、小数或超出 `int32` 的提醒天数会在前端阻止并由服务端拒绝，空白备注不发送，缺少 `REMINDER_DAYS`、`REMARK` 或目录自定义字段写权限时服务端拒绝相应写入；批量请求还必须原子拒绝非法行。批量 USER/DEPARTMENT 值必须来自当前身份受限目录；必填 FILE 或 RELATION 在批量契约不可表达时前端保持关闭。提醒、备注、动态值、候选搜索和错误均不得进入 URL、浏览器持久化存储或日志。

单条回款计划新建的自定义字段复用 `GET /api/v1/fields/objects/RECEIVABLE_PLAN?includeInactive=false`、组织成员/部门目录、`POST /api/v1/file-field-drafts`、命名上传 intent/status 与 `POST /api/v1/receivable-plans`，不刷新 OpenAPI。仅 `fields:read` 读取当前身份目录；USER/DEPARTMENT 只从 `organization:read` 下受限候选选择，FILE 只在 `files:write` 下通过同一 RECEIVABLE_PLAN 草稿且确认 `UPLOADED` 后绑定。必填目录、候选、文件权限或上传不可用时保持关闭；RELATION 因后端没有所属模块而失败关闭。批量端点未发布文件草稿字段，仍不接入附件。可运行 `./node_modules/.bin/vitest run src/features/receivable-plans/model/receivable-plan-form.test.ts src/components/dynamic-field/model/custom-field-form.test.ts src/features/customers/components/customer-create-file-field-controls.test.tsx --maxWorkers=1 --no-file-parallelism`。

## 回款计划高级筛选与保存方案联调

同一后端实例的 `ReceivablePlanQueryRequest` 必须发布可选 `savedViewId` 与最多 50 条 `conditions`，并同时被 `POST /api/v1/receivable-plans/query` 和 `/summary` 接受。刷新快照后运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、回款计划查询键与 API client 回归。联调应确认保存方案仅限当前成员的 RECEIVABLE_PLAN 方案，临时条件与保存方案互斥，字段、操作符、值类型、客户/合同关系和数据范围均由服务端逐次复核；列表和三项金额汇总在相同条件下变化，分页不会改变汇总。无 `saved-views:read` 时不显示入口，字段目录或保存方案加载失败时显示受控错误；条件、方案名称和错误不得进入 URL、浏览器持久化存储或日志。

## 后端开发启动

在 `atom-crm` 仓库启动 MySQL 和 `dev` profile：

```bash
docker compose up -d mysql
sh ./mvnw -pl start -am install -DskipTests
ATOM_SECURITY_TRUSTED_HEADER_ENABLED=true sh ./mvnw -f start/pom.xml spring-boot:run -Dspring-boot.run.profiles=dev
```

后端健康后，回到本仓库执行：

```bash
pnpm api:snapshot
pnpm api:generate
pnpm api:coverage
pnpm e2e:seed
VITE_ENABLE_DEV_AUTH=true pnpm dev
```

开发代理默认访问 `http://localhost:8080`；用 `VITE_API_PROXY_TARGET` 覆盖。打开 `http://localhost:5173/dev/session`，输入本地 dev/test 租户的成员 ID 和租户 ID；默认 E2E 租户使用 `900001/900001`。这些 ID 只写入当前标签页的 `sessionStorage`，不要在 Vite 环境变量中放生产凭证或开发身份值。进入应用后，如后端对当前身份授予 `organization:request`，头部租户菜单会列出服务器确认的活跃成员资格；它在逐项复核后才替换同一标签页的开发租户并整页刷新。该能力仅用于本地开发，生产租户切换必须由身份网关或认证服务签发新的受信上下文。

`VITE_ENABLE_DEV_AUTH=true` 只能和 `pnpm dev` 一起使用。`pnpm build` 会拒绝该环境变量；正常生产构建不会包含开发 Header。P1 本地端到端验证在前后端均启动后运行：

```bash
pnpm test:e2e
```

## 无后端可访问性回归

下面的检查不依赖 atom-crm 实例：它以 Playwright 启动或复用本地 Vite 服务器，并在开发身份页、1440px/1024px 完整服务端导航壳层、1280px 已授权用户页/创建弹窗、768px 客户公海目录和 375px 移动导航抽屉上执行 axe WCAG A/AA 审计、无横向溢出、跳过链接与抽屉键盘焦点恢复和页面异常/console error 检查。

```bash
pnpm test:e2e:a11y
```

CI 安装 Chromium 后执行同一命令。它使用路由内 mock 响应，不能代替要求真实后端的完整 `pnpm test:e2e`；后者仍须按本节前面的方式准备独立 E2E 租户。

P6/P7 联调前必须先用同一后端实例刷新快照和生成类型；随后可运行仪表盘偏好、报表与组织管理客户端契约回归。后端跨模块修改后，必须先重新执行上面的 reactor `install`、停止旧进程并重启 `start` 模块；只运行 `start/pom.xml` 会从本地仓库解析旧的上游模块，导致 OpenAPI 看似无差异。OA、营销、报表和组织页面不得接入手写 DTO 或过期快照。尤其 OA 审批人候选以及公告受众候选的 `keyword`、`page` 和 `size` 参数必须来自刷新后的快照；部门目录必须为具名 `DepartmentResponse` 数组，成员目录必须为具名 `MemberProfilePageResponse`，成员申请审核列表与申请人本人的 `/membership-requests/mine` 列表必须为具名 `MembershipRequestPageResponse`，用户目录必须为具名 `UserPageResponse` 且 `UserResponse` 必须标注其必填和可空字段，角色目录与分配目录必须分别为具名 `TenantRolePageResponse`、`RoleAssignmentPageResponse`，字段对象、字段定义、成员布局和角色字段策略必须分别使用具名 `BusinessObjectResponse`、`FieldDefinitionResponse`、`FieldLayoutResponse` 与 `RoleFieldPolicyResponse`；首次布局/策略保存须省略 `null` 初始 version，字段类型、访问级别和脱敏类型必须由刷新后快照中的枚举约束。公告详情还必须包含受众 `displayName` 与当前资源的 `allowedActions`，前端不得自行推断发布状态可执行的动作：

仪表盘排行与合同目标联调必须确认刷新后的 `DashboardOverviewResponse.rankings` 和 `target` 均为生成类型：每个固定指标都带 `AVAILABLE|UNAVAILABLE` 和至多十项排序行；合同目标仅有 `AVAILABLE|EMPTY|UNAVAILABLE` 三种服务端状态，数值只可在 `AVAILABLE` 下显示。目标管理页还依赖生成的 `PerformanceTarget*`、`DepartmentPerformanceTarget*` 及 `DepartmentPerformanceTargetBatchUpsertRequest` 合同，服务端导航须在 `dashboard-targets:read` 下下发 `/administration/performance-targets`；读写、唯一冲突和过期 version 都应由后端返回稳定语义。`PUT /api/v1/dashboard/department-performance-targets/batch` 必须验证每个既有周期的版本并全成或全败；部门目标目录只接受当前租户内活动部门的年度、季度、月度独立配置，前端不聚合成员目标、不把周期目标换算为部门实际/完成率，也不伪造租户目标或导入结果。切换当前成员的数据范围或时间范围后只读取同一概览快照。前端不得将独立报表响应、成员目录或卡片总额混入排行榜补行、重排或猜测负责人姓名；可运行 `./node_modules/.bin/vitest run src/features/dashboard src/api/client/api-client.test.ts --reporter=dot`。

工作台数据汇总联调还必须刷新 `DashboardOverviewResponse.dataSummary` 的生成类型并确认其闭合的 16 个 metric、`COUNT|AMOUNT` 单位及 `AVAILABLE|UNAVAILABLE` 状态。每项只有状态为 `AVAILABLE` 且具有数值时才显示；不允许以公海、活动或回款计划列表补造未发布统计。刷新后运行 `pnpm api:generate && pnpm api:coverage && pnpm api:check`，再运行 `./node_modules/.bin/vitest run src/features/dashboard/components/dashboard-data-summary.test.tsx src/features/dashboard/pages/dashboard-page.test.tsx --reporter=dot`。

目标 CSV 导入联调还必须刷新同一后端实例的 `PerformanceTargetImportRequest`、`DepartmentPerformanceTargetImportRequest` 与 `PerformanceTargetImportResponse`，再执行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`。页面只会在本地解析用户选择的 UTF-8 CSV，不调用上传 intent 或 multipart；验证成员/部门固定表头、1 MB/200 行上限、正安全 ID、金额、年度及周期后，分别对两个真实 `POST .../import` 路由发出一次类型化请求。后端必须对每行重新检查 `dashboard-targets:write`、租户、活动主体、`ACTIVE_CONTRACT` 和自然键，并在同一事务内全成或全败；响应仅为 `importedCount`，前端必须刷新普通目标查询而非使用本地导入内容补造目标、实际额或完成率。可运行 `./node_modules/.bin/vitest run src/features/dashboard/model/performance-target-import.test.ts src/api/client/api-client.test.ts --reporter=dot`。

OA 申请 FILE 下载通过同源 `/api/v1/oa/requests/{requestId}/file-fields/{fieldCode}/{fileId}/content` 返回受保护字节流；部署网关必须保留认证上下文和 `Content-Disposition`/`Content-Type` 响应头，不能把它改写为公开重定向、预签名链接或跨源可缓存资源。Web 使用受控 fetch 转 Blob 后才触发下载，联调需验证缺少 `files:read`、不可见申请、字段遮罩或已撤回文件均不能下载。可运行 `./node_modules/.bin/vitest run src/api/client/api-client.test.ts --testTimeout=10000 --silent --reporter=dot`。

市场活动联调还要求后端先执行 `V88__create_marketing_activity.sql`、`V89__add_marketing_activity_counters.sql`、`V90__add_marketing_activity_participant_departments.sql`、`V91__add_marketing_activity_form_link.sql`、`V92__add_marketing_activity_attachment_target.sql`、`V93__harden_attachment_relation_target_check.sql` 和 `V94__add_marketing_activity_image_attachment_groups.sql`，随后从同一运行实例刷新快照，使 `MarketingActivityCreateRequest`、`MarketingActivityUpdateRequest`、`MarketingActivityQueryRequest`、`MarketingActivityResponse`、`MarketingActivityPageResponse`、`AttachmentPageResponse`、`AttachmentUploadIntentCreateRequest`、`AttachmentUploadIntentResponse` 和 `AttachmentUploadStatusResponse` 及其读写删路由全部为生成类型；活动浏览数与提交数必须以非负的 `BIGINT` 字段持久化和回显，员工/部门参与者必须分别由外键关联并在请求项中声明正整数限制，`marketingFormId` 必须由同租户、未删除的既有营销表单验证，且只在该表单 ACTIVE 时回显公开标识。创建线索活动还可嵌入生成类型 `marketingForm`，但它与既有 ID 互斥、只允许 POST、只由同时具备活动和表单写入权限的调用者使用；后端必须在同一事务内按当前表单字段策略创建未启用表单并关联，活动失败时不可留下表单，PUT 必须拒绝该字段。`marketingActivityImageType` 只能是 `COVER|DETAIL`，仅用于活动目标，且同类 PNG/JPEG 的上传中与已发布关系总数由服务端根锁限制为 9；列表筛选也必须由生成的同名参数传递。受控附件上传必须经“创建意图 → 使用相同 file ID/version 的 `application/octet-stream` 内容上传 → 状态查询”；上传传输是生成契约中标注为 binary 的专用请求，不能退回为未认证的裸 URL 或通用 DTO 包装。可使用隔离的 Testcontainers/MySQL 进行 API 契约和迁移验证；不得为此连接或迁移共享开发库。刷新后执行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 和 API client 回归。

营销表单对象化联调要求已应用 `V104__generalize_marketing_form_targets.sql`，并从同一实例刷新快照，使 `MarketingFormCreateRequest.targetObjectType`、`MarketingFormResponse.targetObjectType`、配置目录的 `targetObjectType` 查询参数和 `MarketingFormSubmissionLinkResponse.targetObjectType/targetRecordId` 均成为生成类型。新建及市场活动内嵌表单只可选 `CUSTOMER|LEAD`，内嵌表单必须与活动关联对象相同；客户提交不得走匿名 FILE 草稿，联系人与任意自定义对象不能由浏览器伪造为表单目标。刷新后执行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 和营销表单/活动模型、API client、页面回归。

市场活动类型目录不涉及数据库迁移，但后端必须从同一运行实例发布 `GET /api/v1/marketing-activities/configuration-options`，以 `MarketingActivityConfigurationOptionsResponse.activityTypes[]` 提供稳定 code 与显示名称。前端刷新快照后执行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 与活动/API client 回归；新建或修改后的类型必须由目录校验，旧记录仅可原样保留历史未知值，不能被浏览器或接口写入新的自由文本。

产品附件联调使用 `product` 受控目标，需验证 `products:read + files:read` 才能列出或认证下载，`products:write + files:write` 才能创建上传意图、传输内容或版本化撤回；服务端必须分别复核当前产品范围、成员资格、文件可用性和 version。`V97` 已发布 `productImageType=PRIMARY|DETAIL`、每组 9 个 PNG/JPEG active 候选/已发布文件的上限，以及创建阶段的私有 `product-image-drafts` 草稿与 Product 创建原子绑定。必须用已迁移的同一实例刷新快照，使分组参数、`ProductCreateRequest.productImageDraftId/productImages`、草稿响应和所有专用路由成为生成类型；随后执行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、产品新建/附件回归。不得手写 DTO、快照或未经认证的上传 URL；浏览器不得以 MIME、文件名或上传顺序裁决类别、上限或检查状态。

客户排序联调要求同一实例的 `CustomerQueryRequest` 同时发布 `sortField`（`UPDATED_TIME|CREATED_TIME|NAME|OWNER_ACTOR`）和 `sortDirection`（`ASC|DESC`）的 schema pattern；Web 只能用刷新后的生成类型把已审阅的 URL `sort` 选项映射为这一对参数。后端改动后先重新安装 reactor、使用隔离 MySQL 启动实例，再刷新快照、生成类型和覆盖文档；不得把本机共享开发库作为迁移或快照源。

客户主链路联调还要求同一实例将 `GET /api/v1/customers`、`POST /api/v1/customers/query`、`POST /api/v1/customers`、`GET /api/v1/customers/{customerId}` 与 `PUT /api/v1/customers/{customerId}` 分别发布为具名 `CustomerPageResponse` 或 `CustomerResponse`。Web 仍将字段裁决后的响应收窄投影，不能把生成类型当作授权或字段可见性凭据；刷新后运行 `pnpm api:snapshot`、`pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、API client 与客户模型回归。

客户自定义字段排序联调还要求 `CustomerQueryRequest.customSortFieldCode` 与 `sortDirection` 同时发布。隔离实例必须验证：仅 ACTIVE、非内置、可排序标量定义可解析；静态 `sortField` 不能与 custom code 组合；字段不可读或已脱敏、未知 code、非标量类型和非法方向均由服务端拒绝；数值字段按规范化数值而非字符串排序。Web 只从同一调用者的当前字段目录生成 `custom:<code>:asc|desc` URL 选项，随后运行 `pnpm api:snapshot`、`pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、排序模型测试和 API client 回归。

线索排序联调同样要求 `LeadQueryRequest` 在同一实例发布这两个 pattern 和 enum；Web 只把固定 URL `sort` 目录映射为生成的 `sortField/sortDirection` 联合类型。线索自定义字段排序还要求 `LeadQueryRequest.customSortFieldCode` 与 `sortDirection` 同时发布：仅 ACTIVE、非内置、可排序标量定义可解析；静态 `sortField` 不能与 custom code 组合；字段不可读或已脱敏、未知 code、非标量类型和非法方向均须由服务端拒绝，数值字段按规范化数值而非字符串排序。Web 只从同一调用者的当前字段目录生成 `custom:<code>:asc|desc` 选项。排序改变后重新运行快照、生成、覆盖率、API client 与线索排序模型测试，且仅能使用隔离 MySQL 作为契约源。

联系人排序联调同样要求 `ContactQueryRequest` 在同一实例发布这两个 pattern 和 enum；Web 只把固定 URL `sort` 目录映射为生成的 `sortField/sortDirection` 联合类型。联系人自定义字段排序还要求 `ContactQueryRequest.customSortFieldCode` 与 `sortDirection` 同时发布：仅 ACTIVE、非内置、可排序标量定义可解析；静态 `sortField` 不能与 custom code 组合；字段不可读或已脱敏、未知 code、非标量类型和非法方向均须由服务端拒绝，数值字段按规范化数值而非字符串排序。Web 只从同一调用者的当前字段目录生成 `custom:<code>:asc|desc` 选项。排序改变后重新运行快照、生成、覆盖率、API client 与联系人排序模型测试，且仅能使用隔离 MySQL 作为契约源。

联系人客户关联清除要求 `ContactUpdateRequest.customerId` 在同一实例明确发布为 `integer | null`；刷新快照和生成类型后，Web 只可在用户确认时发送 `customerId: null` 与详情原始 version。先重新安装 reactor 并重启 `start` 模块，避免从旧安装模块导出看似未变的快照；随后运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 和 API client 回归。

线索客户关联清除要求 `LeadUpdateRequest.customerId` 在同一实例明确发布为 `integer | null`；刷新快照和生成类型后，Web 只可在 `leads:write + customers:read` 的受控详情选择器中设置、更换或在确认后发送 `customerId: null` 与详情原始 version。先重新安装 reactor 并重启 `start` 模块，再运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、API client 与线索详情回归。

线索与联系人下次联系时间清除要求同一实例将 `LeadUpdateRequest.nextContactTime` 和 `ContactUpdateRequest.nextContactTime` 明确发布为 `string | null`。刷新快照和生成类型后，编辑器只会在用户修改时发送该字段；空值必须序列化为 `null` 并携带详情原始 version，未修改则省略。变更时同样先重新安装 reactor 并重启 `start` 模块，再运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 与线索/联系人表单和 API client 回归。

客户列表最后跟进摘要要求同一实例在 `CustomerResponse` 中发布可选 `lastActivityTime` 与 `lastActivityContent`。服务端只能在调用者具备 `activities:read` 后，对已经按客户读取范围过滤的 CUSTOMER 直接主题活动批量汇总最新 ACTIVE 记录；无该权限时两个字段必须省略，活动关系不能作为客户摘要来源。重新安装 reactor 并启动同一实例后，运行 `pnpm api:snapshot`、`pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、客户列表模型测试和 API client 回归。

线索、联系人和商机列表的最近跟进摘要要求同一实例分别在 `LeadResponse`、`ContactResponse`、`OpportunityResponse` 中发布可选 `lastActivityTime`，并仅为线索和联系人发布可选 `lastActivityContent`。服务端只能在调用者具备 `activities:read` 后，对已经按各自读取范围过滤的 LEAD、CONTACT、OPPORTUNITY 直接主题活动批量汇总最新 ACTIVE 记录；无该权限时字段必须省略，关联对象活动不能作为摘要来源。刷新后运行 `pnpm api:snapshot`、`pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、三类列表模型测试及 API client 回归。

回访联系人和合同关联清除同样要求 `ReturnVisitUpdateRequest.contactId`、`contractId` 均明确发布为 `integer | null`。刷新快照后，Web 的确认操作只发送一个显式 `null`、完整已见时间/备注基线与原始 version，另一个关系字段必须保持省略；重新运行生成、覆盖率、API client 与回访关系模型测试。

商机排序联调同样要求 `OpportunityQueryRequest` 在同一实例发布这两个 pattern 和 enum；Web 只把固定 URL `sort` 目录映射为生成的 `sortField/sortDirection` 联合类型。排序改变后重新运行快照、生成、覆盖率、API client 与商机排序模型测试，且仅能使用隔离 MySQL 作为契约源。

商机自定义字段排序还要求 `OpportunityQueryRequest.customSortFieldCode` 与 `sortDirection` 同时发布：仅 ACTIVE、非内置、可排序标量定义可解析；静态 `sortField` 不能与 custom code 组合；字段不可读或已脱敏、未知 code、非标量类型和非法方向均须由服务端拒绝，数值字段按规范化数值而非字符串排序。Web 只从同一调用者的当前字段目录生成 `custom:<code>:asc|desc` 选项。排序改变后重新运行快照、生成、覆盖率、API client 与商机排序模型测试，且仅能使用隔离 MySQL 作为契约源。

产品排序联调同样要求 `ProductQueryRequest` 在同一实例发布这两个 pattern 和 enum；Web 只把固定 URL `sort` 目录映射为生成的 `sortField/sortDirection` 联合类型。排序改变后重新运行快照、生成、覆盖率、API client 与产品排序模型测试，且仅能使用隔离 MySQL 作为契约源。

产品自定义字段排序还要求 `ProductQueryRequest.customSortFieldCode` 与 `sortDirection` 同时发布：仅 ACTIVE、非内置、可排序标量定义可解析；静态 `sortField` 不能与 custom code 组合；字段不可读或已脱敏、未知 code、非标量类型和非法方向均须由服务端拒绝，数值字段按规范化数值而非字符串排序。Web 只从同一调用者的当前字段目录生成 `custom:<code>:asc|desc` 选项。排序改变后重新运行快照、生成、覆盖率、API client 与产品排序模型测试，且仅能使用隔离 MySQL 作为契约源。

产品分类筛选不新增 API：它复用 `GET /api/v1/product-categories` 和 `POST /api/v1/products/query`。联调时应确认分类候选只在 `products:read` 下读取并收敛为 ID/名称路径；`categoryId` 仅在选择或 URL 恢复后仍存在于同一服务器分类树时发送。分类缺失、URL 非精确正安全整数或确认未完成时，产品查询必须等待而不是暂时显示未收窄结果。

产品 CSV 导出要求同一实例发布 `POST /api/v1/products/export/csv` 与 `ProductCsvExportRequest`，再刷新快照、执行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 和 API client 回归。联调须验证页面只在 `products:export` 下显示入口，且仅通过认证 Blob 下载；请求继承当前关键词、分类、可用性、静态/自定义排序、保存视图或临时条件，但永不发送 tenant、成员、页码或文件名。服务端必须独立复核 `products:read + products:export`、当前字段未遮罩读取策略、分类/视图/条件以及 5,000 行和 16 MiB 边界；缺少任一权限、遮罩字段、无效条件、并发变化或超限均不得产生下载。

合同排序联调同样要求 `ContractQueryRequest` 在同一实例发布这两个 pattern 和 enum；Web 只把固定 URL `sort` 目录映射为生成的 `sortField/sortDirection` 联合类型。通用全局列表只能在声明该排序目录的合同页面渲染控件或发送排序字段，回款、发票和回访保持原有契约。排序改变后重新运行快照、生成、覆盖率、API client 与合同排序模型测试，且仅能使用隔离 MySQL 作为契约源。

合同与发票自定义字段排序要求同一隔离实例分别发布 `ContractQueryRequest.customSortFieldCode`、`InvoiceQueryRequest.customSortFieldCode` 和 `sortDirection`。联调必须验证仅 ACTIVE、非内置、可排序标量定义可解析；静态 `sortField` 与 custom code 组合、未知/停用/非标量 code、不可读或已脱敏字段、缺失或非法方向均由服务端拒绝，INTEGER/DECIMAL 按数值排序。Web 只在 `fields:read` 下从同一调用者的字段目录生成 `custom:<fieldCode>:asc|desc`，并把动态列限制为同一列表响应已过滤的 `customFields`。每次契约刷新后运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、两组排序模型测试与 API client 回归；快照源只能是隔离 MySQL 实例。

回款排序联调要求 `ReceivableQueryRequest` 在同一实例发布 `RECEIVED_DATE|CREATED_TIME|UPDATED_TIME|RECEIPT_NUMBER|OWNER_ACTOR` 的 `sortField` 与 `ASC|DESC` 的 `sortDirection` pattern/enum；Web 只把固定 URL `sort` 目录映射为生成联合类型，默认到账日倒序且不在当前页二次排序。排序改变后重新运行隔离快照、生成、覆盖率、API client、回款排序模型和后端集成测试；不得将金额、支付方式或任意客户端列名透传为排序字段。

回款与回访自定义字段排序要求同一隔离实例分别发布 `ReceivableQueryRequest.customSortFieldCode`、`ReturnVisitQueryRequest.customSortFieldCode` 和 `sortDirection`。联调必须验证仅 ACTIVE、非内置、可排序标量定义可解析；静态 `sortField` 与 custom code 组合、未知/停用/非标量 code、不可读或已脱敏字段、缺失或非法方向均由服务端拒绝，INTEGER/DECIMAL 按数值排序。Web 只在 `fields:read` 下从同一调用者的字段目录生成 `custom:<fieldCode>:asc|desc`，并把动态列限制为同一列表响应已过滤的 `customFields`。每次契约刷新后运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、两组排序模型测试与 API client 回归；快照源只能是隔离 MySQL 实例。

发票排序联调要求 `InvoiceQueryRequest` 在同一实例发布 `UPDATED_TIME|CREATED_TIME|REQUESTED_DATE|ISSUED_DATE|APPLICATION_NUMBER|INVOICE_NUMBER|OWNER_ACTOR` 的 `sortField` 与 `ASC|DESC` 的 `sortDirection` pattern/enum；Web 只把固定 URL `sort` 目录映射为生成联合类型，默认最近更新且不在当前页二次排序。排序改变后重新运行隔离快照、生成、覆盖率、API client、发票排序模型和后端集成测试；不得将金额、税务、抬头、支付、收件资料或任意客户端列名透传为排序字段。

回访排序联调要求 `ReturnVisitQueryRequest` 在同一实例发布 `VISIT_TIME|UPDATED_TIME|CREATED_TIME|VISIT_NUMBER|OWNER_ACTOR` 的 `sortField` 与 `ASC|DESC` 的 `sortDirection` pattern/enum；Web 只把固定 URL `sort` 目录映射为生成联合类型，默认回访时间倒序且不在当前页二次排序。排序改变后重新运行隔离快照、生成、覆盖率、API client、回访排序模型和后端集成测试；不得将备注、关系字段或任意客户端列名透传为排序字段。

全局回访新建没有新增 API：它使用既有的生成 `CustomerQueryRequest` 受限目录和 `ReturnVisitCreateRequest`。联调时应确认仅在 `return-visits:write + customers:read` 下打开客户选择器，候选解码只保留 ID/名称，提交前后端仍复核客户范围；从列表进入并取消时应恢复 `keyword`、`page`、`size`、`scene` 和 `sort`，但 `returnTo` 不得被解释为任意路由。

合同、回款和发票的全局新建同样没有新增 API：受限客户目录只作为进入已有客户上下文创建表单的前置步骤，实际写入仍分别使用既有的合同、回款和发票生成请求。相同的受限目录也为四个全局列表提供客户关系高级筛选；联调时应确认仅在 `customers:read` 下显示，选择只发送精确正 `customerId`，刷新标签使用同一客户详情读取，缺少权限或非法 URL 值不发送关系条件。`/crm/contracts|receivables|invoices/new` 只接受当前可见客户的选择结果，向内部客户路径转交的 `returnTo` 只能恢复各自固定列表 query，且取消不会遗失关键词、分页、场景、状态、客户筛选或排序。

合同新建的价格与条款也没有新增 API：它使用同一 `ContractCreateRequest`，只提交用户明确填写的日期、类型、付款方式、备注、`0..100` 整单折扣和服务端目录选定产品的数量/可选成交单价。联调时应确认产品目录只在 `products:read` 下读取；单价留空时请求必须省略 `unitPrice`，由服务端使用目录价并重算行金额、折后金额和合同总额。浏览器不得以目录响应、合同列表或本地算术预填、计算或缓存这些金额；后端仍须复核客户与产品可见性、产品可用性、价格、日期、折扣和编号唯一性。

合同新建负责人同样复用 `GET /api/v1/organization/members` 与 `POST /api/v1/contracts`：仅 `contracts:assign + organization:read` 显示受限在职成员目录，明确选择才发送 `ownerActorId`，否则由服务端默认当前成员。联调应验证负责人选择不改变路径客户、产品目录或价格处理，伪造、跨租户、离职、不可见或超出 owner scope 的成员均由服务端拒绝。可运行 `./node_modules/.bin/playwright test tests/e2e/customer-contract-create-owner.spec.ts`。

合同新建的联系人和商机关联同样复用 `POST /api/v1/contacts/query`、`POST /api/v1/opportunities/query` 与 `POST /api/v1/contracts`：仅 `contacts:read` 或 `opportunities:read` 时显示对应目录，查询固定当前路径客户并在解码边界确认回显同一 customer ID；明确选择才发送 `contactId` 或 `opportunityId`，无权、目录失败、跨客户候选或未选择时必须省略。可运行 `./node_modules/.bin/playwright test tests/e2e/customer-contract-create-contact.spec.ts`。

合同新建自定义字段不需要刷新 OpenAPI：它复用 `GET /api/v1/fields/objects/CONTRACT?includeInactive=false`、`GET /api/v1/organization/members`、`GET /api/v1/organization/departments`、`POST /api/v1/file-field-drafts`、命名上传 intent/status 与既有 `POST /api/v1/contracts`。联调需确认仅 `fields:read` 才读取当前身份字段目录；Web 按目录 options/required/order 提交明确填写的标量 `customFields`，USER/DEPARTMENT 仅在 `organization:read` 下从受限目录选取 ID，FILE 仅在 `files:write` 下经同一 CONTRACT 草稿、上传意图和 `UPLOADED` 状态提交同一 draft 的文件 ID。必填候选目录、必填文件权限/上传或字段目录失败时保持关闭；RELATION 因后端没有合同所属模块而失败关闭，绝不降级为自由文本。后端继续按当前成员的字段写策略、字段类型、选项、成员/部门有效性、文件草稿归属、必填性和数据范围逐项验证。可运行 `./node_modules/.bin/vitest run src/features/contracts/model/contract-form.test.ts src/components/dynamic-field/model/custom-field-form.test.ts src/features/customers/components/customer-create-file-field-controls.test.tsx --maxWorkers=1 --no-file-parallelism`。

## 合同详情自定义字段联调

`PATCH /api/v1/contracts/{contractId}` 必须继续发布 `version` 与可选 `customFields`，并保持请求中明确出现的自定义 code 的合并语义。联调须确认当前身份 CONTRACT 目录中明确出现的 code 合并现存值，未出现的 code 保持原值，明确空数组才走清除与必填规则。前端只有 `contracts:read + customers:read + contracts:write + fields:read` 同时满足时才显示入口；动态字段绝不以详情响应预填。USER/DEPARTMENT 候选额外只来自 `organization:read` 的受限目录，FILE 与 RELATION 不得伪造为标量。运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、合同表单模型/API client 回归；联调应覆盖脱敏或只读值不回写、未知/停用 code、无效选项、不可见成员或部门、越权字段、必填清除、过期 version 与跨租户合同均由服务端拒绝。字段值、搜索词、目录错误和 version 不得进入 URL、浏览器持久化存储或日志。

发票新建同样没有新增 API：它使用既有 `InvoiceCreateRequest` 与当前客户受限合同目录。联调应确认金额、申请日期、发票类型和抬头由用户明确输入；只有 `ORGANIZATION` 抬头才发送纳税人识别号及可选银行/登记资料，切换到 `INDIVIDUAL` 后这些字段必须被移除。仅 `invoices:assign + organization:read` 显示服务端在职成员目录，明确选择才发送 `ownerActorId`，否则交由服务端默认当前成员。税务、银行、联系人、寄送地址和备注只能存在于当前表单及本次认证请求，不得写入 URL、查询缓存、持久化存储或日志；后端仍复核合同/客户可见性、可开票金额、负责人范围及每项字段写权限。可运行 `./node_modules/.bin/playwright test tests/e2e/customer-invoice-create-owner.spec.ts`。

发票新建自定义字段复用 `GET /api/v1/fields/objects/INVOICE?includeInactive=false`、组织成员/部门目录、`POST /api/v1/file-field-drafts`、命名上传 intent/status 与 `POST /api/v1/invoices`，不刷新 OpenAPI。仅 `fields:read` 读取当前身份目录；标量值按目录 options、required、order 发送，USER/DEPARTMENT 只从 `organization:read` 下受限候选选择，FILE 只在 `files:write` 下通过同一 INVOICE 草稿且确认 `UPLOADED` 后绑定。必填目录、候选、文件权限或上传不可用时保持关闭；RELATION 因后端没有发票所属模块而失败关闭，绝不降级为自由文本。后端继续复核字段策略、值类型、候选有效性、草稿归属、必填性、合同可见性和可开票额度。可运行 `./node_modules/.bin/vitest run src/features/invoices/model/invoice-form.test.ts src/components/dynamic-field/model/custom-field-form.test.ts src/features/customers/components/customer-create-file-field-controls.test.tsx --maxWorkers=1 --no-file-parallelism`。

回款新建同样复用既有 `ReceivableCreateRequest`：可选备注只在用户输入非空值时发送；联调应确认它不进入 URL、查询缓存、持久化存储或日志，清空时必须省略。合同和可选回款计划仍由当前客户/合同下的受限目录提供，浏览器不读取或计算目录中的金额；仅 `receivables:assign + organization:read` 显示服务端在职成员目录，明确选择才发送 `ownerActorId`，否则交由服务端默认当前成员。后端继续复核计划归属、剩余可回款金额、负责人范围和 `REMARK` 字段写权限。可运行 `./node_modules/.bin/playwright test tests/e2e/customer-receivable-create-owner.spec.ts`。

回款新建自定义字段复用 `GET /api/v1/fields/objects/RECEIVABLE?includeInactive=false`、组织成员/部门目录、`POST /api/v1/file-field-drafts`、命名上传 intent/status 与 `POST /api/v1/receivables`，不刷新 OpenAPI。仅 `fields:read` 读取当前身份目录；标量值按目录 options、required、order 发送，USER/DEPARTMENT 只从 `organization:read` 下受限候选选择，FILE 只在 `files:write` 下通过同一 RECEIVABLE 草稿且确认 `UPLOADED` 后绑定。必填目录、候选、文件权限或上传不可用时保持关闭；RELATION 因后端没有回款所属模块而失败关闭，绝不降级为自由文本。后端继续复核字段策略、值类型、候选有效性、草稿归属、必填性、合同/计划归属和可回款额度。可运行 `./node_modules/.bin/vitest run src/features/receivables/model/receivable-form.test.ts src/components/dynamic-field/model/custom-field-form.test.ts src/features/customers/components/customer-create-file-field-controls.test.tsx --maxWorkers=1 --no-file-parallelism`。

发票、回款和回访的合同关系筛选也没有新增 API：它只复用既有 `POST /api/v1/contracts/query` 和 `GET /api/v1/contracts/{contractId}`。联调时应确认仅在 `contracts:read + customers:read` 下显示：合同候选与详情都必须回显可读客户关系，候选解码只保留合同 ID 和名称/编号；选择后及 URL 恢复后都要以同一受限详情复核精确 ID 才向各自 `POST /query` 发送 `contractId`；无权、不可见、格式非法或详情不匹配时不得发出该条件。客户和合同筛选可并存，任一确认未完成时记录查询应等待而不能短暂展示未收窄结果。

全局回款的回款计划筛选同样不新增 API：它复用既有 `POST /api/v1/receivable-plans/query` 和 `GET /api/v1/receivable-plans/{planId}`。联调时应确认仅在 `receivable-plans:read + customers:read` 下显示，候选与详情都须回显可读客户关系，浏览器只保留计划 ID 与期数标签；选择或 URL 恢复后必须由同一受限详情确认精确 `receivablePlanId`，再发送到 `POST /api/v1/receivables/query`。无权、不可见、格式非法或详情不匹配时不发送该条件；它可与客户和合同筛选共存，任一确认未完成时记录查询等待。

联系人与商机全局列表的客户筛选也不新增 API：它们复用既有 `POST /api/v1/customers/query`、`GET /api/v1/customers/{customerId}`、`GET /api/v1/contacts` 与 `POST /api/v1/opportunities/query`。联调时应确认仅在 `customers:read` 下显示受控候选对话框，候选只保留 ID/名称；`customerId` 仅在选择或 URL 恢复后经同一身份的客户详情确认才发送。确认尚未完成、权限缺失、详情不可见或 URL 非精确正安全整数时，联系人/商机查询必须等待；联系人 CSV 导出应携带相同已确认的客户范围。

四个全局列表的字段设置同样没有新增 API：使用既有 `GET/PUT /api/v1/fields/objects/{objectType}/layout` 的当前成员基线。联调须以 `CONTRACT`、`RECEIVABLE`、`INVOICE`、`RETURN_VISIT` 分别确认 `fields:read` 下读取、`null` 初始 version 省略、后续沿用服务端 version，并验证只持久化本页静态安全列的隐藏状态；未知字段、固定列、宽度和顺序必须保留，不能用字段布局使金额、税务、支付、收件或动态字段可见。

保存视图联调要求 `GET/POST /api/v1/saved-views`、版本化更新/删除、设默认操作均发布具名 `SavedViewResponse`，空删除响应须明确无内容；字段目录中的 `FieldDefinitionResponse.filterOperators` 必须是具名 `FilterOperatorOptionResponse[]`，并发布每个操作符的 `code`、`minimumValueCount` 与 `maximumValueCount`。仅发布自由字符串操作符会迫使浏览器猜测空值、区间和集合值数量，不能满足条件编辑器。后端跨模块变更仍必须先 reactor `install` 后重启 `start`，再运行快照、生成、覆盖率、`api:check` 及 API client 回归。

```bash
pnpm api:snapshot
pnpm api:generate
pnpm api:coverage
pnpm api:check
pnpm exec vitest run src/api/client/api-client.test.ts --maxWorkers=1
```

嵌入页面联调还要求 `/api/v1/embedded-pages` 的 OpenAPI 查询参数直接发布为 `page`、`size`、`objectType`、`platform`、`status`，而非未展开的 request 对象；配置、分页、创建/更新响应和记录内渲染必须分别是具名 `EmbeddedPageConfigurationOptionsResponse`、`EmbeddedPagePageResponse`、`EmbeddedPageResponse`、`RenderedEmbeddedPageResponse`。后端变更后同样先 reactor `install` 再重启 `start`；前端运行 `pnpm api:snapshot && pnpm api:generate && pnpm api:coverage && pnpm api:check`，并执行 API client 回归，避免从旧安装模块生成错误参数类型。

线索接入客户端联调要求后端同时发布 `GET /api/v1/lead-intake-clients` 的 `LeadIntakeClientResponse[]`、创建的 `LeadIntakeClientCreatedResponse` 与版本化停用的 `LeadIntakeClientResponse`。摘要 schema 不得包含 `apiKey`，而创建 schema 必须以 `{ client, apiKey }` 具名返回；刷新后运行 `pnpm api:snapshot && pnpm api:generate && pnpm api:coverage && pnpm api:check` 及 `src/api/client/api-client.test.ts`，以防前端将一次性凭证误写入列表或持久缓存。

连接器控制面联调要求 `/api/v1/connectors/query` 发布 `ConnectorPageResponse`，详情、撤销与状态变更发布无凭证 `ConnectorResponse`，而创建与轮换只以 `{ connector, credential }` 的 `ConnectorCredentialCreatedResponse` 返回完整凭证一次。摘要 schema 不得含 `credential`；刷新快照后运行 `pnpm api:snapshot && pnpm api:generate && pnpm api:coverage && pnpm api:check` 及 `src/api/client/api-client.test.ts`。不要为 `/api/v1/connector-ingress/probe` 增加浏览器调用或 UI：它只服务于 connector bearer 的非人工入口。

企业数据联调要求能力、名称/精确查询、采纳预览和采纳确认分别发布 `EnterpriseDataCapabilityResponse`、`EnterpriseDataObservationResponse`、`EnterpriseDataAdoptionPreviewResponse` 与 `EnterpriseDataAdoptionResponse`；不得退化为匿名 `object`。刷新快照时，Node 在受限沙箱中可能无法连接本机后端，应以 `ATOM_CRM_OPENAPI_URL=http://127.0.0.1:8080/v3/api-docs pnpm api:snapshot` 运行，再执行生成、覆盖率、`api:check` 和客户端回归。产品完整编辑依赖具名的 `ProductResponse` 与 `ProductEditableBaselineResponse`；后端部署必须先提供 `GET /api/v1/products/{productId}/editable-baseline`，并确保非安全编辑场景只返回 `id`、`version`、`editable: false`，再刷新 Web 快照。

商机协作者联调要求 `GET /api/v1/opportunities/{opportunityId}/collaborators` 发布具名的 `OpportunityCollaboratorBaselineResponse`，并包含完整 `collaborators`、`callerState` 与非负 `version`；`OpportunityCollaboratorResponse` 必须具名承诺正 `actorId` 和 `READ|WRITE` access。刷新快照后运行 `pnpm api:generate && pnpm api:coverage && pnpm api:check` 以及 API client 回归；不能从普通商机详情的协作者投影构造替换请求。

联系人协作者联调同样要求 `GET /api/v1/contacts/{contactId}/collaborators` 发布具名的 `ContactCollaboratorBaselineResponse`，其中含完整 `collaborators`、`callerState` 与非负 `version`，而 `ContactCollaboratorResponse` 明确承诺正 `actorId` 和 `READ|WRITE` access。后端变更后重新安装 reactor 并重启 `start`，再刷新快照、运行 `pnpm api:generate && pnpm api:coverage && pnpm api:check`、API client 与联系人协作者端到端回归；不能从普通联系人详情投影构造替换请求。

线索协作者联调同样要求 `GET /api/v1/leads/{leadId}/collaborators` 发布具名的 `LeadCollaboratorBaselineResponse`，其中含完整 `collaborators`、`callerState` 与非负 `version`，而 `LeadCollaboratorResponse` 明确承诺正 `actorId` 和 `READ|WRITE` access。后端变更后重新安装 reactor 并重启 `start`，再刷新快照、运行 `pnpm api:generate && pnpm api:coverage && pnpm api:check`、API client 与线索协作者端到端回归；不能从普通线索详情投影构造替换请求。

客户协作者联调同样要求 `GET /api/v1/customers/{customerId}/collaborators` 发布具名的 `CustomerCollaboratorBaselineResponse`，其中含完整 `collaborators`、`callerState` 与非负 `version`，而 `CustomerCollaboratorResponse` 明确承诺正 `actorId` 和 `READ|WRITE` access。后端变更后必须重新安装 reactor 并重启 `start`，再刷新快照、运行 `pnpm api:generate && pnpm api:coverage && pnpm api:check`、API client 与客户协作者端到端回归；不能从普通客户详情投影构造替换请求。

P4 的合同到发票到回款浏览器闭环可单独运行；它会从服务端可见产品创建合同，再通过当前客户上下文选择该合同创建个人发票和回款：

```bash
pnpm exec playwright test tests/e2e/customer-transaction-flow.spec.ts
```

合同名称/编号的部分编辑可单独回归；它只验证 PATCH 中实际变化的基础字段与 version：

```bash
pnpm exec playwright test tests/e2e/customer-contract-basic-edit.spec.ts
```

发票申请日期/类型的部分编辑可单独回归；它只验证 PATCH 中实际变化的安全基础字段与 version：

```bash
pnpm exec playwright test tests/e2e/customer-invoice-basic-edit.spec.ts
```

回款计划到期日的部分编辑可单独回归；它只验证 PATCH 中实际变化的到期日期与 version：

```bash
pnpm exec playwright test tests/e2e/customer-receivable-plan-due-date-edit.spec.ts
```

回款到账日期的部分编辑可单独回归；它只验证 PATCH 中实际变化的日期与 version：

```bash
pnpm exec playwright test tests/e2e/customer-receivable-received-date-edit.spec.ts
```

个人开票抬头的新建、部分编辑和删除可单独回归；编辑仅验证个人抬头 PATCH 及 version，不读取敏感资料字段：

```bash
pnpm exec playwright test tests/e2e/customer-invoice-profiles.spec.ts
```

Work 任务基础浏览、创建、管理者编辑、重新分配与关注人替换、提醒计划替换、受控附件浏览与下载、业务关联创建/替换/清除、取消、删除、状态流转和评论可单独回归；它验证成员目录选择后含唯一关注人、明确描述、受限优先级、可选到期时间与完整受支持类型/正记录 ID 的创建载荷、管理者完整编辑基线及 PUT version 载荷、基于成员目录的重新分配 version 载荷、完整关注人基线的替换载荷、独立提醒计划基线及完整步骤 version 载荷、`files:read` 下的任务附件分页请求、认证 Blob 下载、带关联类型/ID 与 version 的替换载荷、只含 version 的二次确认清除载荷、管理者取消 version 载荷、删除的 version 查询参数与列表返回、列表请求、窄投影展示、开始/退回待办的 version 载荷及评论发表：

```bash
pnpm exec playwright test tests/e2e/work-tasks.spec.ts
```

周期任务列表、草稿创建、实例浏览、服务端 capability 驱动的完整编辑、恢复、暂停、停止和未来提醒模板替换可单独回归；它验证成员目录选择后含唯一关注人、明确描述、受限优先级和完整日历规则的草稿创建载荷、服务端创建的草稿系列按 `work-tasks:read` 分页读取、实例只请求目标系列的分页发生事实且不展示生成任务投影、编辑只从同 ID 的完整基线构造 PUT、`ACTIVATE`/`PAUSE`/`STOP` 均只在同名 `allowedActions` 下出现且只发送 version、所有 mutation 回显同一 ID、提醒仅在 `UPDATE` capability 下从专用基线读取并以该 version 完整替换固定步骤，并且不会显示成员、blocker 或自动化投影：

```bash
pnpm exec playwright test tests/e2e/work-task-series.spec.ts
```

通知偏好可独立回归；它验证仅有 `notifications:read` 的应用头部入口读取当前成员的两个布尔偏好，并以完整的两个布尔值保存，不触碰地址、供应商、就绪状态或投递记录：

```bash
pnpm exec playwright test tests/e2e/notification-preferences.spec.ts
```

菜单偏好可独立回归；它验证 `navigation:read` 的头部入口只按需读取当前成员偏好，并使用响应中的 server-authorized `availableItems` 恢复隐藏菜单；`navigation:write` 才可保存同级排序和隐藏变更，写入保留完整基线并在成功后刷新启动导航：

```bash
pnpm exec vitest run src/features/navigation-preferences/model/navigation-preference.test.ts src/api/client/api-client.test.ts --maxWorkers=1
```

通知中心可独立回归；它验证应用头部只在 `notifications:read + work-tasks:read` 下按需请求当前成员通知分页，界面不展示任务 ID，并以单一通知 ID 发起幂等已读操作且要求同一 `READ` 响应：

```bash
pnpm exec playwright test tests/e2e/notification-inbox.spec.ts
```

审批待办可独立回归；它验证应用头部只在 `approvals:read` 下按需请求固定 `PENDING` 桶，并且界面不呈现审批事实、业务记录 ID、任务受理人或备注：

```bash
pnpm exec playwright test tests/e2e/approval-pending.spec.ts
```

客户阶段工作流配置、启动、运行记录摘要、受限字段推进和评论可独立回归；配置创建只使用服务端对象/字段/审批定义目录与 MEMBER/DEPARTMENT 候选分页，更新只在完整 `UPDATE + version + editable` 基线成立时发送全量替换，状态只提交 `CHANGE_STATUS` 下发的目标与 version。运行记录验证适用项仅取自当前客户、只有 `canStart` 项可启动，只有 `ADVANCE + version` 与完整受限写入基线才推进；字段接受未遮罩的基础类型、记录字段专用候选 ID 和服务端枚举的 ADDRESS 分量，FILE 必须依次取得同一记录/字段草稿、具名上传 intent 并查询到 `UPLOADED` 状态后才提交 file ID，任务仅提交当前记录允许且成员勾选的 code，审批人候选只取当前记录的 selection 分页，运行记录仅保留 COMMENT 布尔 capability，且评论删除携带服务端 `canDelete + version`：

```bash
pnpm exec vitest run src/features/stage-workflows/model/stage-workflow-configuration.test.ts src/features/stage-workflows/model/stage-workflow-runtime.test.ts src/features/stage-workflows/model/stage-workflow-comment.test.ts src/api/client/api-client.test.ts --maxWorkers=1
```

客户详情的审批发起契约回归可独立运行；它验证浏览器只使用当前客户绑定的发起选项与审批人候选，选择不变且预览可执行后才提交幂等键，不传递业务 facts：

```bash
pnpm exec vitest run src/features/approvals/model/approval-start.test.ts src/api/client/api-client.test.ts --maxWorkers=1
```

审批定义目录可独立回归；它验证应用头部只在 `approvals:manage` 下按需请求定义分页，且界面不呈现步骤、条件、成员范围或版本：

```bash
pnpm exec playwright test tests/e2e/approval-definition-list.spec.ts
```

审批定义最小草稿创建可复用同一浏览器回归；它验证只有同时具备 `approvals:manage + organization:read` 时才读取服务端成员目录，并只提交初始停用单成员步骤所需的名称、对象、审批成员、方式和兜底管理员：

```bash
pnpm exec playwright test tests/e2e/approval-definition-create.spec.ts
```

审批定义状态生命周期可独立回归；它验证状态管理器先读取独立的 ID/状态/version 基线，再在确认后以该 version 启用、停用或删除，而不展示定义配置：

```bash
pnpm exec playwright test tests/e2e/approval-definition-status.spec.ts
```

审批定义最小模板编辑可独立回归；它验证只有严格匹配的停用模板可读入编辑器，并以原 version 完整替换最小模板：

```bash
pnpm exec playwright test tests/e2e/approval-definition-edit.spec.ts
```

商机基础编辑联调要求同一实例发布 `GET /api/v1/opportunities/{opportunityId}/editable-baseline` 的具名 `OpportunityEditableBaselineResponse`，其中 `editable: false` 不得含业务字段，`editable: true` 必须返回完整替换所需字段和 version；同时 `OpportunityUpdateRequest.nextContactTime` 明确发布为 `string | null`。客户替换还须以当前身份 `POST /api/v1/customers/query` 的可见候选复核，管线与阶段替换须由同一活动 `POST /api/v1/opportunity-pipelines/query` 和 `/stages/query` 目录成对复核；目录缺失时更新只保留编辑基线中的现值。重新安装 reactor 并重启 `start` 后，刷新快照和生成类型，再运行 `pnpm api:coverage`、`pnpm api:check`、商机表单/API client 测试与完整替换的端到端回归。

商机编辑自定义字段不新增 API：它复用同一安全编辑基线、`GET /api/v1/fields/objects/OPPORTUNITY?includeInactive=false`、可选的组织成员/部门目录及既有 `PUT /api/v1/opportunities/{opportunityId}`。联调须确认基础字段始终由完整基线构造，而 `customFields` 只含用户本次明确触碰的 ACTIVE 非内置标量 code；未出现 code 保留服务端现值，空数组才触发该字段清除和必填校验。仅 `fields:read` 读取目录，USER/DEPARTMENT 值仅来自 `organization:read` 下同一身份的受限候选，FILE 与 RELATION 不可伪造成标量。运行商机表单、动态字段、API client 与完整替换回归；验证脱敏详情不回写、未知/停用 code、无效选项、不可见候选、越权字段、必填清除、过期 version 与跨租户记录均由服务端拒绝，且字段值、搜索词、基线和错误不进入 URL、持久化存储或日志。

## 市场活动批量删除联调

同一隔离后端实例必须发布 `POST /api/v1/marketing-activities/batch-delete`、`MarketingActivityBatchDeleteRequest` 与 `MarketingActivityVersionRequest`。请求只能包含 1–100 个唯一 `activityId + version`；后端必须在同一事务中先锁定并验证全体目标，再软删除活动根并撤回各自附件。任一不存在、越权或版本冲突时都不得出现部分删除。刷新快照后执行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check` 和 API client/市场活动页面回归。

## 容器化 E2E

合同商机关联筛选不新增 API：它复用 `POST /api/v1/opportunities/query` 与 `GET /api/v1/opportunities/{opportunityId}`。联调应确认仅在 `contracts:read + opportunities:read` 下出现，候选只解码 ID/名称，选择或 URL 恢复后必须由同一详情确认精确 ID 才向 `POST /api/v1/contracts/query` 发送 `opportunityId`；无权、不可见、非法或不匹配时不发送，且确认期间记录查询等待。

`compose.e2e.yml` 约定前端 E2E 使用独立 MySQL volume 和显式启用开发身份的后端镜像。先在配套后端仓库构建可执行 JAR，再构建镜像；后端 Dockerfile 使用 `start/target/atom-crm-start.jar`，不会在镜像内运行 Maven：

```bash
# 在 atom-crm 后端仓库中执行
sh ./mvnw clean install
docker build -t atom-crm:dev .
```

回到前端仓库，显式选择该镜像。Compose 的 `api` profile 会将后端切换为 `dev` 并启用 trusted header，仅可用于隔离的本地测试：

```bash
ATOM_CRM_IMAGE=atom-crm:dev docker compose -f compose.e2e.yml --profile api up -d
ATOM_CRM_API_ORIGIN=http://localhost:18080 pnpm e2e:seed
VITE_API_PROXY_TARGET=http://localhost:18080 VITE_ENABLE_DEV_AUTH=true pnpm dev
```

保持前端开发服务器运行，在另一终端执行 `pnpm test:e2e`。默认前端端口为 5173；若终端显示其他端口，应为测试设置对应的 `ATOM_CRM_WEB_E2E_BASE_URL`。

每个完整 E2E 运行开始前销毁该 compose 项目的 `mysql_e2e_data` volume，再重新启动并运行 `pnpm e2e:seed`。销毁数据是有意的环境重置操作，不能指向任何开发或生产数据库。

## 批量跟进联调

详情内单条跟进联调要求同一实例将 `ActivityUpdateRequest.nextContactTime` 发布为 `string | null`：创建仅在用户选择时发送可选时间；版本化完整编辑以精确详情基线保留该值，用户清空时显式发送 `null`。后端必须重新复核活动作者、主体写入范围、方式目录、关系和 version；联调后依次运行 `pnpm api:snapshot`、`pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、活动组件/API client 回归与完整前端基线。

同一后端实例必须继续发布 `GET /api/v1/activities/options` 与原子的 `POST /api/v1/activities/batch`。联调以拥有线索、联系人、客户或商机读取权限及 `activities:read + activities:write` 的成员验证：方式只取服务端 `METHOD` 目录；前端一次提交 1–100 条同类型记录的最小请求；服务器对每条记录重新裁决成员资格、数据范围、写可见性、同租户和方式可用性；任意一条拒绝时没有部分写入。再以缺少活动读、活动写或对象读取权限的身份确认入口、目录请求和勾选均不出现。运行 API client 与批量草稿模型测试，并执行完整前端基线；本变更不刷新 OpenAPI 快照。

## CRM CSV 导入联调

后端必须先执行 `V100__create_crm_import_drafts.sql` 及 `V101__extend_crm_import_draft_product_type.sql`，并从同一隔离实例发布 `POST /api/v1/crm-import-drafts`、`GET /api/v1/crm-import-drafts/templates/{objectType}`、`GET /api/v1/crm-import-drafts/history/{objectType}`、`GET /api/v1/crm-import-drafts/{draftId}/preview`、`GET /api/v1/crm-import-drafts/{draftId}/error-report`、`POST /api/v1/crm-import-drafts/{draftId}/confirm`、`DELETE /api/v1/crm-import-drafts/{draftId}`，以及既有 `import-draft` 附件目标的 upload intent/content/status 路由。`objectType` 必须支持 `LEAD|CONTACT|PRODUCT`；产品模板固定为 `name,code,categoryId,unit,listPrice,description,availability`。历史端点只能返回当前成员、同对象近七天已完成导入的无源文件摘要；错误报告端点只能为仍活动、预览有错误且属于当前成员的草稿重新生成固定文件名的 `rowNumber,errCode` CSV，绝不提供源附件、文件名或单元格。发布后刷新 `openapi/atom-crm.json`，依次运行 `pnpm api:generate`、`pnpm api:coverage`、`pnpm api:check`、API client/导入弹窗测试和完整前端基线。

网关必须允许认证的单段 `application/octet-stream` 上传，并保留浏览器自动设置的 `Content-Length`；建议将该路由的请求体上限设为至少 2 MB，但后端仍将 CSV 源文件硬限制为 1 MB、200 行。生产扫描配置需明确允许且检测 `text/csv`，上传暂存与应用日志不得保留原始 CSV、单元格或受控附件存储路径。联调还须验证：缺失对象写入或 `files:write` 时入口和请求均关闭；他人或过期草稿不可读写；未通过安全检查或预览有问题时不能确认；取消和成功确认都会撤回源附件；任意一行失败、并发冲突或关系/字段策略拒绝均不会留下部分线索或联系人；产品确认必须跳过已有或同文件重复的编码并保持已有产品名称、价格等字段不变。

## 开发服务器冷启动与浏览器验收

Vite 通过 `optimizeDeps.entries` 预先扫描 `app/root.tsx` 和 `app/routes/**/*.tsx` 的客户端依赖，避免空缓存启动时在首屏加载过程中重新优化依赖并返回 `504 Outdated Optimize Dep`。可访问性测试直接访问开发身份页 `/dev/session`；CI 每轮启动新服务器，继续检查 WCAG、键盘操作、布局和浏览器运行时错误。验证该配置时应在隔离 checkout 中清除 `node_modules/.vite` 后运行 `pnpm test:e2e:a11y`，保持原有错误断言，不以自动重试代替冷启动验证。
