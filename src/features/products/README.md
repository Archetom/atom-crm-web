# 产品功能边界

## 移动端交互参考

借鉴产品目录的关键词搜索、分类与可用性摘要、桌面列表和移动紧凑卡片；不复用 Vue/uni-app、全局列表 mixin、旧权限判断、旧金额格式化、旧接口或 DTO。

## 新 API 差异

`POST /api/v1/products/query` 使用生成的 `ProductQueryRequest`，并由服务端按 `products:read`、字段访问、遮罩、搜索字段可用性和数据范围返回分页结果。前端将关键词与页码保存到 URL；由于成功响应在 OpenAPI 中仍是泛型 Pager，运行时窄投影只消费产品 ID、名称、编码、分类名称、单位、可用性和状态，以及同一响应中已经过字段策略过滤的标量 `customFields`。动态列只在 `fields:read` 下由活动、非内置、非 FILE 目录定义生成；列表不会读取、缓存、展示或计算 list price、负责人、描述、附件、版本及其派生值，也不会从分类、导航或关联商机推断产品范围。

`GET /api/v1/products/{productId}` 也受 `products:read` 和服务端字段策略保护。只读详情保留稳定 ID/version、基础目录字段、服务端时间和未遮罩的目录价；目录价只格式化，不参与浏览器计算或更新草稿。`fields:read` 下，当前身份的 ACTIVE、非内置、非 FILE 目录仅为同一响应已经裁剪/脱敏的自定义标量值提供标题和格式；缺少目录或值时不展示，值也绝不进入编辑基线。负责人和完整编辑基线仍在详情投影之外。若同一详情响应含有 FILE 字段映射，页面仅保留符合服务端 `FieldCode` 规范的原始字段 code 和有效附件元数据；在 `products:read + files:read` 下才显示，并仅将该响应的 code/file ID 与当前产品 ID 交给认证 Blob 下载，绝不从字段目录、URL 或本地状态猜测下载路径。

产品详情在 `products:read + files:read` 下按需请求通用受控附件目标 `product`，只保留服务端已发布的文件 ID、显示名称、媒体类型、字节数与版本，并用认证 Blob 下载。`products:write + files:write` 下可上传 PNG/JPG/JPEG 或经显式确认使用附件原始 version 撤回；上传状态仅来自服务端安全检查结果。当前通用产品附件没有主图/详情图分组、排序、每组上限或创建请求中的附件绑定，界面因此标为“未分类”，不把参考页面的图片组语义伪造为前端字段。

产品列表名称、桌面“查看”和移动摘要标题只将当前服务端列表项的正安全 ID 写入 `productId`，并以 Drawer 打开与直达 `/crm/products/:productId` 相同的详情 Surface。关闭、删除或详情内返回仅删除该参数，保留关键词、分类筛选、场景、排序、保存视图和分页；列表不复制详情数据到本地状态，也不绕过 `products:read`、字段访问或数据范围复核。

`GET /api/v1/products/{productId}/editable-baseline` 是产品完整替换的唯一前置条件。它同时要求产品读写权限，并且服务端仅在名称、编码、分类、单位、目录价和说明全部可读、未遮罩、可写时返回这些业务字段与 version；否则只返回 `editable: false`、ID 与 version。前端不使用普通详情、列表、分类树或本地默认值补齐替换字段。分类目录加载失败同样关闭保存，避免未知分类被写空；409 需用户明确刷新或放弃草稿。

`POST /api/v1/products` 在 `products:write` 下提交名称、编码、目录价和用户明确选择的目录字段。目录价按用户确认的受限 number 原样交给生成类型，不做税率、折扣、汇率或派生计算；分类仅在 `products:read` 下使用同一身份分类树，负责人仅在 `products:assign + organization:read` 下使用服务端可见的在职成员目录。负责人未选择或目录失败时省略 `ownerActorId`，由服务端默认当前成员。`fields:read` 下创建页以当前身份的 PRODUCT 字段目录渲染标量动态字段；USER/DEPARTMENT 仅使用 `organization:read` 下的受限目录，FILE 仅绑定 `files:write` 下同一 PRODUCT 私有草稿中确认 `UPLOADED` 的文件 ID。目录、候选或必填附件不可用时保持关闭，RELATION 不降级为自由文本或 ID。服务端成功响应是后续详情跳转唯一使用的产品事实。

`PUT /api/v1/products/{productId}/availability` 只在详情同时返回可识别的 `AVAILABLE` 或 `UNAVAILABLE` 时由 `products:write` 显示。确认操作仅提交目标枚举与当前详情 version；成功响应才覆盖身份隔离的详情缓存并使列表失效。409 必须由用户明确选择刷新，浏览器不会自动重试或把详情字段拼成完整编辑请求。

`PUT /api/v1/products/{productId}/owner` 同时要求 `products:assign` 和 `organization:read`。候选只来自服务端可见的在职成员目录，提交只包含所选 `ownerActorId` 与详情原始 version；详情投影不读取或推断当前负责人。成功响应才覆盖缓存，409 仍需要用户明确刷新。

`GET /api/v1/product-categories` 在 `products:read` 下通过窄运行时投影读取树，`POST /api/v1/product-categories` 在 `products:write` 下创建根分类或已返回节点的子分类。子分类父级只能来自当前服务端树，提交仅含名称和该节点 ID；`PUT /api/v1/product-categories/{categoryId}` 可重命名或移动，始终携带树返回的原始 version 和名称。移动目标也只来自当前服务端树，前端排除自身、当前父级和全部后代；选择根级时省略父级字段，409 后必须由用户显式刷新。

`DELETE /api/v1/product-categories/{categoryId}` 只在 `products:delete` 下显示，并要求用户显式确认。请求仅发送树节点原始 version；浏览器不根据树形投影判断是否“可删”，服务端继续确认没有活动子节点和产品依赖。409 必须先刷新树后由用户再次确认，其他失败仅显示已审阅的错误码映射。

`DELETE /api/v1/products/{productId}` 同样要求 `products:delete` 和显式确认，仅提交详情原始 version。成功后浏览器删除该详情缓存、使目录失效并回到产品目录；产品下架、软删除以及附件和文件字段绑定撤回均由服务端执行，409 刷新后需要用户再次确认。

产品完整编辑使用安全基线渲染响应式基础表单，保存只发送用户确认的六个基础字段与基线 version。创建阶段已独立处理的动态字段和 FILE 附件、以及负责人、可用性与状态均不混入该完整替换请求；详情只读自定义字段也不重放或参与更新，完整的动态字段编辑仍须等待独立、完整版本化基线。
