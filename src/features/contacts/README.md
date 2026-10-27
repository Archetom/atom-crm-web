# 联系人功能边界

## 移动端交互参考

借鉴联系人列表的搜索、分页列表和移动端紧凑信息卡片。没有复用 Vue/uni-app、下拉刷新、全局列表 mixin、旧权限字符串、`tel:` 调用、旧接口或其 DTO。

## 新 API 差异

`GET /api/v1/contacts` 使用一基页码的 `ContactQueryRequest`，并由服务端按 `contacts:read`、字段访问和数据范围返回结果。前端将搜索和分页保存到 URL，仅展示服务端许可的联系人、客户与负责人引用；不推断客户名称、关联范围或旧 H5 的最后跟进信息。详情、新建和编辑将使用各自的路由与生成请求契约单独交付。

联系人详情读取使用 `GET /api/v1/contacts/{contactId}` 和身份隔离的 Query Key。列表名称、桌面“查看”和移动摘要标题以正安全整数 `contactId` 打开同一详情 Drawer；关闭或详情内返回只移除该列表参数，保留关键词、客户筛选、场景、排序、保存视图和分页，直接访问详情路由复用同一 Surface。沿用移动端联系人详情页的基础信息与标签分区，但不继承其客户端操作权限、活动时间线、嵌入页、附件 URL 或老接口字段；当前只展示服务端返回且可安全投影的基础字段和地址，排除动态字段。地址只展示精确服务端回显，不充当编辑基线或补造地区信息。

详情在 `contacts:read + files:read` 下还会呈现当前响应回显的 FILE 字段附件。窄投影只保留合法字段 code、正 file ID、文件名与可选媒体类型/大小；下载固定当前联系人 ID 和 `contact` target type，经认证 Blob 请求再次接受服务端的记录可见性、字段策略和文件状态复核。字段目录、列表、草稿或本地权限都不能补齐附件、猜测下载路径或提供上传/撤回入口。

详情在 `fields:read` 下会按当前身份的 CONTACT 字段目录显示同一响应已裁剪、脱敏的 ACTIVE 非内置非 FILE 标量值。目录只提供字段标题、选项标签和安全 URL 格式，不能证明字段可读、未遮罩或可写；缺少回显值、目录失败、未知、停用、内置或 FILE 字段均不显示，也绝不作为编辑基线。

联系人新建使用 `POST /api/v1/contacts` 的生成请求契约，只提交名称、职务、联系方式、网站、说明、下次联系时间、用户明确选择或输入的标签，以及已经由当前身份服务端详情确认的可选客户关系。已有标签候选仅在 `contacts:read` 与 TAGS 字段未遮罩时从服务端目录读取。用户还可明确填写一条主地址；只有填写详细地址时才提交地址对象，地区、城市和邮编均为可选且不会由浏览器推断。全局 `/crm/contacts/new` 在 `customers:read` 下可从服务端范围化客户目录选择关联客户，选择后仍重新读取详情，只有精确匹配才发送 `customerId`；参考“新建客户”中的“创建并新建联系人”则将刚创建响应中的客户 ID 与严格匹配的内部客户详情返回路径带入同一页，继续沿用该复核。`contacts:assign + organization:read` 下还可从服务端在职成员目录选择可选负责人；未选则省略 `ownerActorId` 并由服务端默认当前成员。`fields:read` 下，当前身份可见的 ACTIVE 非内置标量动态字段会按字段目录填写；USER/DEPARTMENT 仅使用 `organization:read` 下的受限成员或部门目录。FILE 字段仅在 `files:write` 下绑定同一 CONTACT 私有草稿中已确认 `UPLOADED` 的文件 ID；必填字段目录、候选或附件无法安全完成时，创建失败关闭。缺少权限、格式异常、不可见或读取失败会失败关闭已请求的关联创建，不会悄悄降级为未关联联系人；不匹配的返回路径只被丢弃并回落联系人列表，绝不作为自由跳转目标。上级联系人和协作者仍保持独立流程，当前不会由浏览器猜测可选对象或写入其 ID。

联系人基础编辑使用 `PUT /api/v1/contacts/{contactId}`，复用详情的身份隔离缓存和 version，不提交未变化字段。参考移动端联系人编辑页的编辑布局，但不继承其旧权限或全字段写回行为；下次联系时间会从详情预填，只有用户修改才提交，清空时发送生成契约允许的显式 `null`。关联客户、地址、动态字段和附件仍使用独立的受控流程。

联系人创建前查重使用 `POST /api/v1/contacts/duplicate-check`，只发送名称和联系电话并只消费服务端返回的布尔值。不会显示、保留或推断任何潜在重复记录，最终创建仍以服务端校验为准。

联系人列表的独立查重同样使用该 endpoint，并要求当前成员具备 `contacts:read`。弹窗仅接受姓名或联系电话，不读取列表项、当前身份、业务线或联系人详情；关闭后不改变列表 URL、筛选或缓存。

附近联系人使用 `GET /api/v1/contacts/nearby`，仅在用户明确点击后请求浏览器定位，并按服务端距离分页；不接入地图供应商、Key、定位缓存、坐标上报或位置字段展示。精确坐标只留在本页瞬态状态和 identity 隔离的查询键中，不进入 URL、持久化存储、日志或页面文本；半径、页码和每页数量才可从 URL 恢复。响应只消费服务端当前可见的联系人窄投影与非负距离，定位拒绝、不可用、超时和查询失败均给出明确反馈。

联系人个人关注使用 `PUT /api/v1/contacts/{contactId}/star`。这是当前成员的个人状态，不要求联系人写权限，也不会在前端假定或更新其他成员的状态。

联系人列表的当前页批量转移和删除分别使用 `PUT /api/v1/contacts/batch/owner` 与 `POST /api/v1/contacts/batch/delete`。前者仅在 `contacts:assign + organization:read` 下展示受限在职成员目录，后者仅在 `contacts:delete` 下经过二次确认；两者只提交当前投影的 `contactId + version`。关键词、分页、场景、排序、保存视图、客户筛选或临时筛选变更会清空选择，成功后失效联系人查询；成员资格、可分配范围、字段策略、活动下级、附件/FILE 撤回和整批原子性全部由服务端复核。

详情标签卡片在已受 `contacts:read` 保护的详情中仅向 `contacts:write` 成员提供“管理标签”。打开编辑器后先读取 `GET /api/v1/contacts/tags`；只有目录成功解码，才可把当前详情的服务端可见标签作为 `PUT /api/v1/contacts/{contactId}/tags` 的完整替换草稿。保存携带原始 version，拒绝空白、超长与规范化重复标签；目录失败、遮罩、服务端字段策略、数据范围和并发都不会由浏览器猜测或绕过。

联系人列表的“我关注”将受限 URL 场景 `scene=starred` 映射为 `ContactQueryRequest.starred=true`；联系人 CSV 导出使用同一布尔条件。它不会在浏览器对已加载行进行二次筛选，也不会传递调用成员或范围 ID。

联系人关联客户复用 `PUT /api/v1/contacts/{contactId}` 的 `customerId`，候选项使用服务端裁剪过的客户列表，保存仍由服务端校验联系人的写权限、客户读取范围和字段写权限。已发布的生成契约允许显式 `null`，因此当前支持设置、更换及经确认清除关联；省略字段仍不会意外改写现有关联。

联系人层级读取 `GET /api/v1/contacts/{contactId}/hierarchy` 的窄投影，只展示服务端当前返回的可见上级与下级。设置上级使用 `PUT /api/v1/contacts/{contactId}/parent`，候选集排除当前已知可见后代，清除与设置均带 version；浏览器只作辅助防护，循环和容量规则仍由服务端决定。

联系人状态使用 `PUT /api/v1/contacts/{contactId}/state` 原子更新锁定和成交状态。仅当详情明确回显布尔 `locked` 与 `OPEN|WON` 成交状态时，`contacts:write` 下才打开编辑；保存始终携带原始 version，字段访问、生命周期、范围和并发仍由服务端复核。

联系人协作者使用 `GET` 与 `PUT /api/v1/contacts/{contactId}/collaborators` 管理。该能力仅在 `contacts:assign` 下显示；`GET` 必须返回完整的 `{ version, collaborators, callerState }` 基线，前端只以该基线的 `version` 完整替换，绝不从详情或本地状态补齐。基线缺失、加载中或解码异常时所有草稿操作和保存均失败关闭，成员候选另受 `organization:read` 限制。`contacts:write` 下可经确认调用 `DELETE /api/v1/contacts/{contactId}/collaborators/me?version=...` 退出协作；服务端复核实际身份，成功后清除详情/协作者缓存并返回列表。

联系人负责人使用 `PUT /api/v1/contacts/{contactId}/owner` 变更，入口需同时满足 `contacts:assign` 与 `organization:read`。候选成员只使用服务端返回的在职成员，保存携带 version，最终可分配范围由服务端校验。

联系人删除使用 `DELETE /api/v1/contacts/{contactId}?version=...`，只在 `contacts:delete` 下以二次确认发起。前端只提交当前详情 version，成功后清除联系人域缓存、失效联系人公海缓存并返回列表；不依据层级投影推断活动下级联系人，也不处理附件或 FILE 绑定，均由服务端复核。

联系人 CSV 导出使用受控 `POST /api/v1/contacts/export/csv` Blob 下载，只在 `contacts:export` 下显示。首期固定请求 `contact_name` 并沿用 URL 关键词；字段未遮罩与导出范围交集均由服务端复核，浏览器不处理 CSV 内容。
