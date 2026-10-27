# 路由、菜单与 authority 基线

2026-08-13：`/setup` 是仅用于全新部署的公开首次安装路由，不来自也不修改服务端导航树；它先读取生成的 `/api/v1/installation` 状态，只有服务端确认 `installationRequired=true` 才显示创建工作区 1 管理员的表单。`/login` 也先读取同一服务端状态：未初始化时以 history replace 自动跳转 `/setup`，读取失败时仍保留正常登录，避免短暂网络故障阻断已有用户。已初始化、并发完成或直接手动访问 `/setup` 时，安装页会以 history replace 跳回 `/`；未登录访问该首页仍由受保护路由守卫进入正常登录。页面不接受或推断 tenant、role、authority。`/password-reset` 与 `/password-reset/confirm` 同为公开认证路由。未建立浏览器会话而进入任意受保护路由时，应用将保存同源 `next` 路径并跳转 `/login`；完成租户选择后仅回到以单个 `/` 开头的路径，拒绝 `//` 等外部跳转。`/dev/session` 仍仅在 Vite 开发模式公开，正式登录页不会把它当成生产替代入口。会话建立后应用继续按既有规则先请求 `/authorization/me` 和 `/navigation`，菜单只由后者渲染。

2026-08-12：回款和发票的批量操作均是 `/crm/receivables`、`/crm/invoices` 当前桌面分页内的局部状态，不新建菜单、路由或 URL 参数。回款的转移要求 `receivables:assign + organization:read`，删除要求 `receivables:delete`；发票的转移要求 `invoices:assign + organization:read`，重置要求 `invoices:issue`，删除要求 `invoices:delete`。筛选、场景、排序、分页或身份变化废弃选择；成功只刷新同一 identity 的列表，保留既有 Drawer 和 URL 上下文。

2026-08-12：联系人与联系人公海的既有服务端导航叶子在桌面端合并为“联系人管理”局部 Context Rail：`/crm/contacts`、详情子路径与 `/crm/contact-pools`、其子路径均保留该 rail；联系人仍作为顶部主模块，联系人公海不重复列入顶部模块条，应用启动器和移动导航仍从同一服务端导航树呈现。它不增加菜单、路由或 URL 状态，也不以当前路径推断权限。

2026-08-12：客户、线索、联系人和商机既有列表的逐行“关注 / 取消关注”是局部数据操作，不新增菜单、路由或 URL 状态。它只向当前服务端列表回显的 ID 发起个人星标更新，成功后刷新同一身份的列表与可能打开的详情；场景、关键词、筛选、排序和分页保持原状。

> 2026-08-11 以迁移后的本地临时 MySQL 实例刷新 OpenAPI 并验证。目录的可跳转叶子以本文下方的菜单表为准（表格行即真实来源，不再在正文重复计数）；`/api/v1/navigation` 对对应成员返回相同的可见集合。

2026-08-12：`/crm/receivable-plans` 保持为回款管理页内的局部“回款计划”入口，而不是浏览器擅自添加的导航树节点。行级“新建回款”只进入固定的客户上下文 `/crm/customers/:customerId/receivables/new`；其 `returnTarget=receivable-plans` 是唯一允许的跨工作区返回目标，回款详情继续携带它以在关闭或删除后恢复原计划列表查询。页面“更多”中的 CSV 导出不新增路由、导航或 URL 状态，仅在服务端授权快照含 `receivable-plans:export` 时对当前工作区的已确认筛选发起认证 Blob 下载。未知返回目标和非法计划 ID 均不触发预选或重定向。

2026-08-12：同一路由在 `saved-views:read` 下增加局部“高级筛选 / 筛选方案”工具，不新增菜单或路由。选择的保存方案只以服务端 ID 作为既有列表 URL 查询状态；临时条件不写 URL，刷新即清除。该工具不传递成员、租户、字段范围或关系 ID，查询和汇总端点均由服务端按当前身份重新裁决。

2026-08-09：回款与回访既有列表和详情路由新增服务端回显的审批状态展示，不新增菜单、路由或批量审批入口。业务“记录状态”与审批实例“审批状态”独立呈现；审批动作仍只在 `approvals:read` 守卫的待办弹层中按逐实例 capability 开放。

2026-08-09：客户、线索和联系人现有列表路由新增可恢复的 `scene=subordinates` 状态，不新增菜单或可直接访问的路由。该状态仅发送生成的 `subordinateOwnerOnly=true` 给服务器；后端按当前活动成员的授权部门子树解析负责人。它不使用前端成员目录、不接受 URL 中的成员/部门 ID，且无后代范围时保持空结果。本文后续较早的“不支持下属范围”表述由本条更新取代。

2026-08-09：联系人现有列表路由新增可恢复的 `scene=starred` 状态，不新增菜单或可直接访问的路由。该状态只向联系人查询与 CSV 导出契约提交 `starred=true`，不传递成员、租户或范围 ID，也不在浏览器对已加载行二次筛选。

2026-08-09：线索列表的“导出 CSV”是 `leads:export` 守卫的局部操作，不新增菜单或路由。它只经受控 Blob 下载调用 `POST /api/v1/leads/export/csv`，转发当前已审阅的关键词、场景、保存视图或内存临时筛选；所有字段、关系条件、数据范围和下载响应头均由服务端复核。

2026-08-09：`/crm/contacts/new` 在 `contacts:write + customers:read` 下提供可选的受控客户关联：候选只来自同一身份服务端可见目录，选择后必须重新读取精确详情，确认前不允许提交 `ContactCreateRequest.customerId`。同一路由还提供可输入/选择的联系人标签；已有候选仅在 `contacts:read` 和未遮罩 TAGS 字段时从服务端目录读取，明确录入的有效标签才随创建请求发送。`/crm/customers/new` 在同时具有 `contacts:write` 时额外提供“创建并新建联系人”，客户创建成功后只把服务端回显的正客户 ID 和与其精确匹配的内部 `/crm/customers/:id` 返回路径写入同一联系人页查询参数，并走同一复核。无权限、ID 非法或详情不可见时保持失败关闭；不匹配的返回路径被丢弃并回落联系人列表，不新增菜单也不接受自由跳转。

2026-08-09：`/crm/customers/new` 在 `customers:assign + organization:read` 下额外显示可选“负责人”受控成员选择；不新增路由或菜单，候选只来自服务端在职成员目录，未选择则省略 `ownerActorId` 并由服务端默认当前成员。

2026-08-10：`/crm/customers/new` 还提供可输入/选择的客户标签，不新增路由或菜单；已有候选仅在 `customers:read` 和未遮罩 TAGS 字段时从服务端目录读取，明确录入的有效标签才随创建请求发送。

2026-08-10：`/crm/customers/new` 还在 `customers:read` 下提供可选“上级客户”受控选择，不新增路由或菜单。候选只来自同一身份服务端可见目录；选择后先重新读取精确详情，确认前禁用提交，确认后才向 `CustomerCreateRequest` 发送 `parentCustomerId`。清除选择恢复无上级创建，目录或详情失败均失败关闭已选择层级关系。

2026-08-10：`/crm/customers/new` 还提供参考表单可见的可选“详细地址”输入，不新增路由或菜单。详细地址明确填写后才随创建请求发送一个主要地址；地区、城市和邮编可选但不能脱离详细地址单独提交。创建完成后的 `/crm/customers/:customerId` 仅展示当前身份服务端回显的地址。

2026-08-10：`/crm/customers/new` 还在 `fields:read` 下读取同一身份的 `CUSTOMER` 字段目录并显示可安全编辑的自定义字段，不新增路由或菜单。字段 code 不进入 URL；USER/DEPARTMENT 只在 `organization:read` 下从受限目录选择，FILE 只在 `files:write` 下通过同一 CUSTOMER 草稿、上传 intent 与 `UPLOADED` 状态绑定。必填候选目录、文件权限或上传失败时创建保持关闭；RELATION 仍没有客户所属模块，不能以手输 ID 或自由文本替代。

2026-08-09：`/crm/contacts/new` 在 `contacts:assign + organization:read` 下额外显示可选“负责人”受控成员选择；不新增路由或菜单，候选只来自服务端在职成员目录，未选择则省略 `ownerActorId` 并由服务端默认当前成员。

2026-08-10：`/crm/contacts/new` 还在 `fields:read` 下读取同一身份的 `CONTACT` 字段目录并显示可安全编辑的自定义字段，不新增路由或菜单。USER/DEPARTMENT 只在 `organization:read` 下从受限目录选择，FILE 只在 `files:write` 下通过同一 CONTACT 草稿、上传 intent 与 `UPLOADED` 状态绑定；必填候选、文件权限或上传不可用时关闭创建。RELATION 当前没有联系人所属模块，不能退化为手输 ID 或自由文本。

2026-08-10：`/crm/leads/new` 在 `leads:write + customers:read` 下额外显示可选“关联客户”受控选择器，不新增路由或菜单。候选只来自同一身份的服务端可见目录；选择后先重新读取精确详情，确认前禁用提交，确认后才向 `LeadCreateRequest` 发送 `customerId`。同一路由还提供可输入/选择的线索标签；已有候选只在 `leads:read` 和未遮罩 TAGS 字段时从服务端目录读取，明确录入的有效标签才随创建请求发送。清除选择恢复未关联创建，目录或详情失败均失败关闭已选择客户关系。

2026-08-10：`/crm/leads/new` 还在 `fields:read` 下读取同一身份的 `LEAD` 字段目录并显示可安全编辑的自定义字段，不新增路由或菜单。USER/DEPARTMENT 只在 `organization:read` 下从受限目录选择，FILE 只在 `files:write` 下通过同一 LEAD 草稿、上传 intent 与 `UPLOADED` 状态绑定；必填候选、文件权限或上传不可用时关闭创建。RELATION 当前没有线索所属模块，不能退化为手输 ID 或自由文本。

2026-08-09：`/crm/leads/new` 在 `leads:assign + organization:read` 下额外显示可选“负责人”受控成员选择；不新增路由或菜单，候选只来自服务端在职成员目录，未选择则省略 `ownerActorId` 并由服务端默认当前成员。

2026-08-09：`/crm/products/new` 在 `products:assign + organization:read` 下额外显示可选“负责人”受控成员选择；不新增路由或菜单，候选只来自服务端在职成员目录，未选择则省略 `ownerActorId` 并由服务端默认当前成员。

2026-08-10：`/crm/products/new` 还在 `fields:read` 下读取同一身份的 `PRODUCT` 字段目录并显示可安全编辑的自定义字段，不新增路由或菜单。USER/DEPARTMENT 只在 `organization:read` 下从受限目录选择，FILE 只在 `files:write` 下通过同一 PRODUCT 草稿、上传 intent 与 `UPLOADED` 状态绑定；必填候选、文件权限或上传不可用时关闭创建。RELATION 当前没有产品所属模块，不能退化为手输 ID 或自由文本。

2026-08-10：既有 `/crm/products/:productId/edit` 不新增路由或菜单；在 `products:write` 下以服务端完整安全编辑基线保存基础字段，并仅在 `fields:read` 下显示当前身份的 PRODUCT 标量动态字段。为避免详情脱敏值形成写入基线，动态字段初始为空，只有用户明确填写或清除的当前目录 code 才随本次更新合并；USER/DEPARTMENT 仍只在 `organization:read` 下从受限目录选择。FILE 还要求 `products:read + files:read + files:write`：页面只使用同一产品详情实际回显的附件 ID 作保留基线，新候选经 target-bound upload intent、认证上传和状态刷新后才在保存时以明确 field code 替换；取消或移除会撤回未保存候选。RELATION 不降级或伪造。

2026-08-10：既有客户上下文发票详情与全局列表 Drawer 详情不新增路由或菜单；`invoices:write + contracts:read` 下的“编辑自定义字段”只在额外拥有 `fields:read` 时显示。它使用当前身份 `INVOICE` 目录的标量字段并从空白起步，只有用户明确触碰的 code 随 PATCH 合并；USER/DEPARTMENT 仍只从 `organization:read` 的受限目录选择，FILE 与 RELATION 没有替代写入入口。

2026-08-10：既有回访详情与全局列表 Drawer 详情不新增路由或菜单；`return-visits:write` 下的“编辑自定义字段”只在额外拥有 `fields:read` 且同一详情安全回显回访时间、反馈时显示。它使用当前身份 `RETURN_VISIT` 目录的标量字段并从空白起步，只有用户明确触碰的 code 随 PUT 合并；必需的回访时间与反馈原样保留，USER/DEPARTMENT 仍只从 `organization:read` 的受限目录选择，FILE 与 RELATION 没有替代写入入口。

2026-08-09：`/crm/opportunities/new` 在 `opportunities:assign + organization:read` 下额外显示可选“负责人”受控成员选择；不新增路由或菜单，候选只来自服务端在职成员目录，未选择则省略 `ownerActorId` 并由服务端默认当前成员。2026-08-10：同一路由在客户已选择且 `contacts:read` 时显示可选联系人和首要联系人；候选只来自该客户的服务端目录，切换客户会清空关系草稿。预计成交日期、预计成交金额、下次联系时间与说明不新增路由或 authority，只在用户填写时随同一次创建请求发送。

2026-08-10：`/crm/opportunities/new` 还在 `fields:read` 下读取同一身份的 `OPPORTUNITY` 字段目录并显示可安全编辑的自定义字段，不新增路由或菜单。USER/DEPARTMENT 只在 `organization:read` 下从受限目录选择，FILE 只在 `files:write` 下通过同一 OPPORTUNITY 草稿、上传 intent 与 `UPLOADED` 状态绑定；必填候选、文件权限或上传不可用时关闭创建。RELATION 当前没有商机所属模块，不能退化为手输 ID 或自由文本。

2026-08-10：既有内部路由 `/crm/opportunities/:opportunityId/edit` 不新增菜单项，仍以 `opportunities:write` 守卫。只有服务端完整安全编辑基线允许时，编辑页才在额外 `fields:read` 下读取当前身份的 `OPPORTUNITY` 目录并显示空白起步的标量自定义字段；只有明确触碰的 code 才与同一基线 version 进入 PUT。USER/DEPARTMENT 的候选仍要求 `organization:read`，FILE 与 RELATION 没有标量替代入口。

| 后端 code                            | route                                  | titleKey → zh-CN                              | requiredAuthority           | 前端阶段 |
| ------------------------------------ | -------------------------------------- | --------------------------------------------- | --------------------------- | -------- |
| `workspace.home`                     | `/`                                    | `navigation.home` → 工作台                    | `navigation:read`           | P1       |
| `crm.customers`                      | `/crm/customers`                       | `navigation.customers` → 客户                 | `customers:read`            | P3       |
| `crm.customer-pools`                 | `/crm/customer-pools`                  | `navigation.customerPools` → 客户公海         | `customer-pools:read`       | P3       |
| `crm.leads`                          | `/crm/leads`                           | `navigation.leads` → 线索                     | `leads:read`                | P3       |
| `crm.contacts`                       | `/crm/contacts`                        | `navigation.contacts` → 联系人                | `contacts:read`             | P3       |
| `crm.contact-pools`                  | `/crm/contact-pools`                   | `navigation.contactPools` → 联系人公海        | `contact-pools:read`        | P3       |
| `crm.opportunities`                  | `/crm/opportunities`                   | `navigation.opportunities` → 商机             | `opportunities:read`        | P3       |
| `crm.products`                       | `/crm/products`                        | `navigation.products` → 产品                  | `products:read`             | P3       |
| `crm.marketing-activities`           | `/crm/marketing-activities`            | `navigation.marketingActivities` → 市场活动   | `marketing-activities:read` | P8       |
| `marketing.forms`                    | `/marketing/forms`                     | `navigation.marketingForms` → 营销表单        | `marketing-forms:read`      | P6       |
| `oa.forms`                           | `/oa/forms`                            | `navigation.oaForms` → OA 表单                | `oa-forms:read`             | P6       |
| `oa.requests`                        | `/oa/requests`                         | `navigation.oaRequests` → OA 申请             | `oa-requests:read`          | P6       |
| `oa.announcements`                   | `/oa/announcements`                    | `navigation.oaAnnouncements` → 内部公告       | `oa-announcements:read`     | P6       |
| `reports`                            | `/reports`                             | `navigation.reports` → 报表                   | `reports:read`              | P6       |
| `workflow.definitions`               | `/workflows`                           | `navigation.workflowDefinitions` → 阶段工作流 | `workflows:read`            | P7       |
| `organization.tenants`               | `/organization/tenants`                | `navigation.tenants` → 租户                   | `organization:request`      | P7       |
| （内部）我的成员申请                 | `/organization/my-membership-requests` | 租户访问页 → 我的成员申请                     | `organization:request`      | P7       |
| `organization.departments`           | `/organization/departments`            | `navigation.departments` → 部门               | `organization:read`         | P7       |
| `organization.members`               | `/organization/members`                | `navigation.members` → 成员                   | `organization:read`         | P7       |
| `administration.users`               | `/administration/users`                | `navigation.users` → 用户                     | `users:read`                | P7       |
| `administration.roles`               | `/administration/roles`                | `navigation.roles` → 角色与权限               | `authorization:read`        | P7       |
| `administration.fields`              | `/administration/fields`               | `navigation.fields` → 字段管理                | `fields:read`               | P7       |
| `administration.performance-targets` | `/administration/performance-targets`  | `navigation.performanceTargets` → 业绩目标    | `dashboard-targets:read`    | P7       |
| `administration.embedded-pages`      | `/administration/embedded-pages`       | `navigation.embeddedPages` → 嵌入页面         | `embedded-pages:read`       | P7       |

工作台 `/` 继续只由服务端 `workspace.home` 菜单和 `reports:read` 路由守卫进入。客户遗忘提醒的关闭与恢复不是新菜单、路由或 URL 状态：它仅替换当前成员的版本化 `GET/PUT /api/v1/dashboard/preferences` 展示偏好，且只有服务器目录中的 `CUSTOMER_CONTACT_REMINDER` 可被隐藏。卡片是否显示不作为数据读取、工作台导航或客户详情入口的资格依据；恢复项始终在同一工作台工具栏中，不从本地缓存或前端路由推导。

客户公海目录 `/crm/customer-pools` 要求 `customer-pools:read`；池内客户页 `/crm/customer-pools/:poolId` 会先用同一身份的服务端 catalog 确认路径中的 pool ID，再请求该池专用客户分页。内部管理路由 `/crm/customer-pools/manage` 不新增菜单项，并单独要求 `customer-pools:manage`。目录、路由与前端守卫都不能替代服务端对池范围、管理员资格、成员资格或并发版本的裁决。

应用头部的“全局新建”只列出同时满足两个条件的既有创建路由：对应列表入口必须存在于服务器 `/navigation` 树，当前成员还必须拥有该对象的 `*:write` authority。它仅导航至真实的线索、客户、联系人、商机、产品、市场活动、合同、回款、发票、回访或任务创建页，不创建浏览器草稿；市场活动使用 `/crm/marketing-activities?create=1` 打开同一页的受控表单。合同、回款、发票和回访分别使用其全局 `/new` 路由，还要求 `customers:read`，并只允许从受限客户目录选择关联客户后进入既有表单或提交最小回访表单；任务新建允许显式填写完整的受支持 CRM 类型/记录 ID，但该输入不会赋予或推断目标可见性。

应用壳的主模块导航使用具名桌面 `nav` 地标，内容仍只来自 `/api/v1/navigation` 并在空间不足时由组件提供“更多”菜单；它不再通过桌面折叠侧栏隐藏条目。仅小于移动断点才显示“打开导航”按钮和 Drawer，Escape 关闭后返回该按钮；桌面与中等宽度均保留应用模块入口与横向导航。壳层本身不再充当 `main`，因此每个受保护路由保持唯一主内容地标，跳过链接只定位至共享内容起点。

`/crm/contracts`、`/crm/receivables`、`/crm/invoices` 和 `/crm/return-visits` 是对应 `*:read` 保护的全局列表路由，可作为服务器导航树下发路径的真实落点，但前端不自行添加菜单项。它们只提交关键词、分页和“我负责的”场景给各自的服务端范围化查询；后者只使用 authorization 回显的 actor ID 映射既有 `ownerActorId`，不推导下属范围。四页的客户高级筛选仅在 `customers:read` 下出现，候选及刷新后的名称均来自同一身份的受限客户 API；只有精确正 `customerId` 才可进入查询，缺少该权限时 URL 中的该参数也不会发送。发票、回款和回访还在 `contracts:read + customers:read` 下显示合同筛选，先由合同目录及同一合同详情确认精确正 `contractId` 后才进入各自查询；无权、格式异常或详情不可见时不会发送。回款还在 `receivable-plans:read + customers:read` 下显示回款计划筛选，先由计划目录及同一计划详情确认精确正 `receivablePlanId` 后才进入查询；它可与客户、合同筛选并存，任一确认未完成时不发送未收窄查询。`fields:read` 时还显示字段设置：它只读写当前成员对 CONTRACT、RECEIVABLE、INVOICE 或 RETURN_VISIT 的完整服务端布局，并且只管理本页已安全回显的固定列。合同还可提交服务端已定义的 `ACTIVE|VOIDED` 状态，发票还可提交 `PENDING|ISSUED`；页面只会从其明确发布的选项生成状态，不透传手改 URL 或已删除状态。四类页面分别只将固定 `sort` 目录映射为生成的 `sortField/sortDirection`；回访目录只含回访时间、创建/更新时间、编号和负责人，不包含备注或关系字段；发票目录不包含金额、税务、抬头或收件资料。四类全局页均在相应 `*:write + customers:read` 下提供 `/new`：合同、回款和发票选择客户后转入固定的客户上下文真实表单，回访完成最小表单；`returnTo` 仅承载同一对象的 list query，取消时恢复上下文且绝不作为自由跳转目标。合同桌面列表另仅在 `contracts:export` 时展示已选行“导出选中”：它不增加路由、菜单、URL 状态或自由查询，只把当前服务端行的 ID/version 发往固定受控下载端点。合同全局列表的编号、名称和移动摘要会用正安全 `contractId` 打开同一合同详情 Drawer；关闭、删除或退出协作仅清理该参数，保留原列表上下文。Drawer 直接读取服务端合同详情，不依赖行缓存或浏览器推断的客户 ID；客户上下文详情路由仍保留其响应 customer ID 与路径一致的校验。其余三类全局列表的详情链接只使用列表响应中未隐藏的客户 ID 生成既有客户上下文路径，缺少该 ID 时不构造跳转。

`/crm/marketing-activities` 是服务端导航树下发的 CRM 菜单叶子，读取、名称/关联对象筛选和详情抽屉均要求 `marketing-activities:read`。关联对象筛选、中文标签、编辑选项及公开表单入口都只从同一身份的 `configuration-options.relatedObjectTypes[]` 读取稳定 code、显示名称和 `supportsMarketingForm`；目录加载失败时筛选与保存关闭，浏览器不默认对象或扩展能力。名称与移动端查看入口只将正安全 `activityId` 写入当前 query；抽屉按该 ID 重新读取服务端详情，关闭或详情中删除只清理该参数，保留列表的关键词、关联对象与分页。新建与编辑需要 `marketing-activities:write`，删除需要 `marketing-activities:delete`，每个修改或删除动作只提交服务端回显的 version。参与员工只从已有的服务端在职成员目录选择，参与部门只从服务端部门目录选择并保持为独立 ID 关联；无法读取目录的身份不会得到自由输入 ID 的入口。具备 `marketing-forms:read` 时，编辑器还会从既有营销表单目录选择关联；活动详情只使用服务端回显的 ACTIVE 表单公开标识进入独立 `/public/marketing-forms/:publicId` 路由。该页面不复制营销表单的创建、字段配置或启停流程。详情内“活动图片”和“活动详情图片”分别以固定 `COVER`、`DETAIL` 参数读取；列表和下载另需 `files:read`，上传与撤回另需 `marketing-activities:write + files:write`。这些只控制入口，不把图片类别或数量作为浏览器裁决，服务端继续按当前成员、活动访问权、9 张上限和附件 version 作最终裁决。

`/marketing/forms` 的详情 Drawer 不增加路由或菜单项：列表只把服务端回显 ID 交给当前 identity 的单条详情查询，加载成功后才显示字段、公开链接、趋势、关联线索和版本化生命周期动作；读取失败不会以列表行降级为详情或动作基线。

`/oa/forms` 与 `/oa/requests` 也不为表单详情新增路由或菜单项。OA 表单编辑、状态变更、删除只将列表 ID 留在页面瞬态状态，先重新读取同一身份可见的详情，读取成功后才开放相应的 version 化动作；移动端与桌面端相同。发起申请时的可用表单下拉只保留选择 ID，随后重新读取当前可提交详情，失败则保留原列表、清除待填内容并禁用预览/提交，不以旧列表字段、状态或 version 继续操作。OA 申请详情中的 FILE 下载不新增 URL 状态：仅当前详情回显附件且同时具备 `files:read` 时出现，关闭 Drawer 即清除当前定位。

显式启用开发身份时，头部“租户”菜单只有当前服务端 authorization 包含 `organization:request` 才会按需读取 `GET /organization/tenants`。`/authorization/me` 与 `/navigation` 都使用同一份服务端有效权限：数据库解析的租户角色授权会与已验证认证上下文中的平台权限合并，因此导航下发的租户入口不会被前端路由守护误拦截。候选只使用后端返回的已授权 tenant ID 与可选部门 ID；选择后还会请求同一目标的 `/access` 并要求 `granted=true` 与 ID 精确匹配，才更新当前标签页的开发 sessionStorage 并回到根路由重新完成授权、导航和数据加载。它不接受自由输入、不从 URL 或本地 authority 推导租户，更不作为生产租户切换机制；生产身份切换必须由身份提供方改变受信调用上下文。

`/organization/departments` 已实现为部门与成员工作台：`organization:read` 才读取目录、选择部门和查询成员，`organization:write` 才显示结构操作。`departmentId`、`memberKeyword`、`includeDescendants`、`memberPage`、`memberSize` 仅表达恢复后的选中/查询意图；只有选中 ID 仍在当前服务端目录中，页面才调用受限的部门成员分页接口，切换树节点或范围只重置成员页码。`includeDescendants=true` 由具名 `DepartmentMemberQueryRequest` 交给服务端裁决当前可见根部门及在职后代范围，不能把 URL、目录缓存或浏览器子树枚举当作成员授权范围；专用成员行由服务器解析部门，登录名和活动角色分别只在 `users:read`、`roles:read` 下投影，岗位、性别和直属上级继续关闭。`/organization/members` 仍是仅服务端可见成员的独立关键词分页目录，同样要求 `organization:read`。成员关键词输入在历史导航或外部链接恢复 URL 条件时同步更新，未提交草稿不会被分页刷新清除。成员页在 `organization:write` 下可进入内部审核路由 `/organization/membership-requests`：它只分页读取当前租户的服务端申请，并只对 `PENDING` 项发送通过或驳回动作；通过后会刷新审核页并精确失效同一身份下所有成员目录分页，成员资料始终重新由服务端返回。租户访问页在 `organization:request` 下可进入内部路由 `/organization/my-membership-requests`：申请人可提交、分页查看和撤回自己的申请；目标租户 ID 仅能由邀请或管理员提供，页面不提供全局租户/部门枚举。两个内部路由都不新增服务端菜单项，且不会因直接输入路径而绕过服务端菜单或 authority 防护。

`/administration/users` 已替换用户菜单占位：`users:read` 才读取当前租户的具名 `UserPageResponse`；`users:write` 才显示新建和状态切换，`users:delete` 才显示软删除确认。用户名、邮箱、状态和分页参数仅是服务端查询输入，所有权限、租户范围和生命周期约束仍由服务端复核。新建用户会在同一服务端命令中建立活动成员资料、当前租户成员资格和基础成员角色；停用、锁定、恢复和软删除会同步该成员访问状态。写入成功时浏览器同时失效用户和同一身份成员目录缓存，不在本地拼接成员行。用户名和邮箱输入会在其对应 URL 参数经历史导航或外部链接恢复时同步更新；未提交的搜索草稿不因其他筛选或分页改动被清除，清空输入则移除对应参数并回到第一页。

`/administration/roles` 已替换角色菜单的占位页：`authorization:read` 才读取服务端角色分页；同时具有 `authorization:write + authorization:assign` 时才显示新建、编辑、复制、授权替换和删除，所有写入都携带服务端当前 version。成员分配单独要求 `authorization:assign`；新增成员还要求 `organization:read`，并且只能从服务端可见在职目录选择，不能手输 actor ID。数据范围没有服务端范围目录时只保留已有服务端 scope，新增授权不在浏览器猜测 scope。

`/administration/fields` 已实现为字段管理页：`fields:read` 才读取服务端对象、字段和当前成员布局；`fields:write` 才显示自定义字段的创建、编辑和停用，且只对服务端回显的非系统启用字段开放。布局保存使用服务端完整基线，初始 `null` version 不伪造为数值。角色字段策略还需要 `authorization:read` 才读取服务器角色目录，保存额外需要 `authorization:write + authorization:assign`；角色、字段、枚举与版本全部来自相应服务端响应，浏览器不提供 ID 或权限值的自由输入。

`/administration/performance-targets` 是服务端导航在 `dashboard-targets:read` 下明确下发的业绩目标页。成员/部门、年度均由 URL 恢复：成员页管理月度合同金额，部门页管理年度、季度和月度合同金额；所有主体资格、目标唯一性、金额口径和 version 均由服务端契约决定。`dashboard-targets:write` 才显示设置、编辑、删除和部门周期批量设置，并始终提交服务端回显 version。具有 `organization:read` 时成员只能从同一身份的在职成员目录搜索选择、部门只能从同一身份可见的活动部门目录选择；没有目录读取权限时仅可提交明确 ID，服务端仍会复核范围、当前租户和活动状态，不以输入扩大目录可见性。部门各周期是独立配置，浏览器不会自动汇总、拆分、换算或伪造完成额；批量弹窗只提交用户填写的周期，并为既有周期携带打开时的 version，由 `PUT /api/v1/dashboard/department-performance-targets/batch` 在一个事务中全成或全败。文件批量导入仍因缺少独立的安全上传与导入契约而关闭。

`dashboard-targets:write` 现也显示“导入 CSV”。该入口不是导航或文件权限的替代：它只在浏览器内把选择的受限 CSV 转换成生成的请求行，然后调用成员或部门各自的原子导入路由；文件本身不会上传或持久化。服务端继续独立裁决写权限、主体范围和有效状态，导入不会扩大成员/部门目录可见性。

`/administration/embedded-pages` 已替换嵌入页面菜单占位：`embedded-pages:read` 才读取服务端对象、平台、状态目录和 URL 分页配置；`embedded-pages:write` 才显示创建、编辑和删除。创建只使用目录中的对象和平台并由服务端置为停用；更新、删除始终使用原响应的 version，删除入口只对服务端回显 `INACTIVE` 的项出现。客户详情内同一读取权限下会请求当前 `CUSTOMER` 记录的服务端渲染页面，前端不会替换模板变量或自行判定记录可见性。

`/administration/connectors` 是不新增侧栏目录项的内部控制面：应用头部的“应用设置”菜单只向 `connectors:read` 成员显示“打开连接器”，路由、列表、详情和筛选同样要求该权限。创建、轮换凭证、撤销、启停和不可逆退役额外要求 `connectors:manage`，每次写入只使用同一服务端摘要中的 version。状态、凭证 key ID 与分页均由具名响应返回；`connector-ingress/probe` 是非人工入口，绝不在 Web 中呈现或调用。

`/administration/enterprise-data` 同样不新增侧栏项，应用头部的“应用设置”菜单只向 `enterprise-data:read` 成员显示“查看企业数据”。名称查询与精确查询只消费服务端的 `EnterpriseDataObservationResponse`；采纳操作先读取目标 Customer 的当前 version，再请求调用方绑定的 `EnterpriseDataAdoptionPreviewResponse`，最终只提交预览中列出的事实、预览自身的引用和同一 Customer version。前端不推断来源、可采纳事实、身份、版本或权限。

应用头部“应用设置”菜单中的“设置菜单”只向 `navigation:read` 成员显示，并按需读取当前成员版本化偏好。候选树必须使用偏好响应中的 `availableItems`：它是服务端按调用者当前权限过滤、但尚未应用个人隐藏规则的树，因此被隐藏的菜单仍可恢复；前端不会从已应用偏好的 `/navigation` 结果或管理员菜单目录推导候选。`navigation:write` 才能保存，同级菜单可调整顺序、任意候选可隐藏或恢复；保存保留服务端基线中当前候选之外的 code，首次 `null` version 一律省略，成功后重新读取启动导航。

客户列表名称和“查看”在 `/crm/customers` 使用 `customerId=<id>` search param 打开同一详情 Surface 的 Drawer，而不是新增服务端菜单项；关闭 Drawer 仅移除该参数，分页、保存视图和关键词仍保留。直接地址 `/crm/customers/:customerId` 仍可访问并使用同一个 Surface。两种入口都要求 `customers:read`；基础编辑需要 `customers:write`，负责人和协作者管理需要 `customers:assign`，负责人候选还需要 `organization:read`，客户删除额外需要 `customers:delete`。客户列表的“字段设置”不新增路由或菜单，仅在 `fields:read` 下读取和更新当前成员的服务端布局；它只能影响页面已安全投影的列，不能用布局推导或扩大字段读取权限。桌面顶栏的模块导航和客户 Context Rail 均由 `/api/v1/navigation` 的授权可见树生成；Context Rail 只显示当前响应中存在的客户和客户公海叶子。附近客户内部路由为 `/crm/customers/nearby`，从客户列表进入，不新增菜单项，同样要求 `customers:read` 与用户主动的浏览器定位授权。联系人列表名称可进入内部详情路由 `/crm/contacts/:contactId`，该路由不新增菜单项且同样需要 `contacts:read`；其中基础编辑（含下次联系时间的修改或清空）、客户关联的设置/更换/确认清除、层级和入池需要 `contacts:write`，客户关联操作还需 `customers:read`，负责人和协作者管理需要 `contacts:assign`，负责人候选还需要 `organization:read`，联系人删除额外需要 `contacts:delete`。联系人公海目录的内部管理子路由为 `/crm/contact-pools/manage`，不自行添加服务端菜单项，且单独要求 `contact-pools:manage`。线索列表名称可进入内部详情路由 `/crm/leads/:leadId`；该路由不新增菜单项并要求 `leads:read`，基础编辑（含下次联系时间的修改或清空）、可见层级读取，以及客户关联设置/更换/确认清除需要 `leads:write`；设置或清除上级只在 `leads:write` 下显示，候选仍由同一身份的线索读取范围裁剪。客户关联操作还需 `customers:read`，负责人和协作者管理需要 `leads:assign`，负责人候选还需要 `organization:read`，转换需 `leads:convert`、`customers:write` 与 `contacts:write`，线索删除额外需要 `leads:delete`。线索默认场景为未转化，URL `scene=converted` 只映射生成契约 `converted=true`，未转化和“我负责的”映射为 `converted=false`；不支持下属范围时不显示该伪场景。附近线索内部路由为 `/crm/leads/nearby`，从客户列表进入，不新增菜单项，同样要求 `leads:read` 与用户主动的浏览器定位授权。仅在服务端明确授予 `leads:write` 时显示并允许进入内部新建路由 `/crm/leads/new`，详情页的内部编辑路由 `/crm/leads/:leadId/edit` 同样需要该 authority。`/crm/opportunities` 已替换商机菜单叶子的阶段占位页，列表与请求均受 `opportunities:read` 保护；列表名称可进入内部详情路由 `/crm/opportunities/:opportunityId`，该路由不新增菜单项，同样需要 `opportunities:read`。新建路由 `/crm/opportunities/new` 需要 `opportunities:write`；其服务端客户校验还要求 `customers:read`，前端管线/阶段选择要求 `opportunity-pipelines:read`。`/crm/products` 已替换产品菜单叶子的阶段占位页，列表和请求均受 `products:read` 保护；列表名称可进入内部详情路由 `/crm/products/:productId`，该路由不新增菜单项且同样需要 `products:read`，其中产品上下架额外需要 `products:write`，负责人变更同时需要 `products:assign` 和 `organization:read`，产品删除额外需要 `products:delete`。新建产品内部路由 `/crm/products/new` 需要 `products:write`；分类管理内部路由 `/crm/products/categories` 需要 `products:read`，其中根分类、服务端树父级下的子分类创建、分类重命名及移动额外需要 `products:write`，分类删除额外需要 `products:delete`。产品完整编辑已注册为不新增菜单项的内部路由 `/crm/products/:productId/edit`；进入需 `products:write`，且仅在服务端安全基线确认完整替换字段未遮罩且可写时显示。

联系人附近检索使用内部路由 `/crm/contacts/nearby`，从联系人列表进入，不新增菜单项；它要求 `contacts:read` 与用户主动的浏览器定位授权。URL 只恢复半径、分页和每页大小，准确坐标仅存于当前页面内存和 identity 隔离的查询键中。

头部“工具与设置”在 `organization:request` 下提供“更新我的资料”弹窗，不增加导航树节点或 URL 路由；它仅更新当前调用者的本地 profile，不能用于切换租户、成员资格或权限。

销售管线管理使用内部路由 `/crm/opportunities/pipelines`，由商机列表的 `opportunity-pipelines:manage` 操作入口进入，不新增服务端菜单项；路由读取需要 `opportunity-pipelines:read`，编辑、生命周期和删除另需要 `opportunity-pipelines:manage`。该目录权限不从商机数据范围推导，所有操作仍以服务端返回的当前 version 为基线。

更正：线索层级读取随详情 route 的 `leads:read` 提供；只有设置或清除上级线索才需要 `leads:write` 和当前详情 version。该动作不新增菜单或路由。

线索和联系人详情内的“修改状态”同样不新增菜单或路由。它们分别需要 `leads:write` 或 `contacts:write`，并且仅在详情完整回显锁定值和 `OPEN|WON` 成交状态时显示；保存使用当前详情 version。

线索和联系人详情内的“管理标签”同样不新增菜单或路由。它们分别在既有 `leads:read` 或 `contacts:read` 详情路由内要求 `leads:write` 或 `contacts:write`，打开后才读取同一身份服务端可见的标签目录；目录不可用时不允许保存，替换请求仅携带当前详情 version 和用户确认的完整标签集合。

客户详情的协作者管理不新增路由或菜单项：`customers:assign` 才显示，打开对话框后才读取服务端完整版本化基线，新增候选另需 `organization:read`；基线不可用时不允许编辑或保存。`customers:write` 下的“退出协作”经明确确认后提交当前详情 version，服务端决定调用者是否可退出。

客户详情的“编辑自定义字段”同样不新增路由或菜单项，须同时具有 `customers:write + fields:read`。编辑器只从当前身份 `CUSTOMER` 目录收集用户明确触碰的 ACTIVE 非内置标量 code，并从空白开始；版本化 PUT 只合并这些 code，详情投影不作为草稿。USER/DEPARTMENT 候选另需 `organization:read` 的受限目录；目录失败禁用保存，FILE 和 RELATION 不提供伪造写入入口。

联系人详情的“编辑自定义字段”同样不新增路由或菜单项，须同时具有 `contacts:write + fields:read`。编辑器只从当前身份 `CONTACT` 目录收集用户明确触碰的 ACTIVE 非内置标量 code，并从空白开始；版本化 PUT 只合并这些 code，详情投影不作为草稿。USER/DEPARTMENT 候选另需 `organization:read` 的受限目录；目录失败禁用保存，FILE 和 RELATION 不提供伪造写入入口。

线索详情的“编辑自定义字段”同样不新增路由或菜单项，须同时具有 `leads:write + fields:read`。编辑器只从当前身份 `LEAD` 目录收集用户明确触碰的 ACTIVE 非内置标量 code，并从空白开始；版本化 PUT 只合并这些 code，详情投影不作为草稿。USER/DEPARTMENT 候选另需 `organization:read` 的受限目录；目录失败禁用保存，FILE 和 RELATION 不提供伪造写入入口。

客户列表自定义字段排序不增加路由或菜单：`fields:read` 下页面读取当前成员字段目录，并将合格字段的排序状态写为 `sort=custom:<fieldCode>:asc|desc`。刷新、前进、后退均可恢复；字段目录不再确认该 code 时安全使用默认排序。该 URL 只表达排序意图，字段可读性、脱敏和记录范围仍由客户查询端裁决。

线索列表自定义字段排序同样不增加路由或菜单：页面读取当前成员字段目录，并将合格字段的排序状态写为 `sort=custom:<fieldCode>:asc|desc`。刷新、前进、后退均可恢复；字段目录不再确认该 code 时安全使用默认排序。该 URL 只表达排序意图，字段可读性、脱敏和记录范围仍由线索查询端裁决。

联系人列表自定义字段排序同样不增加路由或菜单：页面读取当前成员字段目录，并将合格字段的排序状态写为 `sort=custom:<fieldCode>:asc|desc`。刷新、前进、后退均可恢复；字段目录不再确认该 code 时安全使用默认排序。该 URL 只表达排序意图，字段可读性、脱敏和记录范围仍由联系人查询端裁决。

商机列表自定义字段排序同样不增加路由或菜单：页面读取当前成员字段目录，并将合格字段的排序状态写为 `sort=custom:<fieldCode>:asc|desc`。刷新、前进、后退均可恢复；字段目录不再确认该 code 时安全使用默认排序。该 URL 只表达排序意图，字段可读性、脱敏和记录范围仍由商机查询端裁决。

商机列表的条数与预计成交总额是同一页的非导航汇总，不增加 URL、路由或菜单。它只提交当前关键词、客户、场景、保存视图和临时条件给 `POST /api/v1/opportunities/summary`；页码与排序不影响汇总。服务端独立复核 `opportunities:read`、数据范围和预计金额字段未遮罩条件，读取失败时页面不以列表行或本地计算补出总额。

产品列表自定义字段排序同样不增加路由或菜单：页面读取当前成员字段目录，并将合格字段的排序状态写为 `sort=custom:<fieldCode>:asc|desc`。刷新、前进、后退均可恢复；字段目录不再确认该 code 时安全使用默认排序。该 URL 只表达排序意图，字段可读性、脱敏和目录可见性仍由产品查询端裁决。

商机列表名称和“查看”现使用 `opportunityId=<id>` 打开同一详情 Surface 的 Drawer，关闭仅移除该参数，关键词、客户筛选、场景、排序、保存视图和分页仍保留；本条取代上一段关于商机列表名称直接进入详情路由的历史描述。内部详情路由 `/crm/opportunities/:opportunityId` 仍不新增菜单项，并同样要求 `opportunities:read`。

产品列表名称和“查看”现使用 `productId=<id>` 打开同一详情 Surface 的 Drawer，关闭仅移除该参数，关键词、分类筛选、场景、排序、保存视图和分页仍保留；本条取代上一段关于产品列表名称直接进入详情路由的历史描述。内部详情路由 `/crm/products/:productId` 仍不新增菜单项，并同样要求 `products:read`。

联系人与商机全局列表仅在 `customers:read` 下显示客户筛选。候选和 URL 恢复后的标签都来自同一身份下的受限客户目录与详情；只有已确认的精确正 `customerId` 才会交给联系人或商机查询，缺少权限、无效 URL 或不可见详情均不会临时请求未收窄列表。联系人 CSV 导出沿用该已确认范围，不新增路由或菜单项。

联系人详情的协作者管理不新增路由或菜单项：`contacts:assign` 才显示，打开对话框后才读取服务端完整版本化基线，新增候选另需 `organization:read`；基线不可用时不允许编辑或保存。`contacts:write` 下的“退出协作”经明确确认后提交当前详情 version，服务端决定调用者是否可退出。

线索详情的协作者管理同样不新增路由或菜单项：`leads:assign` 才显示，打开对话框后才读取服务端完整版本化基线，新增候选另需 `organization:read`；基线不可用时不允许编辑或保存。`leads:write` 下的“退出协作”经明确确认后提交当前详情 version，服务端决定调用者是否可退出。

产品全局列表在 `products:read` 下显示“筛选产品分类”。分类树仅作同一服务端产品目录的受控候选，候选搜索不触发本地产品筛选；只有 URL 中精确正的 `categoryId` 仍在当前树时才向产品查询发送，确认、清除和分页均保留其余 URL 上下文。此入口不新增路由或菜单项。

商机详情中的阶段、结果及首要联系人更新需要 `opportunities:write`，阶段还需要 `opportunity-pipelines:read`；负责人变更同时需要 `opportunities:assign` 和 `organization:read`，协作者管理需要 `opportunities:assign`，新增协作者再需要 `organization:read` 的受限成员目录；退出协作需要 `opportunities:write`，删除额外需要 `opportunities:delete`。协作者管理只在用户打开对话框后读取服务端完整基线，且这些动作均不会新增服务端菜单项。

客户、线索、联系人、商机、合同、发票、回款和单条回款计划详情内的跟进时间线均不新增侧栏入口，读取额外需要 `activities:read`，且始终由服务端复核当前对象可见性。

上述详情内的“写跟进”同样不新增侧栏入口，只有同时具有 `activities:read` 和 `activities:write` 时才展示；读取方式目录仍需要 `activities:read`，并可填写可选下次联系时间；目标对象的写入范围由服务端最终复核。

客户详情内的“查看回访”使用内部路由 `/crm/customers/:customerId/return-visits`，不新增服务端菜单项，且单独要求 `return-visits:read`。列表只以路径客户 ID 作为筛选输入；服务端仍复核回访读取权限、`CUSTOMER` 字段未遮罩读取权限和该客户可见性。列表编号可进入同样不新增菜单的 `/crm/customers/:customerId/return-visits/:returnVisitId`；详情会要求服务端返回的未遮罩客户 ID 与路径一致，避免跨客户上下文展示。列表中的新建入口和内部路由 `/crm/customers/:customerId/return-visits/new` 额外要求 `return-visits:write`；它提交当前客户、回访时间及用户确认的可选字段，未选择回访人时由服务端确定。全局 `/crm/return-visits/new` 同样需要 `return-visits:write`，另由 `customers:read` 保护关联客户目录，候选只保留服务器回显的 ID 与名称。两个新建页仅在 `return-visits:assign + organization:read` 时开放回访人目录，且只提交用户选择的成员 ID；留空继续走服务端默认。详情中的“编辑回访”与 `/crm/customers/:customerId/return-visits/:returnVisitId/edit` 同时要求回访读写权限；编辑只更新时间和备注，使用当前 version，且不提交联系人或合同关联。详情中的“选择/更换/确认清除联系人”不新增路由，要求 `return-visits:write`、`contacts:read` 与 `customers:read`；“选择/更换/确认清除合同”对应要求 `return-visits:write`、`contracts:read` 与 `customers:read`。两个入口均以服务端返回的完整基线和关系状态为条件；清除仅发送当前关系的显式 `null`，另一个关系继续省略保留。详情中的“变更负责人”不新增路由，要求 `return-visits:assign` 与 `organization:read`，只从服务端在职成员目录选择。“删除回访”同样不新增路由，仅在 `return-visits:delete` 下经确认提交详情原始 version，成功后关闭当前详情并刷新列表；服务端决定删除范围、附件撤回与并发。详情中的“发起审批”不新增路由，仅在 authorization 含 `approvals:submit` 时显示；它把同一回访 ID 交由现有审批起始、候选、预览和提交端点，并由服务端复核记录可见性与审批资格。

客户详情内的“查看合同”使用内部路由 `/crm/customers/:customerId/contracts`，不新增服务端菜单项，并同时要求 `contracts:read` 与 `customers:read`。路径客户 ID、页码、每页数量和关键词只是服务端查询筛选；服务端仍复核合同读取权限、`CUSTOMER` 字段未遮罩读取权限和该客户可见性。列表编号可进入同样不新增菜单的 `/crm/customers/:customerId/contracts/:contractId`；详情会要求服务端返回的未遮罩客户 ID 与路径一致，避免跨客户上下文展示。详情中服务端同时回显名称和编号时，“编辑基本信息”额外要求 `contracts:write`，PATCH 只提交用户实际修改的名称/编号与 version；客户、关联对象、金额与折扣没有编辑入口。`contracts:write + products:read` 下的“管理合同产品”不新增路由，打开后才取得完整、版本化产品基线并以该 version 替换全部产品行；候选仅来自服务端可售目录，单价留空由服务端决定，浏览器不展示或计算折扣/金额。`contracts:write + fields:read` 下的“编辑自定义字段”只从当前目录收集用户明确触碰的 ACTIVE 非内置标量 code，详情显示值不作为草稿，附件仍没有编辑入口。“变更负责人”额外要求 `contracts:assign` 与 `organization:read`，候选仅来自服务端在职成员目录并提交返回的 version；“管理协作者”额外要求 `contracts:assign`，只能先读取服务端完整协作者基线后以该基线 version 替换，新增候选还需要 `organization:read`；“退出协作”额外要求 `contracts:write` 并经明确确认，服务端确认调用者是否为协作者。服务端回显 ACTIVE 的详情中，“作废合同”额外要求 `contracts:write` 并经过明确确认，提交返回的 version；“删除合同”额外要求 `contracts:delete` 并经过明确确认，提交返回的 version；不提供全局合同菜单。

客户合同列表中的“新建合同”与内部路由 `/crm/customers/:customerId/contracts/new` 额外要求 `contracts:write`；创建提交路径客户、名称、编号和用户明确选择的目录字段。产品选择额外需要 `products:read`，且只能使用服务端目录中当前可见的产品；没有该权限时仍可创建显式空产品集合。联系人和商机选择分别额外需要 `contacts:read` 或 `opportunities:read`，且候选只能来自当前客户的服务端范围化目录；未选时不发送关联 ID。仅 `contracts:assign + organization:read` 可从服务端在职成员目录选择负责人，未选即省略 `ownerActorId` 并由服务端默认当前成员。服务端仍复核客户可见性、合同字段写入权限、编号规范化唯一性以及创建权限，前端不补日期、价格/金额、协作者、动态字段或附件。

2026-08-10：`/crm/customers/:customerId/contracts/new` 还在 `fields:read` 下读取同一身份的 `CONTRACT` 字段目录并显示可安全编辑的自定义字段，不新增路由或菜单。USER/DEPARTMENT 只在 `organization:read` 下从受限目录选择，FILE 只在 `files:write` 下通过同一 CONTRACT 草稿、上传 intent 与 `UPLOADED` 状态绑定；必填候选、文件权限或上传不可用时关闭创建。RELATION 当前没有合同所属模块，不能退化为手输 ID 或自由文本。

2026-08-10：既有客户上下文合同详情与全局列表 Drawer 详情不新增路由或菜单；`contracts:write` 下的“编辑自定义字段”只在额外拥有 `fields:read` 时显示。它使用当前身份 `CONTRACT` 目录的标量字段并从空白起步，只有用户明确触碰的 code 随 PATCH 合并；USER/DEPARTMENT 仍只从 `organization:read` 的受限目录选择，FILE 与 RELATION 没有替代写入入口。

客户详情内的“查看开票资料”使用内部路由 `/crm/customers/:customerId/invoice-profiles`，不新增服务端菜单项，并同时要求 `invoices:read` 与 `customers:read`。路径客户 ID 只是 `GET /api/v1/invoice-profiles` 的服务端筛选输入；服务端仍复核发票读取权限和客户可见性。列表中的“新建个人抬头”及内部路由 `/crm/customers/:customerId/invoice-profiles/new` 额外要求 `invoices:write`；首期固定提交当前客户、`INDIVIDUAL` 与用户确认的抬头。服务端回显 `INDIVIDUAL` 的条目在同一写入权限下可打开“编辑个人抬头”弹窗，PATCH 仅提交新抬头和该条目 version；组织抬头及其他资料字段没有编辑入口。每个当前客户条目的删除操作额外要求 `invoices:delete`，使用服务端回显的 version 并经过显式确认。

客户详情内的“查看发票”使用内部路由 `/crm/customers/:customerId/invoices`，不新增服务端菜单项，并同时要求 `invoices:read` 与 `customers:read`。路径客户 ID、URL 页码与每页数量只是生成 `InvoiceQueryRequest` 的服务端筛选输入；服务端仍复核发票读取权限、`CUSTOMER` 字段未遮罩读取权限和客户可见性。申请编号可进入内部详情路由 `/crm/customers/:customerId/invoices/:invoiceId`，该路由只在服务端回显 customer ID 精确匹配路径时展示窄投影。客户详情及列表的“新建发票”使用内部路由 `/crm/customers/:customerId/invoices/new`，同时要求 `invoices:write`、`contracts:read` 与 `customers:read`；合同仅可由同一客户的服务端合同查询选择，表单提交用户确认的正金额、申请日期、发票类型、个人或单位抬头及可选寄送/备注字段。单位抬头的纳税人识别号必填，单位资料只在该类型下发送；额外拥有 `invoices:assign` 与 `organization:read` 时，可从服务端在职成员目录明确选择负责人，未选择时不发送 `ownerActorId`，由服务端默认当前成员。`fields:read` 下，ACTIVE 非内置 INVOICE 标量字段按当前身份的字段目录显示，USER/DEPARTMENT 只能从 `organization:read` 的受限目录选择，FILE 只能在 `files:write` 下从同一 INVOICE 草稿的 `UPLOADED` 上传结果绑定；必填候选、文件、目录或 RELATION 不能安全完成时保持关闭，浏览器不计算金额也不提供审批人输入。详情在服务端同时回显申请日期与发票类型时，“编辑基本信息”额外要求 `invoices:write` 与 `contracts:read`，PATCH 只提交用户实际修改的这两项及 version；金额、抬头、税务、银行、联系人、收件信息、物流、备注、动态字段和附件没有编辑入口。详情中的“变更负责人”额外要求 `invoices:assign` 与 `organization:read`，候选仅来自服务端在职成员目录并提交返回的 version；服务端回显 PENDING 的详情中，“登记开票结果”额外要求 `invoices:issue`，仅提交本次直接填写的发票号码、开票日期、可选物流单号与当前 version；服务端回显 ISSUED 的详情中，“重置开票结果”额外要求 `invoices:issue` 并经过明确确认，提交返回的 version；“删除发票”额外要求 `invoices:delete` 并经过明确确认，提交返回的 version；其余编辑仍未开放。

客户详情内的“查看回款”使用内部路由 `/crm/customers/:customerId/receivables`，不新增服务端菜单项，并同时要求 `receivables:read` 与 `customers:read`。路径客户 ID、URL 页码与每页数量只是生成 `ReceivableQueryRequest` 的服务端筛选输入；服务端仍复核回款读取权限、`CUSTOMER` 字段未遮罩读取权限和客户可见性。回款编号可进入内部详情路由 `/crm/customers/:customerId/receivables/:receivableId`，该路由只在服务端回显 customer ID 精确匹配路径时展示窄投影。客户详情及列表的“新建回款”使用内部路由 `/crm/customers/:customerId/receivables/new`，同时要求 `receivables:write`、`contracts:read` 与 `customers:read`；合同仅可由同一客户的服务端合同查询选择，首期提交所选合同、用户确认的到账日、正回款金额、收款方式和可选备注。额外拥有 `receivable-plans:read` 且服务端返回可用目录时，可选关联同一合同的计划；金额字段不会展示或保留，回款计划读权限缺失时维持未关联回款。额外拥有 `receivables:assign` 与 `organization:read` 时，可从服务端在职成员目录明确选择负责人；未选择时不发送 `ownerActorId`，由服务端默认当前成员。备注只在当前表单和本次认证请求中携带；`fields:read` 下 ACTIVE 非内置 RECEIVABLE 标量字段按当前身份目录显示，USER/DEPARTMENT 只从 `organization:read` 的受限目录选择，FILE 仅在 `files:write` 下绑定同一 RECEIVABLE 草稿中 `UPLOADED` 的服务端 ID。必填目录、候选、文件或 RELATION 不能安全完成时保持关闭。详情在服务端回显回款日期时，“编辑回款日期”额外要求 `receivables:write` 与 `contracts:read`，PATCH 只提交用户实际修改的日期和 version；关联计划、金额、支付方式、备注、负责人、动态字段和附件没有编辑入口。详情中的“变更负责人”额外要求 `receivables:assign` 与 `organization:read`，候选仅来自服务端在职成员目录并提交返回的 version；“删除回款”额外要求 `receivables:delete` 并经过明确确认，提交返回的 version；详情中的“发起审批”不新增路由，仅在 authorization 含 `approvals:submit` 时显示；它把同一回款 ID 交由现有审批起始、候选、预览和提交端点，并由服务端复核记录可见性与审批资格。其余编辑仍未开放。

2026-08-10：回款详情在既有读取、客户、回款写入与合同读取守卫外，只有额外具有 `fields:read` 时才显示不新增路由或菜单的“编辑自定义字段”弹窗。它从当前身份的 RECEIVABLE 目录空白开始，版本化 PATCH 只合并本次明确填写或清除的 ACTIVE 非内置标量 code；未触碰 code 保持服务端原值，详情投影绝不作为写入基线。USER/DEPARTMENT 候选还要求 `organization:read` 的受限目录，目录失败禁用保存，FILE 和 RELATION 不提供伪造入口。

客户详情内的“查看回款计划”使用内部路由 `/crm/customers/:customerId/receivable-plans`，不新增服务端菜单项，并同时要求 `receivable-plans:read` 与 `customers:read`。路径客户 ID、URL 页码与每页数量只是生成 `ReceivablePlanQueryRequest` 的服务端筛选输入；服务端仍复核回款计划读取权限、`CUSTOMER` 字段未遮罩读取权限和客户可见性。期数可进入内部详情路由 `/crm/customers/:customerId/receivable-plans/:planId`，该路由只在服务端回显 customer ID 精确匹配路径时展示窄投影。客户详情及列表的“新建回款计划”使用内部路由 `/crm/customers/:customerId/receivable-plans/new`，同时要求 `receivable-plans:write`、`contracts:read` 与 `customers:read`；合同仅可由同一客户的服务端合同查询选择，单条表单提交所选合同、用户确认的到期日、正计划金额、收款方式、提醒、备注和字段目录驱动的动态值。`fields:read` 下 USER/DEPARTMENT 仅从 `organization:read` 受限目录选择，FILE 仅在 `files:write` 下绑定同一 RECEIVABLE_PLAN 草稿中 `UPLOADED` 的 ID；必填目录、候选、文件或 RELATION 不可安全完成时关闭。`/crm/customers/:customerId/receivable-plans/batch-new` 使用同一权限和合同目录，最多提交 100 条用户直接填写的日期、正金额与收款方式，不提交负责人、提醒、备注、附件或动态字段。详情在服务端回显到期日期时，“编辑到期日期”额外要求 `receivable-plans:write` 与 `contracts:read`，PATCH 只提交用户实际修改的日期和 version；计划金额、支付方式、提醒、备注、负责人、动态字段和附件没有编辑入口，是否已有回款历史仍由服务端决定。详情中的“删除回款计划”额外要求 `receivable-plans:delete` 与 `contracts:read` 并经过明确确认，提交返回的 version；其余编辑仍未开放。

2026-08-10：回款计划详情在既有读取、客户、计划写入与合同读取守卫外，只有额外具有 `fields:read` 时才显示不新增路由或菜单的“编辑自定义字段”弹窗。它从当前身份的 RECEIVABLE_PLAN 目录空白开始，版本化 PATCH 只合并本次明确填写或清除的 ACTIVE 非内置标量 code；未触碰 code 保持服务端原值，详情投影绝不作为写入基线。USER/DEPARTMENT 候选还要求 `organization:read` 的受限目录，目录失败禁用保存，FILE 和 RELATION 不提供伪造入口；已有回款历史的最终限制仍由服务端裁决。

`/worklist` 是工具菜单中的内部“我的待办”入口，不新增服务端 navigation 节点，仅 `worklist:read` 成员可见。`date` 是唯一可恢复的 search 参数；服务端 cursor 包含来源推进位置，只在当前身份的查询缓存内用于“加载更多”。单项确认提交同一服务端项的 kind、sourceId、sourceVersion、dueTime 与日期；整类确认必须经二次确认，仅提交类别和日期，服务端重新校验全部当前可见项。两个操作都不修改来源业务记录，成功后只刷新同身份、同日工作台。

Work 任务使用内部路由 `/work/tasks` 与 `/work/tasks/:taskId`，不新增服务端菜单项，均要求 `work-tasks:read`。列表只把 URL 页码和每页数量传给 `WorkTaskQueryRequest`；任务 ID、分页参数和本地身份均不能代表参与者可见性，服务端仍复核当前成员范围。拥有 `work-tasks:write` 与 `organization:read` 时，列表可进入内部路由 `/work/tasks/new`；该页也要求 `work-tasks:read`，处理人和最多 50 位唯一关注人仅从服务端在职成员目录选择，创建请求可含标题、处理人 ID、关注人 ID、用户明确填写的非空描述、受限优先级、可选到期时间与一对明确填写的受支持业务类型/正记录 ID；类型与 ID 必须同时提供，未选择优先级时由服务端默认，提醒与周期规则不会混入普通创建请求。拥有 `work-tasks:write` 与 `work-tasks:manage` 时，开放任务详情可进入内部路由 `/work/tasks/:taskId/edit`；编辑页独立读取并缓存标题、描述、优先级、到期时间、开放状态和 version，完整 PUT 只回写这些字段和 version，服务端重新确认管理权限、开放状态与并发。详情的“重新分配处理人”还要求 `organization:read`，只从服务端在职成员目录选择候选并提交候选 ID 和当前窄投影 version；“管理关注人”使用独立的完整替换基线，只保留关注人 actor ID、开放状态和 version，候选同样来自成员目录，提交完整去重列表（至多 50 项）和基线 version。对窄投影明确为开放且有到期时间的任务，“管理任务提醒”独立读取 task ID、version 与固定提醒步骤基线，提交完整步骤和该基线 version；不读取通知状态、创建人、处理人或关注人名单。周期规则则只在独立的 `/work/task-series` 系列入口创建和管理，不从普通任务草稿或详情推导。当前处理人、创建人和本地身份均不会用于浏览器资格推导。服务端也允许创建人操作，但当前没有可供前端使用的 caller capability，故浏览器不根据创建人 ID 和本地身份推断并开放入口。列表标题可进入详情；详情只在返回任务 ID 与路径精确匹配时展示同一窄投影。详情在 `work-tasks:write` 下仅对服务端回显 `TODO` 或 `IN_PROGRESS` 的任务开放开始、退回待办和完成；每个动作只携带当前 version，服务端再复核处理人、状态和并发。详情还读取服务端评论分页的前 20 条，且在 `work-tasks:write` 下可发表纯文本评论；评论作者不进入前端投影，因而删除评论保持关闭。

2026-08-11：上段的任务关联限制现已收敛。`/work/tasks/new` 可在类型与正记录 ID 同时由用户明确填写时，随创建请求发送一条受支持 CRM 关联；它不是本地目录、可见性或数据范围的来源。开放任务详情在 `work-tasks:write` 下展示服务端当前回显的关联类型/ID，并可用同一对值与当前 version 关联或替换；对已回显关联保留二次确认的清除操作。每次写入仍由服务端复核任务参与者可见性、成员在职、目标当前写权限、租户、开放状态和并发，未知类型、缺失值或非法 ID 均不提交。

列表可进入内部路由 `/work/task-series`，同样不新增服务端菜单项且要求 `work-tasks:read`。它只提交 URL 页码与每页数量，显示服务端确认可见的标题、日历规则和状态；成员、描述、自动化游标、实例计数、blocker 和时间戳一律丢弃。任一可读成员可从列表打开“查看实例”：弹层独立读取同一服务端可见系列的分页发生事实，只保留发生序号、实际到期时间和已生成/已跳过状态，不能使用生成任务 ID、成员、时区、批次、跳过原因或记录时间。额外具备 `work-tasks:write` 与 `organization:read` 时可进入 `/work/task-series/new`：处理人和最多 50 位唯一关注人只能从服务端在职成员目录选择，创建草稿可提交标题、处理人 ID、关注人 ID、明确填写的非空描述、受限优先级和完整日历规则；未选择优先级时由服务端默认，自动化状态、实例和未来提醒模板不会提交或缓存。当某列表项的服务端 `allowedActions` 包含 `UPDATE` 时，内部路由 `/work/task-series/:seriesId/edit` 可独立读取同 ID 完整编辑基线，回写标题、描述、优先级、处理人、关注人、规则和该基线 version；成员目录只能作为候选，不是资源动作授权。`UPDATE` 也允许管理未来提醒，提醒模板仍读取并提交自己的 version。`ACTIVATE`、`PAUSE`、`STOP` 分别只在对应 capability 出现时显示，均只提交当前 version；浏览器不从管理权限、创建人、状态、调度开关或 blocker 推断动作，服务端复核调度器、参与人、状态与并发。

同一开放任务详情可在 `work-tasks:write` 下显示服务端明确回显的关联，并打开“关联/变更业务关联”弹窗。成员必须明确输入受支持业务类型及正记录 ID；它们仅是待服务端核验的写入输入，不能作为可见性、字段权限或数据范围的浏览器依据。清除仍需要二次确认且只携带当前 version、显式省略类型与 ID；建立、替换和清除都会由服务端复核调用者、目标记录写入范围、任务开放状态和并发。

详情的“取消任务”还要求 `work-tasks:manage`，仅对开放任务显示，二次确认后只发送当前 version；服务端重新确认管理资格、开放状态和并发。服务端也授权创建人取消，但当前没有 caller capability，浏览器不根据创建人 ID 和本地身份推断入口。该动作不读取、修改或关闭独立提醒计划与周期任务系列。

详情的“删除任务”同样要求 `work-tasks:manage`，仅在窄投影状态为 `TODO` 时显示并需明确确认；只提交 version。服务端仍会复核从未开始、无评论、无附件历史和并发，成功后返回 `/work/tasks`。创建人资格不由浏览器推导；删除操作不借由普通任务详情读取或改变独立提醒与周期任务系列。

客户详情内的标签管理不新增侧栏入口，操作额外需要 `customers:write`；打开编辑器时必须由服务端标签目录确认当前成员对 `TAGS` 字段具有未遮罩读取权限，最终字段写入和 version 仍由服务端复核。

客户、线索、联系人、商机和产品列表内的“保存视图”不是独立菜单或路由。`saved-views:read` 才会按当前身份查询和显示当前成员相应 `CUSTOMER|LEAD|CONTACT|OPPORTUNITY|PRODUCT` 视图；URL 未含 `savedView` 时仅可应用服务端回显的默认视图，`savedView=all` 明确表示不使用任何视图，正 ID 只选择同一列表响应中存在的视图。创建、编辑、删除和设默认额外需要 `saved-views:write`，所有写入使用响应中的 version；筛选字段、操作符及各操作符的值数量都只来自字段目录的服务端 `filterOperators`，不能从前端字段类型或历史视图推断。查询仅携带已解析且服务端返回的 savedViewId；客户、线索、联系人 CSV 导出沿用同一 ID，路径或缓存中的未知 ID 不会发送。

客户、线索、联系人、商机与产品列表的动态字段显示不新增路由或菜单。只有 `fields:read` 下，页面才会读取当前对象的服务端字段目录，并把 ACTIVE、非内置、非 FILE 自定义标量字段作为当前成员字段设置的候选；值只可来自同一列表响应已按字段策略过滤/脱敏的 `customFields`，标题、code、选项标签和布局都来自服务端。字段设置不发送字段值、不改变 URL，也不能使浏览器推导字段读取资格、动态排序或额外查询范围。

客户列表排序不会新增导航路由或菜单：`/crm/customers?sort=…` 只接受页面固定目录中映射为服务端 `sortField/sortDirection` 的选项，切换后回到第一页并发起新的服务端分页查询。未知 URL 值回退为默认更新时间倒序；Drawer 关闭仅移除 `customerId`，保留此排序上下文，前端绝不对已加载结果二次排序。

产品列表排序不会新增导航路由或菜单：`/crm/products?sort=…` 只接受页面固定目录中映射为服务端 `sortField/sortDirection` 的选项，切换后回到第一页并发起新的服务端分页查询。未知 URL 值回退为默认更新时间倒序；场景与保存视图继续保留，前端绝不对已加载结果二次排序。

合同列表排序不会新增导航路由或菜单：`/crm/contracts?sort=…` 只接受页面固定目录中映射为服务端 `sortField/sortDirection` 的选项，切换后回到第一页并发起新的服务端分页查询。未知 URL 值回退为默认更新时间倒序；本人场景与状态继续保留，前端绝不对已加载结果二次排序。

回款列表排序同样不会新增导航路由或菜单：`/crm/receivables?sort=…` 接受页面固定目录，或当前服务端 RECEIVABLE 字段目录确认的 `custom:<fieldCode>:asc|desc`；前者映射为 `sortField/sortDirection`，后者映射为 `customSortFieldCode/sortDirection`。切换后回到第一页并发起新的服务端分页查询。未知、停用、不可排序或无字段目录的 URL 值回退为默认到账日倒序；本人场景继续保留，前端绝不对已加载结果二次排序。

回访全局列表以相同规则从 RETURN_VISIT 字段目录生成动态列和自定义排序选项。回款与回访的字段目录仅在 `fields:read` 下读取；动态列值只使用对应列表响应中服务端已按字段策略过滤的 `customFields`，不能由布局、URL 或缓存补全。

线索列表排序同样不会新增导航路由或菜单：`/crm/leads?sort=…` 只接受页面固定目录中映射为服务端 `sortField/sortDirection` 的选项，切换后回到第一页并发起新的服务端分页查询。未知 URL 值回退为默认更新时间倒序，前端绝不对已加载结果二次排序。名称、桌面“查看”和移动摘要标题可写入同页的正安全整数 `leadId`，以 Drawer 打开已有详情 Surface；关闭只移除 `leadId`，保留其余列表查询参数，直接的 `/crm/leads/:leadId` 深链接不变。

联系人列表排序同样不会新增导航路由或菜单：`/crm/contacts?sort=…` 只接受页面固定目录中映射为服务端 `sortField/sortDirection` 的选项，切换后回到第一页并发起新的服务端分页查询。未知 URL 值回退为默认更新时间倒序，前端绝不对已加载结果二次排序。名称、桌面“查看”和移动摘要标题可写入同页的正安全整数 `contactId`，以 Drawer 打开已有详情 Surface；关闭只移除 `contactId`，保留其余列表查询参数，直接的 `/crm/contacts/:contactId` 深链接不变。

商机列表排序同样不会新增导航路由或菜单：`/crm/opportunities?sort=…` 只接受页面固定目录中映射为服务端 `sortField/sortDirection` 的选项，切换后回到第一页并发起新的服务端分页查询。未知 URL 值回退为默认更新时间倒序，前端绝不对已加载结果二次排序。

## 后端菜单缺口

跨客户 `/crm/receivables`、`/crm/invoices` 和 `/crm/return-visits` 的列表编号和移动摘要均不新增路由或菜单，而是以 `receivableId`、`invoiceId` 或 `returnVisitId` URL 参数打开同一详情 Surface 的 Drawer；三者分别仍要求对应 `*:read`，并只把正安全对象 ID 交给服务端详情端点，客户 ID、字段可见性与数据范围完全由该响应裁决。关闭、详情返回和回款/发票删除只删除对象参数，其他列表 query 不变。回访 Drawer 的编辑入口仍落在受 `return-visits:read + return-visits:write` 保护的客户上下文编辑路由；其 `returnTo` 只接受无 hash 的列表 query，保存或取消后恢复 `/crm/return-visits` 与同一 `returnVisitId`。本条取代前文中三类全局列表必须由列表回显客户 ID 才能进入详情的历史描述；直接客户上下文详情仍执行响应 customer ID 与路径的精确匹配。

合同全局列表还在 `contracts:read + opportunities:read` 下显示“筛选商机”：候选只来自同一身份的受限商机目录并只显示名称，选择或 URL 恢复后须由同一商机详情确认精确 `opportunityId` 才进入合同查询。无权、格式异常、不可见或详情不匹配时不发送该条件；它可与客户筛选并存，确认尚未完成时不请求未收窄结果。

下文“菜单缺口”中关于 OA、营销与报表未发布的旧表述已经失效：后端现在发布 `marketing.forms`、`oa.forms`、`oa.requests`、`oa.announcements` 和 `reports` 叶子；Web 已注册对应的受保护路由（营销表单为 `/marketing/forms`、公告为 `/oa/announcements`）。它们仅在服务端导航响应和对应的 read authority 同时存在时才可加载；菜单或前端守卫绝不替代服务端对记录、动作和数据范围的裁决。

在菜单目录扩充前，前端不添加这些模块的正式侧栏入口：合同、开票资料、发票、回款、回款计划、跟进活动、回访、销售管线、任务、通知、审批定义/实例、OA、报表、保存视图、工作清单、连接器、企业数据和线索接入客户端。`notifications:read` 成员可从应用头部的“通知设置”打开当前成员偏好弹层；这不是导航树菜单项，弹层只读取和替换两个服务端偏好布尔值，且其入口、查询和保存均由该 authority 保护。头部的“通知中心”额外要求 `notifications:read + work-tasks:read`，按需查看当前成员的通知事实并将可见未读项标为已读；它不新增服务端菜单项或任务详情跳转。头部“审批待办”只向 `approvals:read` 成员开放：图标角标只读取当前成员服务端确认的非负待办数量，不轮询，读取失败或零项不显示；弹层仍只按需读取当前成员的 `PENDING` 列表。列表只为每项均具服务端对应 capability 的选择集合开放批量通过/驳回，结果必须完整且原子。选中项在同一弹层流内显示状态、步骤时间线，以及详情服务端 `allowedActions` 中的单项审批动作。转审候选只从当前审批实例的专用接口读取，任何动作均提交该详情的 version，不能根据本地身份、申请人或任务归属推导资格。`approvals:manage` 成员还可打开只读“审批定义”目录，仅按需读取服务端授权的定义 ID、名称、对象类型与状态；额外具有 `organization:read` 才能从服务端成员目录创建初始停用的单成员步骤草稿，或编辑严格匹配该最小模板且保持停用的定义。管理员可从同一目录对任一项目取得窄状态/version 基线，并在明确确认后启用、停用或删除。两者均不是服务端菜单项；复杂定义编辑保持关闭。客户详情已有“发起审批”局部动作，它不以本地 `approvals:*` authority 判断资格，只在用户触发后请求当前客户专用的定义、候选和预览，最终由服务端裁决。后端现已为 `workflows:read` 下发 `workflow.definitions` → `/workflows` 菜单及具名工作流契约；Web 现通过受保护的 `/workflows` 路由呈现只读定义目录，并只消费其中安全的流程 ID、名称、业务对象和 version。`workflows:manage` 成员可在同一路径打开新建与详情配置管理，但仅当服务端目录和资源基线完整时发送写入：完整替换只能消费 `UPDATE + editable + version`，状态只消费 `CHANGE_STATUS + allowedStatuses + version`。运行页面只能消费服务端 `allowedActions`、可渲染 `writableFields`、任务码、审批门选择项、候选人分页、结构化地址分量、record-scoped FILE 草稿/上传状态和 version，不能以本地身份推断运行时权限。审批发起及阶段推进的候选人必须请求对应的受业务对象/定义/选择项或运行记录/阶段限制的接口，不能回退到全局成员目录；适用性页也只按服务端的 `canStart` 与 `blockerCode` 决定可启动状态。

`/crm/leads/intake-clients` 是 `leads:intake-manage` 保护的内部管理路由，不属于服务端导航树。已能读取线索列表的成员只会在该 authority 同时存在时看到线索页中的“接入客户端”局部入口；直接输入路径同样经过路由守卫，后端仍最终裁决管理权限。它不会为缺少 `leads:read` 的成员伪造侧栏或本地导航入口。

阶段工作流目录项可继续进入受同一 `workflows:read` 守卫的 `/workflows/:workflowId`。详情仅保留完整定义中可渲染的名称、业务对象、结果名称与阶段投影；路径 ID 不能证明可见性，资源级 capability、适用范围与状态仍不被浏览器用于推导任何写操作。

客户详情的“启动阶段工作流”不是侧栏入口。它按用户动作读取当前客户绑定的适用流程，唯一的前端启动条件是服务端 `canStart`；启动回显的运行记录 ID 进入 `/workflow-records/:workflowRecordId`，路径仍须由服务端记录可见性和 `workflows:read` 守卫共同裁决。

已注册的实现路由仍必须同时检查对应 authority；菜单隐藏或前端守卫都不能代替后端的资源级和字段级授权。公开营销表单使用独立路由与 Provider，不请求 navigation 或 authorization。

> 更正：上文“附近线索”入口应从线索列表进入，而非客户列表；对应路由为 `/crm/leads/nearby`。

## P1 前端行为

应用壳在桌面使用 56px 顶部模块导航（具名 `nav` 地标），CRM 上下文路由额外提供 240px 侧栏；小于 767px 改为带关闭按钮和安全区的移动抽屉。任何形态都不引入本地菜单来源，桌面导航与移动抽屉始终共同消费 `/api/v1/navigation`。应用头部只保留产品名与当前成员，将连接器、企业数据、菜单和通知偏好收拢到逐项 authority 守卫的“应用设置”菜单；审批和通知中心为带可访问名称、文字提示和键盘焦点的图标操作。每个页面仅在内容区提供一个一级标题和 `main` 地标；键盘可使用“跳到主要内容”直接越过导航，链接落点可接收焦点而不新增嵌套地标。

P3 产品完整编辑已注册为不新增菜单项的内部路由 `/crm/products/:productId/edit`。进入路由需 `products:write`，表单还必须由服务端安全基线确认产品读取、全部替换字段未遮罩且可写；普通详情、列表和分类树均不能作为替换基线。

P3 商机基础编辑已注册为不新增菜单项的内部路由 `/crm/opportunities/:opportunityId/edit`。进入路由需 `opportunities:write`；表单仅在同一身份的服务端安全编辑基线确认全部完整替换字段未遮罩、可读且可写时显示，普通详情、列表和客户/管线目录均不能作为替换基线。更换客户额外只使用 `customers:read` 的当前可见候选；更换管线/阶段额外只使用 `opportunity-pipelines:read` 下同一活动管线的成对候选，目录无法确认时仍可保留原基线但不允许伪造变更。

应用启动后只以 `/api/v1/navigation` 的返回结果生成桌面侧栏和移动端抽屉；不会因前端已有路由而新增正式菜单入口。上方菜单表列出的每个叶子都有受保护的实现路由。通用阶段占位页仅用于未来后端新增、而前端尚未注册的两段式菜单路由；它继续检查服务端给出的 `requiredAuthority`，不能被用作当前已发布菜单的正常落点。

## 回访创建关系选择补充

客户上下文回访创建还会在 `fields:read` 下读取当前身份的 RETURN_VISIT 字段目录。ACTIVE 非内置标量字段在同一创建路由内提交；USER/DEPARTMENT 仅通过 `organization:read` 的受限目录选择，FILE 仅在 `files:write` 下从同一 RETURN_VISIT 草稿的 `UPLOADED` 文件绑定。必填目录、候选、文件或 RELATION 不能安全完成时关闭创建，浏览器不手输成员、部门或文件 ID。

客户上下文 `/crm/customers/:customerId/return-visits/new` 在 `return-visits:write` 下保持可用；可选联系人选择额外要求 `contacts:read + customers:read`，可选合同选择额外要求 `contracts:read + customers:read`。两个目录只查询当前路径客户，运行时仅保留回显的同一客户正 ID 和非空名称；用户选择后才把 ID 放入这次创建请求，清除即省略。目录查询、取消与保存均不新增服务端菜单项或 URL 参数，浏览器不持久化关系或推断负责人、字段访问和数据范围。

## 回款计划单条创建补充

客户上下文的 `/crm/customers/:customerId/receivable-plans/new` 在既有 `receivable-plans:write`、`contracts:read` 与 `customers:read` 守卫下，对齐参考表单增加必填的非负整数提前提醒天数和可选备注。合同仍只来自同一客户的服务端可见目录；空白备注在请求中省略，提醒和备注只随当前表单认证请求传递，不进入 URL、缓存或持久化存储。批量创建的每条计划同样可填写非负整数提醒、可选备注和 `fields:read` 下 ACTIVE 非内置 RECEIVABLE_PLAN 标量字段；USER/DEPARTMENT 只从 `organization:read` 的受限目录选择。生成的批量契约不接收文件草稿，因此必填 FILE 或 RELATION 会关闭批量提交并提示改用单条创建；负责人仍没有入口。服务端继续复核字段写入权限、合同/客户可见性、剩余可计划金额与默认负责人范围。

## 合同与发票动态字段排序

合同和发票全局列表只会在同时具备对象读取权限和 `fields:read` 时读取当前对象的字段目录。目录确认 ACTIVE、非内置且为标量的自定义字段才会出现在桌面列与 `custom:<fieldCode>:asc|desc` 排序选项中；URL 恢复的未知、停用或不可读 code 安全回退默认排序。列表详情、全局新建和 Drawer 路由不以字段目录或当前页值推断客户、负责人、字段权限或数据范围。

## 批量跟进

批量跟进不新增导航树节点、路由或 URL 参数。它是线索、联系人、客户和商机既有列表中的局部操作：同时具备对应列表读取与 `activities:read + activities:write` 时，当前页可选择记录并打开受控弹窗。分页、搜索、场景、排序、保存视图和临时筛选任一变化都会清空选择；移动摘要不提供模拟的跨卡片批量选择。提交只经 `POST /api/v1/activities/batch`，每条请求的对象类型固定为入口列表，服务端继续独立裁决记录范围与写入资格。

## 线索与联系人列表批量操作

线索和联系人批量转移/删除均为现有列表局部操作，不新增导航、路由或 URL 参数。当前页勾选仅在至少拥有相应批量 action 时显示；`leads:assign + organization:read` 或 `contacts:assign + organization:read` 才显示“转移”，成员候选仅来自服务端在职目录；`*:delete` 才显示带原子性说明的删除确认。请求只携带当前行回显的 ID 和 version，查询、分页、筛选、场景、排序、保存视图、临时筛选或身份变化都会清空选择；成功只失效同一身份对象列表，保持导航 URL 与详情 Drawer 上下文。

商机列表以同样方式提供当前页“转移/删除”：`opportunities:assign + organization:read` 才能打开成员目录，`opportunities:delete` 才能确认删除。没有新增菜单或 URL 状态；请求只使用同一行的服务端 `opportunityId + version`，任何列表语义变动都取消当前选择。

## 线索、联系人与产品 CSV 导入

CSV 导入不新增导航、路由或 URL 参数。它是线索、联系人与产品既有列表中的局部入口，分别同时要求 `leads:write + files:write`、`contacts:write + files:write` 或 `products:write + files:write`；缺少任一 authority 时不渲染入口。弹窗由当前列表上下文打开和关闭，源文件、私有草稿 ID、校验结果与安全检查轮询都只留在瞬态页面状态，完成或取消后回到相同的列表筛选、场景、排序、保存视图与分页。线索和联系人仅在全部有效时原子确认；产品则由服务端以产品编码作去重键，跳过已有记录和同一文件重复编码而不覆盖任何已有记录。弹窗中的“查看导入记录”也不创建路由：它只读取当前成员、当前对象近七天的完成摘要，关闭后保留导入草稿和列表上下文。成功只失效当前身份对应对象的列表查询，不从导入结果构造详情路由或菜单。

产品 CSV 导出同样不新增导航、路由或 URL 参数。它是 `/crm/products` 的局部确认操作，只有 `products:export` 才显示；关闭、失败或完成都保留原有关键词、分类、场景、排序、保存视图、临时条件和分页上下文。浏览器不把导出结果、文件名或任何 CSV 单元格写入路由、缓存或持久化存储。

## 合同全局列表批量操作

合同全局列表不新增路由或菜单，但在当前桌面分页内提供服务端授权的行选择。`contracts:assign + organization:read` 显示“转移”并打开受限成员选择器，也显示“添加团队成员”“移除团队成员”；`contracts:delete` 显示带原子性说明的“删除”确认。团队成员只从同一身份的服务端在职目录选择，添加时可多选成员、明确选择只读/读写和“不限/截止到”，截至日只作为请求 body 的 nullable `effectiveUntil`，不进入导航 URL；移除需确认。任何查询语义或身份变化都会废弃既有勾选。每项提交均使用当前行回显的 `contractId + version`，成功后只失效当前身份的合同列表，导航 URL、详情 Drawer 和其他筛选上下文保持不变。
2026-08-12 更新：`/crm/receivable-plans`、`/crm/receivable-plans/new` 与 `/crm/receivable-plans/batch-new` 是现有回款页面内的二级工作流，而不是一条未由服务器下发的侧栏菜单。入口只有 `receivable-plans:read` 时从回款页出现；新建与批量新建还须当前身份具备 `receivable-plans:write + contracts:read + customers:read`。列表 URL 的 `scene=subordinates` 只映射为生成契约的 `subordinateOwnerOnly=true`，同 `scene=mine` 只能二选一；浏览器不持有或编码任何下属成员/部门清单。它们通过固定 customer-context 路径携带仅包含列表查询的 `returnTo`，客户上下文详情和表单返回时只接受该受限值恢复全局列表，拒绝路径或片段注入。
