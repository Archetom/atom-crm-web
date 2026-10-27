# 商机功能边界

## 移动端交互参考

借鉴移动端商机列表的关键词搜索、阶段信息密度与移动端紧凑卡片，以及商机详情页的标题、阶段、基础信息和关联客户布局；不复用 Vue/uni-app、全局列表 mixin、旧权限判断、旧金额格式化、旧接口或 DTO。

## 新 API 差异

商机列表的当前页批量转移/删除使用 `PUT /api/v1/opportunities/batch/owner` 与 `POST /api/v1/opportunities/batch/delete`。转移仅在 `opportunities:assign + organization:read` 下从服务端受限成员目录选择，删除仅在 `opportunities:delete` 下二次确认；两者只提交当前投影中的 `opportunityId + version`。查询、分页、客户筛选、场景、排序、保存视图或临时筛选变化会清空选择，成功后重新读取商机列表；成员资格、分配范围、字段策略、附件/FILE 撤回和完整原子性始终由服务端复核。

### 新建基础字段

`/crm/opportunities/new` 在名称、客户、管线和阶段之外接收用户明确输入的可选预计成交日期、预计成交金额、下次联系时间和商机说明。日期和时间只由受控组件格式化；金额只接受有限非负数，说明修剪空白后为空则省略。页面不推断默认值、金额、折扣、税率或联系计划，提交后服务端继续重新校验字段写权限、数据范围与生命周期。

### 基础编辑更新

`GET /api/v1/opportunities/{opportunityId}/editable-baseline` 是基础编辑唯一可用的完整替换基线。它同时要求 `opportunities:read + opportunities:write`，并仅在名称、客户、管线、阶段、预计成交日期、预计金额、下次联系时间与说明全部未遮罩、可读可写时返回业务字段和 `editable: true`；`editable: false` 不得携带业务字段，运行时如发现泄露即失败关闭。`PUT /api/v1/opportunities/{opportunityId}` 只从该基线与用户输入构造，始终带原始 version；普通详情、列表、目录或本地默认值不能补齐字段。更换客户只接受 `customers:read` 下当前成员可见目录的明确候选；改管线或阶段只接受 `opportunity-pipelines:read` 下同一活动管线的成对候选。目录中已不存在的当前管线/阶段只能原样保留，不会被本地回退值改写。清空下次联系时间明确提交 `nextContactTime: null`，预计金额直接按确认数值传递，不在浏览器计算税率、折扣或汇率。本节取代下文的历史“基础编辑暂不能交付”说明。

### 协作者管理更新

`GET /api/v1/opportunities/{opportunityId}/collaborators` 是协作者完整替换唯一可用的读取基线，仅在 `opportunities:assign` 的 owner scope 下调用，且回显完整 `actorId`、`READ|WRITE` access、调用者协作状态与 version。运行时缺失、重复或非法成员会失败关闭，不会过滤后继续保存。`PUT /api/v1/opportunities/{opportunityId}/collaborators` 只使用该基线与用户明确更改后的完整清单，新增成员只能从 `organization:read` 的服务端在职成员目录选择；普通详情、列表、owner 或缓存不参与回填。`DELETE /collaborators/me` 仅在 `opportunities:write` 的显式确认中发送详情原始 version，调用者身份、是否为负责人、范围与并发均由服务端最终确认。本节取代下文的历史“商机协作者暂不能交付”说明。

### 列表详情状态

列表名称、桌面“查看”和移动摘要标题只将当前服务端列表项的正安全 ID 写入 URL `opportunityId`，并以 Drawer 打开与直达 `/crm/opportunities/:opportunityId` 相同的详情 Surface。关闭、详情内返回、退出协作或删除只移除该参数，保留关键词、客户筛选、场景、排序、保存视图和分页；列表自身不把详情数据复制进本地状态，也不绕过 `opportunities:read`、字段访问或数据范围复核。

`POST /api/v1/opportunities/query` 使用生成的 `OpportunityQueryRequest`，并由服务端按 `opportunities:read`、字段访问和数据范围返回具名 `OpportunityPageResponse` 分页结果。关键词和页码保存到 URL；运行时窄投影只消费服务端回显且通过本地格式校验的名称、客户/负责人引用、管线/阶段、预计金额、预计成交日期、备注、结果、状态和个人关注状态。金额只接受有限非负数，日期只接受完整本地日期，异常或受限值保持空态；浏览器不推断客户、联系人或管线的可见性。列表还会对同一筛选发起 `POST /api/v1/opportunities/summary`：该端点由服务端额外确认预计金额字段未遮罩，运行时只保留非负安全的条数和总额；分页与排序不会改变汇总键或让浏览器合计列表行，错误时不显示汇总。`GET /api/v1/opportunities/{opportunityId}` 以同一 authority 读取具名 `OpportunityResponse`；运行时解码器只消费已裁决的基础字段、预计金额和受控 FILE 下载路径，联系人、产品、协作者与动态字段仍各自走独立受限投影。详情中的 `POST /api/v1/opportunities/{opportunityId}/contacts/query` 同时要求 `opportunities:read` 与 `contacts:read`，失败关闭投影只保留服务端返回的联系人 ID、名称和首要标识；该结果可能因联系人数据范围而省略关联项，绝不作为全量替换基线。`PUT /api/v1/opportunities/{opportunityId}/primary-contact` 只从这一服务端可见关联集合中设置或清除首要联系人，使用详情原始 version，且不会提交或推断完整联系人清单。详情中的 `GET /api/v1/opportunities/{opportunityId}/products` 同时要求 `opportunities:read` 与 `products:read`；它的失败关闭投影只保留产品名称、编码、分类、单位和数量，丢弃 list price、unit price、折扣、行金额和总金额，且不在浏览器进行任何金额或数量计算。`/crm/opportunities/new` 提交名称及从服务端可见客户、活动管线和活动阶段目录选择的值；它要求 `opportunities:write`，后端还要求 `customers:read`，前端为安全选择额外需要 `opportunity-pipelines:read`。仅在客户已选择且具有 `contacts:read` 时，页面才会读取该客户的受限联系人目录；创建请求只发送明确选择的去重 `contactIds`，可选 `primaryContactId` 必须属于该选择集合，切换客户会清空联系人草稿。仅同时具有 `opportunities:assign + organization:read` 时可从服务端可见在职成员目录选择负责人；未选择或目录失败时省略 `ownerActorId`，由服务端默认当前成员。创建页还在 `fields:read` 下按当前身份的 OPPORTUNITY 字段目录提交标量动态字段；USER/DEPARTMENT 仅从 `organization:read` 的受限目录选择，FILE 只绑定 `files:write` 下同一 OPPORTUNITY 私有草稿中确认 `UPLOADED` 的文件 ID，必填字段无法安全填写时关闭创建，RELATION 不降级为自由文本或 ID。详情中的关注仅向当前可见商机的 `star` endpoint 提交调用成员的布尔偏好，不携带 version 或业务字段，成功后只更新当前身份缓存。阶段推进使用当前详情 version，并只允许从该商机当前管线的服务端活动阶段中选择，前端不会手输或补全 code。结果更新只允许明确选择服务端枚举的 `OPEN`、`WON`、`LOST` 或 `INVALID`，携带原始 version；恢复 `OPEN` 不提交说明，其他结果只提交用户显式输入的说明。负责人变更要求 `opportunities:assign`，候选仅来自服务端可见在职成员目录，提交携带原始 version。`DELETE /api/v1/opportunities/{opportunityId}` 只在 `opportunities:delete` 下经显式确认提交详情原始 version；成功后移除该商机详情、关联联系人和产品窄投影缓存并返回列表。浏览器不读取或推断关联客户、联系人、产品或非受控的附件/文件字段关系，软删除、关联撤回、所有者范围和并发由服务端复核。基础编辑与协作者管理分别已以完整版本化基线交付，详见本文件前述章节；完整联系人替换仍不开放，因为查询结果按联系人数据范围裁剪，后端需提供可安全全量替换的完整授权基线。

### 关联联系人完整替换（2026-08-12）

本节取代上文历史的“完整联系人替换仍不开放”说明。`GET /api/v1/opportunities/{opportunityId}/contacts/baseline` 是联系人完整替换的唯一读取基线：仅在当前成员同时具备商机读写、联系人读取，商机当前写入范围、关联字段未遮罩可写，以及每一既有关联联系人仍在读取范围内时，才返回客户、完整联系人清单和 `version`。否则只返回 `id/version/editable=false`，前端对任何包含关系值的不可编辑响应失败关闭。可编辑弹窗只从该基线与用户明确更改生成完整 `contactIds` 和可选 `primaryContactId`；新增候选仍来自同一客户的受限联系人目录，普通详情的裁剪联系人投影、缓存或本地权限绝不参与补齐。服务端在保存时重新核验联系人可见性、客户归属、字段策略、写入范围与并发。

### 关联产品完整替换（2026-08-12）

普通详情的产品卡继续是无金额窄投影；“管理关联产品”仅在 `opportunities:write + products:read` 下按需读取 `GET /api/v1/opportunities/{opportunityId}/products` 的具名、完整版本化快照。草稿只使用该响应中的产品 ID、数量、成交单价和受限展示元数据；用户可从当前可售服务端产品目录添加、移除或调整行，单价留空时由服务端采用目录价。保存发送完整的生成 `lines + version`，浏览器绝不从无金额投影、产品列表或本地计算补齐价格、折扣、行金额或总额。服务端仍以当前产品可售性、PRODUCTS 字段写策略、商机范围和版本作最终裁决。

详情在 `opportunities:read + files:read` 下还会呈现当前响应回显的 FILE 字段附件。窄投影只保留合法字段 code、正 file ID、文件名与可选媒体类型/大小；下载固定当前商机 ID 和 `opportunity` target type，经认证 Blob 请求再次接受服务端的记录可见性、字段策略和文件状态复核。字段目录、列表、草稿或本地权限都不能补齐附件、猜测下载路径或提供上传/撤回入口。

详情在 `fields:read` 下会按当前身份的 OPPORTUNITY 字段目录显示同一响应已裁剪、脱敏的 ACTIVE 非内置非 FILE 标量值。目录只提供字段标题、选项标签和安全 URL 格式，不能证明字段可读、未遮罩或可写；缺少回显值、目录失败、未知、停用、内置或 FILE 字段均不显示，也绝不作为编辑基线。
