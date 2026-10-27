# atom-crm-web 实施计划

> - 状态：Review Draft v0.2（已合入首轮评审修正：后端事实核查、409/金额契约、认证下载通道、E2E 环境）
> - 创建日期：2026-07-25
> - 目标工程：[atom-crm-web](https://github.com/Archetom/atom-crm-web)
> - 后端工程：[atom-crm](https://github.com/Archetom/atom-crm)
> - 参考范围：既有移动端 CRM 的业务交互，仅参考行为，不复用旧实现或框架。

本文保留初始实施阶段的计划与事实快照；当前功能、认证、版本和运行方式以 [README](README.md) 与 [部署说明](docs/deployment.md) 为准。

## 1. 文档目的

本文档用于指导 `atom-crm-web` 从零建设，并供架构师或其他 AI 审查以下内容：

1. 技术栈是否适合独立部署的 React CRM Web 应用。
2. 是否正确覆盖 `atom-crm` 已有接口与安全边界。
3. 是否合理借鉴既有移动端 CRM 的业务交互，而没有继承其旧技术债。
4. 模块顺序是否能尽早形成可运行、可联调的业务闭环。
5. 是否遗漏认证、权限、动态字段、附件、乐观锁、响应式和测试等关键基础能力。

本计划通过评审后再开始生成代码。当前阶段不要求一次性冻结所有视觉细节，但核心架构、安全边界和接口使用原则应在 P0/P1 阶段确定。

## 2. 已确认事实

### 2.1 atom-crm 后端

当前后端是 Java 25、Spring Boot 4.1 的多模块项目，已提供 Springdoc OpenAPI。

初步静态盘点结果：

- 约 53 个 REST Controller。
- 约 387 个 HTTP Mapping。
- 约 235 个 Request DTO。
- 约 135 个 Response DTO。
- API 基础路径为 `/api/v1`。
- 开发环境 API 文档为 `/swagger-ui/index.html`。
- 机器可读契约为 `/v3/api-docs`。
- 普通成功响应直接返回业务数据，不再包裹统一 `data` 字段。
- 失败响应主要为 `{ "errCode": "...", "errMsg": "..." }`；`errMsg` 为英文技术文案，不能直接面向 zh-CN 用户展示。
- `VERSION_CONFLICT`、`CONCURRENT_OPERATION`、`RESOURCE_ALREADY_EXISTS` 三个错误码都映射到 HTTP 409，前端必须按 `errCode` 区分乐观锁冲突与重复资源，不能按状态码一刀切。
- 普通分页输入使用从 1 开始的 `page` 和 `size`，`size` 最大 200。
- 普通分页输出使用后端公共 `Pager` 结构（外部库 atom-common），字段包括 `pageNum`、`pageSize`、`totalNum`、`objectList` 与扩展字段 `meta`；`totalNum` 为 -1 时表示“无总数”，列表组件必须处理。
- cursor 分页目前仅 `GET /api/v1/worklist`（返回 `items` + `nextCursor`），其余为页码分页，两者不能混用或互转。
- 金额等 BigDecimal 字段当前以 JSON number 序列化，后端无转字符串配置。
- 后端没有 SSE/WebSocket 推送通道，通知与待办角标只能轮询。
- 客户与线索均提供 `nearby` 接口（经纬度 + 半径的分页查询）；省市区数据由后端 RegionReference 接口提供。

后端已实现的主要领域：

- 仪表盘、工作台、通知。
- 客户、客户公海。
- 联系人、联系人公海。
- 线索、线索转换、公开线索接入客户端。
- 商机、销售管线、销售阶段、商机产品。
- 产品、产品分类。
- 合同、合同产品。
- 开票资料、开票申请。
- 回款、回款计划。
- 跟进活动、回访。
- 审批定义、审批实例、阶段工作流。
- Work 任务、评论、关注人、周期任务、提醒。
- OA 表单、OA 申请、OA 公告。
- 营销表单、公开营销表单。
- 附件、动态 FILE 字段和文件草稿。
- 固定看板、自定义报表。
- 组织、成员、部门、角色、授权。
- 动态字段、字段布局、保存视图、嵌入页面。
- 企业数据、连接器及连接器入口。

必须尊重的后端边界：

- 开发和测试环境可显式启用 `X-Dev-User-Id`、`X-Dev-Tenant-Id`。
- 生产环境不能启用或模拟这两个受信 Header。
- 当前后端没有面向人员的正式登录接口，生产认证需要外部身份适配器、SSO 或同源网关。
- `/api/v1/navigation` 返回当前成员可见菜单，不能由前端自行扩大。
- `/api/v1/authorization/me` 返回 authority 和 data scope。
- 字段可见性、字段读写、字段遮罩独立于业务 authority。
- tenant、actor、authority、role 和 data scope 不能从普通请求输入中推导。
- 多数更新接口使用 `version` 进行乐观锁控制。
- `409 Conflict` 不能被前端自动覆盖或无提示重试。
- 后端字段遮罩结果不得被前端缓存或拼接成更完整的敏感值。
- 文件上传包含上传意图、内容上传、草稿、候选绑定等多阶段流程，不能当作普通 URL 字段处理。

当前已知后端缺口：

- 生产人员认证方案尚未确定。
- `NavigationCatalog` 当前仅 15 个可跳转叶子（workspace 1、CRM 7、marketing 1、organization 2、administration 4）。缺失的不止合同、回款、审批、OA、任务、报表，还包括发票、跟进活动、回访、通知、保存视图、工作清单、阶段工作流、销售管线、连接器和企业数据；P3 后半段到 P7 的大多数页面当前没有导航入口。
- OpenAPI 通过运行中的后端提供，仓库内无契约快照，也无构建期导出插件（如 springdoc-openapi-maven-plugin）；CI 漂移检查只能覆盖“生成类型 vs 已提交快照”，无法发现“快照 vs 后端真实契约”的漂移，需配套快照刷新流程。
- 附件下载/预览的认证通道未定：请求头注入的认证无法覆盖 `<a>` 下载、`<img>` 预览、媒体 Range 播放和 iframe，需要同源 Cookie session 或短时效签名 URL，随生产认证一起决策。
- 金额 BigDecimal 序列化为字符串还是保持 number，需在 P0 类型生成前与后端定案。
- 未发现通用 CORS 配置，开发期应使用代理，生产期优先同源部署。

### 2.2 移动端 CRM 交互参考

交互参考来自既有移动端 CRM 的页面流程和信息组织。参考范围仅用于描述用户行为，不要求取得旧工程；本项目独立实现界面、状态管理与 API 调用。

可参考的产品能力：

- 移动端首页和快捷入口。
- CRM 卡片列表、搜索、筛选、下拉刷新。
- 客户、联系人、线索、商机、合同、回款、产品、发票的列表/详情/新建流程。
- 公海领取、分配和详情。
- 商机阶段进度。
- 跟进记录、关联业务和附件。
- 通用动态表单。
- 人员、部门、客户、联系人、产品等选择器。
- 审批状态、审批时间线和待办。
- 任务、消息、公告和通讯录。
- 手机端详情页底部动作栏。

明确不迁移的内容：

- Vue 2、uni-app、Vuex、Vue CLI、Webpack 4。
- 旧项目的全局表单桥接、选择值桥接与临时跨页状态。
- 旧项目 Token Header、租户切换和旧 API 路径。
- 旧接口的动态字段数据格式。
- 页面内部零散的权限判断。
- 未确认授权的品牌、Logo 或第三方资源。

参考原则是“复用业务认知和交互模式，重新实现代码和数据模型”。

## 3. 项目目标

### 3.1 产品目标

建设一个独立、现代、可维护的 React CRM Web 应用：

- 桌面端优先，完整支持 375px 及以上响应式布局。
- 覆盖后端所有适合人机交互的业务接口。
- 菜单、路由、按钮、字段和数据展示遵循服务端权限。
- 支持动态字段、动态布局和保存视图。
- 核心业务同时提供高效桌面交互和可用的移动交互。
- 每个里程碑结束时均可启动、构建、测试和联调。
- 最终能够独立部署，也能够通过反向代理与 `atom-crm` 同源部署。

### 3.2 工程目标

- TypeScript strict，全量业务代码具备可靠类型。
- OpenAPI 驱动接口类型，减少手写 DTO 漂移。
- 业务以 feature 为边界组织，避免按纯技术层堆叠。
- 服务端状态、本地 UI 状态、URL 状态职责清晰。
- 动态字段、权限、选择器、附件、错误处理形成可复用基础层。
- 单元测试、组件测试、接口模拟和端到端测试分层建设。
- CI 检查格式、类型、测试、构建和 OpenAPI 契约漂移。

### 3.3 非目标

首期不包含：

- 修改 `atom-crm` 的核心领域规则来迎合页面。
- 复刻旧 H5 的全部视觉细节。
- 原生 App、微信小程序或 uni-app 多端构建。
- 离线优先、本地数据库或复杂数据同步。
- 在浏览器中复制服务端 data scope 计算。
- 自行实现生产密码登录系统。
- 为 API-only 的 connector ingress 建造无业务价值的页面。

## 4. 总体技术方案

### 4.1 技术栈

| 领域       | 选型                            | 说明                                                                                  |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------------- |
| Runtime    | Node.js 22.22+（建议 24 LTS）   | React Router v8 要求 Node ≥ 22.22                                                     |
| 包管理     | pnpm                            | 锁文件稳定、安装效率高                                                                |
| UI 核心    | React 19 + TypeScript strict    | 使用稳定版本并锁定精确依赖                                                            |
| 应用框架   | React Router v8 Framework Mode  | SPA 模式、类型化路由和路由级拆包；v8 为 ESM-only，需 Vite 7+ 与 React ≥ 19.2.7        |
| 构建       | React Router 的 Vite 集成       | 不引入额外 Node SSR 服务                                                              |
| UI 组件    | Ant Design 6（6.5.x 稳定版）    | 适合企业中后台和复杂表单                                                              |
| 样式       | Ant Design Tokens + CSS Modules | 统一主题，局部样式隔离                                                                |
| 服务端状态 | TanStack Query                  | 缓存、失效、分页、请求状态                                                            |
| 表单       | React Hook Form + Zod           | 静态表单校验和动态字段适配                                                            |
| API 类型   | openapi-typescript              | 从 OpenAPI 生成路径和 Schema 类型                                                     |
| API 调用   | openapi-fetch                   | 轻量、类型安全、易加中间件                                                            |
| 图表       | Apache ECharts                  | 仪表盘、趋势、排行                                                                    |
| 日期       | Day.js                          | 统一日期、时区和格式                                                                  |
| 本地状态   | Zustand（按需引入）             | 仅用于跨组件短生命周期 UI 状态；首期以 URL + Query + 表单状态为主，出现真实需求再引入 |
| 单元测试   | Vitest                          | 与 Vite 生态一致                                                                      |
| 组件测试   | Testing Library                 | 从用户行为验证组件                                                                    |
| API Mock   | MSW                             | 开发与测试共用 Mock                                                                   |
| E2E        | Playwright                      | 核心业务闭环和响应式验证                                                              |
| 代码质量   | ESLint + Prettier               | CI 强制执行；Stylelint 在 antd tokens + CSS Modules 下价值有限，暂不引入              |

不使用 Redux 保存服务端业务数据；TanStack Query 是服务端状态的唯一缓存层。Zustand 不保存权限、业务实体或可由接口恢复的数据。

### 4.2 工程目录

```text
atom-crm-web/
├── app/
│   ├── root.tsx
│   ├── routes.ts
│   └── routes/
├── src/
│   ├── api/
│   │   ├── generated/
│   │   ├── client/
│   │   ├── errors/
│   │   └── query-keys/
│   ├── app/
│   │   ├── auth/
│   │   ├── layout/
│   │   ├── navigation/
│   │   ├── permissions/
│   │   └── providers/
│   ├── components/
│   │   ├── data-view/
│   │   ├── dynamic-field/
│   │   ├── entity-selector/
│   │   ├── file-transfer/
│   │   └── feedback/
│   ├── features/
│   │   ├── dashboard/
│   │   ├── customers/
│   │   ├── contacts/
│   │   ├── leads/
│   │   ├── opportunities/
│   │   └── ...
│   ├── shared/
│   │   ├── constants/
│   │   ├── hooks/
│   │   ├── i18n/
│   │   ├── types/
│   │   └── utils/
│   ├── styles/
│   └── test/
├── openapi/
│   └── atom-crm.json
├── docs/
│   ├── architecture.md
│   ├── api-coverage.md
│   ├── ui-reference.md
│   ├── security.md
│   └── deployment.md
├── public/
├── AGENTS.md
├── README.md
├── package.json
└── pnpm-lock.yaml
```

单个 feature 推荐结构：

```text
features/customers/
├── api/
├── components/
├── hooks/
├── model/
├── pages/
├── routes.ts
└── tests/
```

feature 之间不直接导入内部实现。跨领域能力通过公开出口或 `components/shared` 使用。

## 5. 应用架构

### 5.1 路由与菜单

路由注册表包含所有已实现页面，服务端菜单只负责决定当前用户看到哪些入口。

规则：

- 路由定义按 feature 懒加载。
- `/` 为工作空间首页。
- 业务路由使用稳定英文复数，例如 `/crm/customers/:customerId`。
- 页面刷新后可根据 URL 独立恢复，不依赖上一页内存状态。
- 搜索、筛选、分页、排序和选中视图尽量进入 URL Search Params。
- 服务端未返回的菜单项不出现在侧边栏。
- 即使知道 URL，路由守卫仍检查 authority。
- 最终操作仍以服务端响应为准，前端守卫不被视为安全边界。
- 详情子资源使用嵌套路由或稳定 Tab Query，保证可深链。
- `/public/marketing-forms/:publicKey` 使用独立公开布局，不加载内部权限和菜单。

后端菜单目录扩充前，前端不得私自把所有模块加入正式菜单。P0 需要生成“页面路由—后端菜单 code—authority”映射，并提交后端缺口清单。

### 5.2 认证

定义统一接口：

```ts
interface AuthAdapter {
  bootstrap(): Promise<AuthState>;
  apply(request: RequestInit): Promise<RequestInit>;
  handleUnauthorized(): Promise<void>;
  logout?(): Promise<void>;
}
```

开发适配器：

- 提供 `/dev/session` 页面。
- actor ID 和 tenant ID 只保存在 `sessionStorage`。
- 请求时注入两个 Dev Header。
- 仅在 `import.meta.env.DEV` 且显式配置后可启用。
- 生产构建检测到 Dev Header 配置时构建失败。

生产适配器：

- 预留 OIDC/SSO/同源网关 Session。
- 在后端正式人员认证方案确定后实现。
- 不在 URL、日志或可持久前端状态中保存凭证。
- 附件下载、预览和 iframe 无法携带自定义请求头，认证方案必须连同下载通道一起决策：同源 Cookie session（需后端补 CSRF 设计）或后端签名 URL；决策落地前所有下载统一走 fetch + blob，不使用裸 `<a href>`。

### 5.3 权限模型

权限至少分四层：

1. 菜单可见性：`GET /api/v1/navigation`。
2. 路由访问：`GET /api/v1/authorization/me` 中的 authority。
3. 页面动作：按 read/write/delete/assign/export/review/manage 等 authority 控制。
4. 字段级访问：按字段 HIDDEN/READ/WRITE 和遮罩策略控制。

data scope 不在前端重新计算。前端不能因为当前用户拥有某个页面 authority，就假定他能读取所有关联客户、联系人、合同或审批记录。

`GET /api/v1/authorization/me` 的访问门槛是 `navigation:read`：没有任何权限的成员连 bootstrap 都无法完成，必须提供明确的“无权限”落地页，而不是白屏或循环重定向。

前端权限组件建议：

```tsx
<RouteAuthority authority="customers:read" />
<ActionAuthority authority="customers:write">
  <Button>新建客户</Button>
</ActionAuthority>
<FieldAccess field={fieldMetadata} mode="write">
  <DynamicField />
</FieldAccess>
```

禁止把 authority 复制成散落字符串；统一从类型化 authority catalog 引用。

### 5.4 API 客户端

API 层职责：

- 从 `openapi/atom-crm.json` 生成类型。
- 使用统一 base URL，浏览器只请求相对 `/api`。
- 注入认证适配器。
- 解析 JSON、Blob、CSV 和流式下载。
- 统一生成 `ApiError`。
- 处理请求取消。
- 为可安全重试的 GET 提供有限重试。
- mutation 不做无条件自动重试。
- mutation 进行中禁用重复提交。
- 维护统一 errCode 目录与中文词条表。
- Query Key 由 feature 内的工厂生成。

错误处理建议：

| HTTP | 前端处理                                                                                                    |
| ---- | ----------------------------------------------------------------------------------------------------------- |
| 400  | 展示参数或表单错误                                                                                          |
| 401  | 交给 AuthAdapter                                                                                            |
| 403  | 权限页或局部无权限状态                                                                                      |
| 404  | 记录不存在或被可见性策略隐藏                                                                                |
| 409  | 按 errCode 分流：VERSION_CONFLICT/CONCURRENT_OPERATION 走冲突流程；RESOURCE_ALREADY_EXISTS 展示重复资源提示 |
| 416  | 文件 Range 不合法，重新请求完整文件或提示                                                                   |
| 422  | 展示稳定业务错误消息                                                                                        |
| 429  | 展示限流状态和可恢复提示                                                                                    |
| 503  | 局部不可用，允许显式重试                                                                                    |
| 5xx  | 全局错误追踪 ID 和安全提示                                                                                  |

服务端 `errMsg` 为英文技术文案，仅作兜底展示；用户可见错误消息以 errCode→中文词条表为准。不得把原始请求、堆栈或敏感字段写入控制台。

### 5.5 状态管理

状态归属：

- 服务端数据：TanStack Query。
- 路由、分页、搜索、筛选：URL。
- 未提交表单：React Hook Form。
- 跨组件临时 UI 状态：优先组件内 state 与 Context，确有跨页面共享需求时引入 Zustand。
- 服务端保存的菜单偏好、字段布局和保存视图：对应后端接口。

不把实体详情复制进 Zustand，不实现第二套业务缓存。

### 5.6 动态字段引擎

后端支持：

- TEXT
- TEXTAREA
- SELECT
- MULTI_SELECT
- DATE
- DATETIME
- INTEGER
- DECIMAL
- BOOLEAN
- EMAIL
- PHONE
- URL
- FILE
- USER
- DEPARTMENT
- RELATION
- ADDRESS

每种字段需要具备：

- 编辑组件。
- 只读展示组件。
- 列表单元格组件。
- 筛选条件组件。
- 序列化与反序列化。
- 空值规范。
- 必填和长度校验。
- 字段权限处理。
- 遮罩结果处理。
- 移动端交互。

动态字段层还要支持：

- section 分组。
- displayOrder 排序。
- layout 的 orderedCodes、hiddenCodes、pinnedCodes、columnWidths。
- SELECT/MULTI_SELECT 选项。
- 自定义字段唯一性提示。
- searchable 字段才能进入保存视图条件。
- FILE 字段的草稿与候选绑定。
- RELATION 根据对象类型使用正确选择器。
- ADDRESS 的省市区数据来自后端 RegionReference 接口，前端不打包行政区划数据。

动态字段元数据必须按 tenant、objectType、成员权限进行 Query 缓存，切换身份或 tenant 时彻底清理。

### 5.7 通用数据视图

建立统一 `EntityListPage` 和可组合能力，但不把所有领域强行抽成一个巨型配置文件。

桌面端：

- 表格、固定列、调整列宽、批量选择。
- 搜索、快捷筛选、保存视图、高级筛选。
- 列显示配置。
- 分页和总数。
- 新建、导出、批量操作。

移动端：

- 卡片列表。
- 关键字段摘要。
- 搜索栏和筛选 Drawer。
- 下拉刷新语义。
- 无限加载或明确“加载更多”；是否使用 cursor 取决于接口。
- 主要动作放在底部安全区域。

列表字段不得假设总是存在；隐藏、遮罩、无权限和 `UNAVAILABLE` 必须有稳定展示。

### 5.8 详情页模型

通用详情页包含：

- 标题、状态、负责人、关注状态。
- 主操作和更多操作。
- 基本信息。
- 动态字段。
- 跟进活动时间线。
- 附件和 FILE 字段。
- 关联对象。
- 嵌入页面。
- 阶段流程或审批状态。

桌面端使用分栏或 Tabs；移动端参考 H5 使用分区卡片和底部操作栏。

### 5.9 乐观锁

所有带 `version` 的更新：

- 表单载入时保存版本。
- 提交时发送原版本。
- 409 先按 errCode 判定：仅 VERSION_CONFLICT/CONCURRENT_OPERATION 进入冲突流程，RESOURCE_ALREADY_EXISTS 走重复资源提示。
- 409 后不覆盖本地表单。
- 提示数据已被其他成员修改。
- 提供“保留当前输入并重新加载对比”或“放弃输入并刷新”。
- 第一阶段可先实现安全的刷新确认，后续再实现字段差异比较。

Query mutation 成功后只失效相关 Query Key，不全局清空缓存。

### 5.10 附件与 FILE 字段

需要区分：

- 普通业务附件。
- 受治理的动态 FILE 字段。
- 新建对象前的 file-field draft。
- OA 表单 FILE 草稿。
- 公开营销表单匿名草稿。
- 内容上传、确认、撤销、下载和 Range 下载。

前端需要显式状态机：

```text
选择文件
  -> 创建上传意图/草稿
  -> 上传内容
  -> 服务端确认候选
  -> 表单提交时绑定
  -> 成功后清理临时状态
```

页面离开、上传失败、表单取消时要执行允许的撤销流程。不能把未绑定文件永久留在前端状态中。

下载与预览在认证下载通道决策落地前统一走 fetch + blob（见 5.2），不使用裸 `<a href>` 或 `<img src>` 直连受保护端点。

## 6. 页面与模块范围

### 6.1 工作空间

- 仪表盘总览。
- 时间范围和数据范围偏好。
- 工作台/待办聚合。
- 工作项确认。
- 通知中心（无推送通道，需定义轮询间隔与角标失效策略）。
- 快捷入口设置。

### 6.2 CRM

- 客户：列表、详情、新建、编辑、查重、标签、地址、层级、协作者、负责人、关注、导出、附近客户、业务概览。
- 客户公海：公海配置、成员资格、列表、入池、领取、分配、删除。
- 联系人：列表、详情、新建、编辑、关联客户、层级、协作者、关注、导出。
- 联系人公海：配置、列表、入池、领取、分配、删除。
- 线索：列表、详情、新建、编辑、查重、协作者、负责人、关注、转换、附近线索。
- 商机：列表、详情、新建、编辑、管线、阶段、结果、联系人、首要联系人、产品、协作者。
- 产品：列表、详情、新建、编辑、上下架、负责人、动态字段。
- 产品分类：树、创建、编辑、状态和删除。
- 跟进活动：时间线、新建、编辑、删除、方式和模板。
- 回访：列表、详情、新建、编辑、负责人、关系选择。

附近客户/附近线索依赖浏览器定位授权与地图选型（见 §15）；首期可降级为按距离排序的列表。

### 6.3 交易

- 合同：列表、详情、新建、编辑、合同产品、负责人、协作者、删除、审批状态。
- 开票资料：按客户维护。
- 发票：列表、详情、新建、编辑、开票、重置、负责人、删除。
- 回款：列表、详情、新建、编辑、负责人、删除。
- 回款计划：列表、详情、新建、批量创建、编辑、删除、进度。

### 6.4 审批与流程

- 审批定义：列表、详情、创建、编辑、路由步骤、启停。
- 审批实例：发起、预览、列表、详情、待办、审批、驳回、转审、撤回、取消、批量处理。
- 阶段工作流：定义、阶段、条件、必填字段、审批门、推进记录、评论。

### 6.5 Work 与 OA

- Work 任务：列表、详情、新建、编辑、状态、指派、关注人、评论、业务关联、附件。
- 周期任务：规则、实例、暂停/恢复、未来提醒。
- 任务提醒和通知偏好。
- OA 表单：定义、字段、审批定义关联、启停。
- OA 申请：预览、提交、列表、详情、审批关联、附件。
- OA 公告：草稿、发布、定时发布、撤回、收件箱、已读。

### 6.6 营销、报表与平台

- 营销表单管理。
- 公开营销表单渲染和提交。
- 营销表单趋势和提交记录。
- 公开线索接入客户端管理。
- 固定看板、趋势、排行。
- 自定义报表定义和运行。
- 组织、部门、成员、成员申请。
- 角色、授权、成员角色分配。
- 字段定义、字段布局、角色字段策略。
- 保存视图。
- 嵌入页面。
- 企业数据查询与采用。
- 连接器注册、凭证轮换、状态和控制面。

API-only 的 `/api/v1/connector-ingress` 和 `/api/v1/open/leads` 不建设人工提交页面；只建设对应凭证或接入管理页面。

## 7. H5 交互迁移策略

保留：

- 首页快捷入口和工作项聚合。
- 手机端 CRM 卡片结构。
- 详情页状态头、业务分区和底部动作。
- 动态表单的字段类型覆盖。
- 通用选择器。
- 审批时间线。
- 公海领取/分配动作。
- 跟进时间线和关联业务。

Web 增强：

- 宽屏表格和批量操作。
- 分栏详情。
- Drawer 快速编辑。
- 键盘操作。
- 列配置和保存视图。
- 复杂选择器的搜索、分页和多选。
- URL 深链。

实施前建立 `docs/ui-reference.md`：

- 每个新页面对应的 H5 文件。
- 借鉴的交互点。
- 明确不复用的旧行为。
- 新后端接口的差异。
- 桌面端和移动端的差异设计。

## 8. 分阶段实施计划

## P0：仓库与契约基线

交付：

- 创建独立 Git 仓库。
- 基础 README、AGENTS.md、许可证和 Node/pnpm 版本。
- 导出 OpenAPI 快照。
- 生成首版 TypeScript 类型。
- 建立 `docs/api-coverage.md`。
- 建立 Controller/endpoint 到页面/动作的覆盖矩阵。
- 建立 H5 页面参考矩阵。
- 列出 OpenAPI 缺失、菜单缺失和生产认证待决项。
- 提供 `api:snapshot` 脚本：从运行中的后端拉取 `/v3/api-docs` 契约、格式化落盘，并写明刷新流程。
- 定义联调与 E2E 环境：docker compose（后端 + MySQL + 受信 Header profile + 种子租户/成员/角色）与数据重置约定。
- 与后端定案金额 BigDecimal 序列化方式（字符串 vs number）。
- 建立 errCode 目录与中文词条表基线。
- 决定中文标题词条和 i18n key 映射方式。

退出标准：

- `pnpm install`、`pnpm typecheck`、`pnpm test`、`pnpm build` 可运行。
- OpenAPI 类型可以重复生成且无未提交漂移。
- 所有接口至少被标记为 UI、后台管理、公开页面或 API-only。

## P1：应用壳与安全基础

交付：

- React Router SPA 工程。
- 全局 Provider、Ant Design 主题和中文 locale。
- 响应式主布局。
- 开发身份页和 Dev AuthAdapter。
- API 客户端和错误模型。
- 当前成员 authorization bootstrap。
- 服务端菜单渲染。
- 路由权限和动作权限组件。
- 401/403/404/409/5xx 页面。
- Error Boundary、Suspense 和请求加载状态。
- 基础日志接口；默认不采集敏感业务数据。

首条真实联调链路：

```text
开发身份
  -> /authorization/me
  -> /navigation
  -> 主布局
  -> /dashboard/overview
```

退出标准：

- 无权限用户不能看见或进入受限页面。
- 生产构建不会携带 Dev Header。
- 刷新任意已注册路由可正确恢复页面。
- 桌面和 375px 页面壳可用。

## P2：通用业务引擎

P2 组件以 P3 客户模块为第一消费者交错交付，不闭门造完全部引擎再开工业务页面；保存视图与高级筛选可推迟到客户列表落地后实现。

交付：

- Query Key 工厂和分页适配。
- 通用列表工具栏、桌面表格和移动卡片。
- 动态字段编辑/展示/筛选组件。
- 字段布局。
- 保存视图。
- 人员、部门及实体选择器。
- 标签、地址、关系字段。
- 普通附件和 FILE 字段状态机。
- 跟进活动时间线。
- 乐观锁冲突通用处理（按 errCode 分流，见 5.4/5.9）。
- CSV/Blob 下载。

退出标准：

- 每种 CustomFieldType 至少有单元测试。
- HIDDEN/READ/WRITE/遮罩场景有组件测试。
- 普通页码分页与 cursor 分页不会混用。
- 上传取消和页面离开不会遗留不可控前端状态。

## P3：CRM 核心闭环

建议顺序：

1. 客户。
2. 联系人。
3. 线索和转换。
4. 客户/联系人公海。
5. 商机和管线。
6. 产品和分类。
7. 跟进活动、回访。

客户作为首个完整 vertical slice，必须覆盖：

- 列表。
- 搜索、保存视图和动态列。
- 详情。
- 新建、编辑。
- 查重。
- 标签、地址、负责人、协作者和层级。
- 关注。
- 附件与 FILE 字段。
- 活动时间线。
- 导出。
- 客户业务概览。
- 375px 移动布局。

退出标准：

- CRM 主链路 E2E 通过。
- 线索转换结果可跳转到新客户/联系人。
- 公海操作按独立 authority 控制。
- 商机产品价格由后端计算，前端不复制结算规则。

## P4：交易闭环

交付：

- 合同与合同产品。
- 开票资料。
- 发票。
- 回款。
- 回款计划。
- 合同、发票、回款的客户关系导航。
- 金额、日期和状态组件。
- 相关审批与阶段状态入口。

退出标准：

- 金额处理遵循 P0 契约决策：若后端改为字符串序列化则全链路按字符串/Decimal 处理；否则前端对金额零算术运算，仅用统一 formatter 展示服务端数值。
- 合同到发票到回款的完整 E2E 通过。
- 版本冲突和后端业务上限错误得到明确展示。

## P5：审批、流程与 Work

交付：

- 审批定义编辑器。
- 审批发起和预览。
- 待办、审批详情和时间线。
- 审批、驳回、转审、撤回、取消、批量动作。
- 阶段工作流配置和运行记录。
- Work 任务、评论、关注人和业务关联。
- 周期任务、提醒计划和通知。

退出标准：

- 当前审批人、管理员和普通参与者看到的动作不同。
- 审批事实只展示服务端返回的可见字段。
- 批量操作正确展示原子成功/失败结果。
- Work 任务参与者可见性不被前端扩大。

## P6：OA、营销与报表

交付：

- OA 表单。
- OA 申请提交和详情。
- OA 公告管理和收件箱。
- 营销表单管理。
- 公开营销表单独立应用壳。
- 匿名 FILE 草稿上传。
- 营销提交趋势。
- 仪表盘偏好。
- 固定趋势/排行。
- 自定义报表。

退出标准：

- 公开页面不加载内部认证数据。
- 匿名上传凭证不进入日志或持久存储。
- 不可用看板卡片按服务端 `UNAVAILABLE` 局部降级。
- 报表字段和维度严格按服务端 catalog。

## P7：组织与平台管理

交付：

- 部门树和成员管理。
- 成员申请。
- 角色、授权和分配。
- 字段定义与状态。
- 字段布局。
- 角色字段策略。
- 菜单偏好。
- 嵌入页面。
- 线索接入客户端。
- 连接器。
- 企业数据。

退出标准：

- 角色授权不能提交未知或不可委派 authority。
- 字段停用、删除依赖冲突有清晰反馈。
- 一次性凭证只在创建成功后展示一次，页面离开后不再恢复。
- 不在前端存储完整连接器密钥。

## P8：质量、性能与交付

交付：

- 全量接口覆盖矩阵收口。
- 全量核心 E2E。
- 响应式回归。
- Accessibility 审核。
- 性能分析和路由拆包。
- 依赖和供应链检查。
- 安全检查。
- 监控与错误上报接入（按 §15 选型决策）。
- 部署 Dockerfile 或静态资源构建方案。
- Nginx/网关同源代理示例。
- 环境变量说明。
- 运维和故障排查文档。

退出标准：

- 无 TypeScript、Lint、测试和构建错误。
- 所有 UI 范围接口均有页面或动作。
- 生产包不包含 Dev AuthAdapter 入口。
- 首屏仅加载应用壳和当前路由必要代码。
- 无未处理 Promise rejection 和常规 console error。

## 9. 测试计划

### 9.1 单元测试

重点：

- API 错误解析。
- Query Key。
- 金额和日期格式。
- authority 判断。
- 字段权限。
- CustomFieldType 序列化。
- 乐观锁状态。
- 上传状态机。
- URL Search Params。

### 9.2 组件测试

重点：

- 动态表单。
- 动态表格列。
- 保存视图。
- 实体选择器。
- 权限动作。
- 遮罩字段。
- 详情头和移动底部动作栏。
- 审批时间线。

### 9.3 MSW 集成测试

- 正常响应。
- 401/403。
- 404 隐藏记录。
- 409 并发冲突。
- 422 业务错误。
- 429 限流。
- 503 局部不可用。
- 分页末页。
- cursor continuation。
- 文件上传中断。

### 9.4 Playwright E2E

首批场景：

1. 开发身份进入系统并加载动态菜单。
2. 查询、新建、编辑客户。
3. 客户查重、标签、负责人和协作者修改。
4. 线索转换客户/联系人。
5. 公海领取和分配。
6. 商机阶段推进和产品配置。
7. 创建合同、发票、回款和回款计划。
8. 发起并处理审批。
9. 创建任务、评论、提醒和附件。
10. 发布公告并确认已读。
11. 匿名提交营销表单。
12. 409 冲突不覆盖其他用户更新。

桌面流程统一在 1440px 验证；375px 仅覆盖移动高频场景（公海领取、跟进记录、审批待办、营销表单提交），不逐条复跑全部流程。E2E 依赖 P0 定义的 compose 环境与种子数据，每轮运行前重置数据。

## 10. CI/CD

建议脚本：

```json
{
  "scripts": {
    "dev": "react-router dev",
    "build": "react-router build",
    "typecheck": "react-router typegen && tsc --noEmit",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "api:snapshot": "node scripts/fetch-openapi.mjs",
    "api:generate": "openapi-typescript openapi/atom-crm.json -o src/api/generated/schema.d.ts",
    "api:check": "pnpm api:generate && git diff --exit-code -- src/api/generated"
  }
}
```

CI 顺序：

1. 安装锁定依赖。
2. OpenAPI 类型生成和漂移检查。
3. 格式检查。
4. ESLint。
5. TypeScript。
6. 单元/组件测试。
7. 生产构建。
8. 关键 E2E。

部署建议：

- 浏览器只访问同源 `/api`。
- 开发由 Vite 代理到 `localhost:8080`。
- 生产由 Nginx、Ingress 或网关分别代理静态页面和 Spring Boot。
- SPA 路由回退到 `index.html`，但 `/api`、`/v3/api-docs`、文件流路由不得被回退规则拦截。
- 静态资源使用内容哈希和长期缓存，`index.html` 使用短缓存。
- Nginx 示例包含 CSP、`X-Content-Type-Options`、`Referrer-Policy` 等安全响应头基线。

## 11. 安全要求

- 不信任浏览器提供的 tenant、actor、role、authority 或 data scope。
- 生产代码不能发送 Dev Header。
- 不记录密码、Token、API Key、连接器凭证、匿名文件凭证或完整敏感请求。
- 一次性密钥只在当前创建结果中展示，复制后不持久化。
- 页面错误不展示 Java 堆栈或服务端内部信息。
- 嵌入页面只使用服务端验证后的 HTTPS 模板结果，iframe 设置最小化 `sandbox` 与 referrerpolicy。
- 文件名、媒体类型、下载 Content-Disposition 以服务端返回为准。
- CSV 下载避免公式注入风险，前端不二次拼装服务端导出内容。
- 外链使用 `noopener`、`noreferrer` 和明确域名提示。
- 权限变化或 tenant 切换时清空 Query Cache、字段元数据和页面临时状态。
- 公开营销表单与内部应用使用独立 Provider 和最小依赖。
- 若生产认证采用 Cookie session，须与后端同步设计 CSRF 防护（当前后端为 STATELESS，无 CSRF 机制）。

## 12. 可访问性、国际化与响应式

目标：

- 关键流程达到 WCAG 2.2 AA 的基本要求。
- 所有表单控件有 label 和错误关联。
- 不只使用颜色表达状态。
- 弹窗、抽屉和菜单支持键盘焦点管理。
- 图表提供文本摘要。
- 支持系统减少动画偏好。
- 默认语言为 `zh-CN`。
- 后端 `titleKey` 通过前端词条表解析，缺失时显示安全 fallback 并在开发环境告警。
- 日期和时间明确使用当前成员时区；发送 API 时遵循接口约定。

断点建议：

- `< 768px`：移动卡片、全屏表单/Drawer、底部动作栏。
- `768px–1199px`：紧凑表格或双列卡片。
- `>= 1200px`：完整侧栏、宽表和分栏详情。

## 13. 性能目标

- 路由级懒加载。
- ECharts、复杂编辑器、审批定义编辑器按需加载。
- 表格大数据只使用服务端分页，不一次拉取全量。
- 实体选择器使用搜索和分页。
- 防止同一详情页重复请求相同字段元数据。
- Query Cache 按 tenant 和 actor 隔离。
- 初始路由不加载全部 feature。
- 图片和附件默认不预取内容。
- 公开营销表单不加载 Ant Design 中后台完整布局代码。

P8 使用真实构建产物确定最终 bundle budget，不在 P0 以未经验证的数字阻塞开发。

## 14. 风险与缓解

| 风险                   | 影响                            | 缓解                                                                                |
| ---------------------- | ------------------------------- | ----------------------------------------------------------------------------------- |
| 生产认证未实现         | 无法生产登录                    | P1 使用可替换 AuthAdapter；正式上线前完成后端身份适配                               |
| 服务端菜单不完整       | P3 后半段起大多数页面无导航入口 | P0 输出完整缺口清单；后端 catalog 扩充在 P3 期间落地，P4 页面上线前必须可从导航进入 |
| OpenAPI 描述不完整     | 类型生成缺失或错误              | 保存快照、契约测试；必要时修复后端 annotation                                       |
| 动态字段复杂           | 多模块重复和行为不一致          | P2 先完成字段矩阵和契约测试，再铺业务页面                                           |
| H5 与新接口差异大      | 误照搬旧流程                    | 每页建立旧 UI—新 API 差异表                                                         |
| 乐观锁处理遗漏         | 覆盖他人数据                    | mutation 基础层按 errCode 分流 409（版本冲突 vs 重复资源）                          |
| FILE 流程复杂          | 孤儿上传或绑定失败              | 显式上传状态机、取消流程和 E2E                                                      |
| 字段遮罩误处理         | 敏感信息泄露                    | 不推断、不拼接；权限/遮罩测试                                                       |
| 387 个接口范围大       | 后期发现遗漏                    | 持续维护 API coverage matrix                                                        |
| 移动与桌面双布局       | 组件复杂度上升                  | 共享数据与动作层，按页面形态组合视图                                                |
| 金额使用 JS number     | 精度问题                        | P0 与后端定案 BigDecimal 序列化；定案前前端对金额零算术运算                         |
| tenant 切换缓存污染    | 跨租户数据泄露                  | tenant/actor 进入 Query Key，切换时清空缓存                                         |
| 附件下载无法携带认证头 | 下载/预览全面受阻               | 随生产认证决策 Cookie session 或签名 URL；过渡期统一 fetch + blob                   |
| E2E 缺少可复现环境     | 各阶段退出标准无法执行          | P0 交付 compose + 种子数据 + 重置约定                                               |
| OpenAPI 快照与后端漂移 | 类型失真                        | 后端补构建期导出插件；快照刷新纳入联调节奏                                          |

## 15. 待评审决策

以下问题需要评审者明确指出建议：

1. 独立 SPA + 同源网关是否是正确部署形态，是否需要 Next.js/SSR。——评审建议：成立；后端零 CORS 配置、内部系统无 SSR 收益，不引入 Next.js。
2. React Router Framework Mode 是否比纯 Vite + Data Router 更适合本项目。——评审建议：采用，并直接落在 v8（2026-06 GA，自 v7 升级量小）。
3. 是否接受 Ant Design 作为桌面与响应式移动端的统一组件基础。——评审建议：接受，6.5.x 已稳定。
4. 生产认证预期是 OIDC、企业微信、现有 SSO 还是网关 Session。
5. 后端菜单是否计划扩充为全部模块入口。
6. 是否需要首期中英文双语，还是只提供中文并保留 i18n 能力。
7. H5 静态资源是否拥有迁移授权；若不确定，全部重新设计。
8. 报表是否只使用 ECharts，还是需要引入 AntV。——评审建议：首期仅 ECharts。
9. 是否需要 Storybook 作为动态字段和通用组件工作台。——评审建议：可缓，不阻塞首期。
10. 是否需要把公开营销表单单独构建为更小的 entry。——评审建议：独立小 entry，配合后端 permitAll + 限流通道。
11. 是否需要在首期支持 tenant 切换；当前后端是否提供合适的人类会话切换机制。
12. 是否允许为菜单、OpenAPI 和认证补充必要的后端改动。——评审建议：必须允许，NavigationCatalog 扩充、OpenAPI 构建期导出、金额序列化三项已是硬依赖。
13. OA 公告内容格式是纯文本还是富文本；若富文本需定编辑器选型与 DOMPurify 消毒策略。
14. 附近客户/线索是否需要地图渲染；若需要，定地图供应商与 Key 合规，否则首期降级为距离排序列表。
15. 浏览器支持矩阵（browserslist；是否覆盖微信内置 WebView）。
16. 监控与错误上报选型（Sentry 或自建），承接 5.4 的全局错误追踪 ID。

## 16. 全局完成定义

项目完成时应满足：

- 所有适合 UI 的后端接口在 coverage matrix 中有明确消费者。
- API-only 接口被明确标记，不为了“覆盖率”创建无意义页面。
- 核心对象拥有列表、详情、新建、编辑和主要业务动作。
- 菜单、路由、按钮、字段和数据可见性均符合服务端安全模型。
- 动态字段全部类型可编辑、展示和筛选。
- 普通附件、FILE 字段、OA FILE 和公开营销 FILE 流程正确。
- 409 不会导致静默覆盖。
- 375px、768px、1440px 关键页面可用。
- 无 TypeScript、Lint、测试和构建错误。
- 核心业务 E2E 通过。
- 生产构建不包含开发身份入口或 Dev Header。
- README、架构、部署、安全和接口覆盖文档完整。

## 17. 推荐的第一条实施切片

评审通过后，第一条 vertical slice：

```text
创建工程
  -> OpenAPI 类型
  -> Dev AuthAdapter
  -> authorization/me
  -> navigation
  -> 响应式应用壳
  -> dashboard/overview
  -> 客户字段元数据
  -> 客户列表
  -> 客户详情
  -> 客户新建/编辑
  -> 客户 409 冲突
  -> 客户 Playwright E2E
```

这条切片能够同时验证：

- 工程和部署形态。
- 鉴权。
- 菜单和权限。
- OpenAPI 代码生成。
- 普通分页。
- 动态字段。
- 响应式列表/详情/表单。
- 乐观锁。
- 测试体系。

在该切片稳定前，不建议并行铺开所有业务模块。

## 18. AI Reviewer Checklist

请评审者重点输出：

- `Blocking`：开始编码前必须修正的问题。
- `High Risk`：可能导致返工、安全问题或架构失控的问题。
- `Scope Gap`：遗漏的业务页面、接口类型或状态。
- `Sequencing`：里程碑顺序是否合理。
- `Over-engineering`：首期不必要的抽象或工具。
- `Under-engineering`：缺少的基础能力、测试或运维方案。
- `Backend Alignment`：必须与 `atom-crm` 协同修改的点。
- `Recommended Changes`：可直接合入本文档的具体修改建议。

评审时应以 `atom-crm` 当前接口和安全规则为准，不以旧 H5 的接口行为为准。
