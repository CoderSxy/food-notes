# 食记 UX 打磨 + 逆地理编码 + 物品价格 — 设计说明

**日期：** 2026-11-03（Asia/Shanghai）  
**状态：** Nero 已确认采用方案 A（九项一次实现、一次发布）；本文件只定设计，不含功能代码  
**仓库：** CoderSxy/food-notes  
**前置：**
- `docs/superpowers/specs/2026-11-01-list-carousel-edit-delete-design.md`（列表轮播、本人编辑删除、`window.confirm`）
- `docs/superpowers/specs/2026-11-01-r2-photos-design.md`（`EntryPhotos` / `PhotoPicker`）
- `docs/superpowers/specs/2026-10-31-leaflet-map-design.md`（`LocationField` + 点选/拖钉）
- `docs/superpowers/specs/2026-10-28-entries-items-design.md`（`kind`、菜系多选、物品大类/小类）  
**部署目标：** 合并后部署 ECS，生产域 `food.nerosun.cn`  
**实现安排：** 功能实现由 Codex CLI 按本文件另开，不在本 PR 改业务代码。

九项 UX / 数据修复合并为一份设计。菜系基数不变（仍可多选）。除物品可选价格外，不改其它业务语义。

## 1. 目标

一次实现覆盖以下九项，发布后登记与列表更接近温暖「食记」手感，定位能带出可读地址，物品可记价格。

1. 列表封面圆点是真正的小圆点（约 6px），不再被全局 `button` 撑成椭圆。
2. 删除确认改为应用内对话框；只有点「删除」才发请求，取消/关闭绝不删除。
3. 列表卡片的「编辑 / 删除」从整行大按钮改为右下角两个小图标，保留无障碍名称与 tooltip。
4. 增加页去掉「增加记录」标题和「收藏餐饮…」副文，表单直接开始。
5. 记录类型、菜系改为按钮式控件；菜系保持多选，类型互斥。
6. 「获取当前位置」成功以及地图钉移动后，经服务端 Nominatim 代理自动填入 `address_text`；失败不挡表单。
7. 编辑态选相册后立刻看到缩略图，上传仍走现有 presign/confirm。
8. 物品大类改为整行单选按钮；小类保持多选。
9. 物品增加可选人民币价格（允许小数）；有值时在卡片和详情展示。

成功标准：

- 多图卡片底部圆点视觉为正圆，当前张可略大/略亮；点圆点仍能 `scrollTo` 对应张。
- 列表、详情、照片删除：打开确认框后点「取消」、点遮罩、按 Escape，网络面板无 `DELETE`。
- 本人卡片右下角两个图标可进编辑、可打开删除确认；他人卡片仍无操作。
- `/entries/new` 首屏就是表单，没有「增加记录」页头。
- 创建页类型是两个互斥按钮（餐饮 / 物品）；菜系是可多选的切换按钮。
- 定位成功或拖钉后，地址栏被填入中文可读地址，仍可手改；逆地理失败时坐标仍在、表单可保存。
- 编辑页从相册选图后，缩略图出现在照片区，随后上传成功并进入已保存列表。
- 物品大类一排一个、单选；小类仍可勾多个。
- `kind=item` 可填 `12.5`；`kind=place` 无价格字段；有价格的物品卡和详情可见「12.5 元」。

## 2. 非目标

- 不接高德 / 腾讯 / Mapbox 等商业地理编码，不申请 Nominatim 以外的 Key。
- 不改封面排序、不新增「设为封面」API（创建页 `PhotoPicker` 本地调序保持；详情/编辑 `EntryPhotos` 仍无调序）。
- 不改短信通道、OTP、登录。
- 不把菜系改成单选，不把物品小类改成单选。
- 不给餐饮 `place` 加价格，不把价格送进地图气泡、AI 推荐或 legacy `/api/foods/*`。
- 不做自动播放轮播、循环克隆、封面视频。
- 不改编辑页「编辑记录」页头（只去掉**增加页**的 intro）。
- 本 PR **只提交本设计文档**；功能、migration、测试代码由后续实现 PR 完成。

## 3. 现状

| 项 | 现状 |
| --- | --- |
| 圆点 | `EntryCoverCarousel` 用 `<button class="entry-cover-dot">`。CSS 写了 `width/height: 7px; padding: 0; border-radius: 50%`，但全局 `button` 仍是 `min-height: 44px; padding: 10px 17px; display: inline-flex`，圆点被拉成竖椭圆。 |
| 列表删除 | `EntryCard.remove`：`window.confirm("确定删除这条记录吗？")` 为 false 才 return。用户反馈取消后仍删除（移动端/内置浏览器上 `confirm` 不可靠）。测试目前 stub `confirm`。 |
| 详情删除 | `app/entries/[id]/page.tsx` 同一句 `window.confirm`。 |
| 照片删除 | `EntryPhotos.remove`：`window.confirm("确定删除这张照片吗？")`。 |
| 卡片操作 | 本人卡底部 `.entry-card-actions` 整行：`Link.secondary`「编辑」+ `button.danger`「删除」。 |
| 增加页 | `app/entries/new/page.tsx` 在 `EntryForm` 前渲染 `.page-intro`：`h1`「增加记录」、`p.muted`「收藏餐饮，也记下喜欢的物品。」 |
| 类型 | `EntryForm` 创建态：`fieldset` + `.choice` 原生 radio，文案「餐饮店 / 物品」。编辑态锁定为 pill。 |
| 菜系 | `CuisinePicker`：checkbox + `.choice`，`value: string[]`，图例「菜系（可多选）」。 |
| 地点 | `LocationField` 只写 `lat`/`lng`。定位成功文案「已获取当前位置…」，**不填地址**。`LocationPickerMap` 点击地图或 `dragend` 只回写坐标。地址是 `EntryForm` 里独立的「地址（选填）」输入。 |
| 编辑照片 | `EntryPhotos` 声明 `const pending: PickerPhoto[] = []`（常量空数组）传给 `PhotoPicker`。`addPending` 立刻 `revokePickerPreviews(next)` 再上传。相册选出的 blob 预览既不进 state，也被马上 revoke，所以编辑态看不到新选缩略图。创建态 `EntryForm` 自己持有 `photos` state，所以创建流是好的。 |
| 物品分类 | `CategoryPicker`：大类是 `<select id="category-root">`（单选）；切大类会 `setRootId` 并清空当前 `children` 列表，**不会**清掉已经选中的其它大类小类 id。小类是 checkbox，最多 20，底部「大类 / 小类 ×」chip 可移除。 |
| 价格 | `entries` 无价格列。`entryCreateSchema` / `Entry` / `createEntry` / `updateEntry` 均无 `price`。 |
| 确认框 | 仓库没有 Dialog / Modal 组件。 |
| 密钥 | Nominatim 无需 Key。现网 R2 / AI / Session 密钥保持只在 env。 |

## 4. 已确认决策（不再重开）

| 项 | 选择 |
| --- | --- |
| 打包方式 | **方案 A**：九项同一实现周期、同一发布，不拆成九个 PR 的产品范围（实现 PR 仍可按提交切分，但验收按本文件一次性对照）。 |
| 菜系 | **保持多选**（toggle 按钮，不是 radio）。 |
| 类型 | 互斥：餐饮 / 物品。 |
| 逆地理 | Nominatim（OSM），**服务端代理** `GET /api/geocode/reverse?lat=&lng=`，浏览器不直连 nominatim。无 API Key。 |
| 价格 | 可选，人民币元，允许小数（如 12.5），仅 `kind=item`。 |
| 删除 | 应用内确认框；取消/关闭/遮罩/Escape 都不删除。照片删除同样改。 |
| 视觉 | 沿用现网温暖食记：`--paper` / `--ink` / `--terracotta` / `--stamp` / `--danger`，微软雅黑优先；不引入新字体、不换主题。 |

## 5. UX 变更（按项）

### 5.1 封面圆点为正圆

**问题：** `.entry-cover-dot` 的 7×7 被全局 `button { min-height: 44px; padding: 10px 17px }` 盖过，画出来是竖条/椭圆。

**做法：** 圆点仍是 `<button type="button">`（保留 `aria-label="第 N 张"`、`aria-current`、点击 `scrollTo`），但视觉和命中区分开：

| 层 | 规格 |
| --- | --- |
| 视觉圆 | 约 **6px** 正圆（`border-radius: 50%` + `aspect-ratio: 1` + 等宽等高）。未选：半透明白 `rgba(255,255,255,0.55)`。当前张：`--terracotta` 实心、约 8px（比未选略大也略更醒目）。 |
| 命中 | 按钮本身用透明 padding 撑到至少 24px（封面底部空间有限，不必硬套全局 44px），`min-height`/`min-width`/`padding` 必须在 `.entry-cover-dot` 上全部覆盖全局 `button`。 |
| 画圆方式 | 推荐 `::after`（或内部 `span`）画圆，按钮背景透明，避免 `inline-flex + padding` 把圆拉扁。`flex: 0 0 auto`，`appearance: none`，`border: 0`，`overflow: visible`。 |

不改轨道、snap、无 autoplay、一张图仍不渲染圆点。样式只动 `app/globals.css` 的 `.entry-cover-dot` / `[aria-current="true"]`，必要时加 `::after`。

### 5.2 应用内删除确认

去掉所有删除路径上的 `window.confirm`。新建一个应用内对话框（见 §7），由卡片、详情、照片共用。

**记录删除（列表 `EntryCard`、详情页）：**

| 元素 | 文案 |
| --- | --- |
| 标题 | 删除记录 |
| 正文 | 确定删除这条记录吗？删除后无法恢复。 |
| 主操作（危险） | 删除 |
| 次操作 | 取消 |

**照片删除（`EntryPhotos`）：**

| 元素 | 文案 |
| --- | --- |
| 标题 | 删除照片 |
| 正文 | 确定删除这张照片吗？ |
| 主操作（危险） | 删除 |
| 次操作 | 取消 |

行为：

1. 点击卡片/详情/照片上的删除，**只打开对话框**，此时不发 `DELETE`。
2. 只有再点对话框里的「删除」才调用现有 `DELETE /api/entries/{id}` 或 `DELETE /api/photos/{id}`。
3. 「取消」、点遮罩、按 Escape、焦点移出后关闭 —— **全部视为 dismiss**，不删除、不进入 busy。
4. 打开对话框时初始焦点落在「取消」上，避免回车误删。
5. 确认后该条目删除按钮 / 对话框确认键进入 busy（「正在删除…」），防连点；失败时对话框可关，条目仍在，中文错误照旧显示在卡片/详情/照片错误区。
6. 列表删成功仍走现有 `onDeleted` → `nextListAfterDelete`；详情删成功仍 `router.push(source)`；照片删成功仍从 `photos` 去掉该 id。

列表测试今日 stub `window.confirm`。实现后改为：点「删除」出现对话框且无 fetch；点「取消」无 fetch；点对话框「删除」才 `DELETE`。

### 5.3 列表编辑 / 删除改到右下角图标

仅 **列表 `EntryCard`**。详情页继续用现有文字「编辑」「删除我的记录」，只换确认框，不改成图标。

本人卡片去掉全宽 `.entry-card-actions` 行，改为卡片内容下方、右对齐的两个小图标按钮：

```
┌─────────────────────────────┐
│ 封面轮播                     │
│ 名称                    评分 │
│ 餐饮  ·  地址                │
│ 菜系/分类/标签  ·  价格      │
│ 备注摘要                     │
│                   ✎   ⌫     │  ← 右下角
└─────────────────────────────┘
```

| 控件 | 语义 | 行为 |
| --- | --- | --- |
| 编辑图标 | `aria-label="编辑"`，`title="编辑"` | `Link` 到现有 `/entries/{id}/edit?from=…` |
| 删除图标 | `aria-label="删除"`，`title="删除"` | 打开 §5.2 确认框 |

视觉：

- 图标约 18–20px 描边，命中区域约 40×40px，不要再用全宽 `button.danger`。
- 默认颜色 `--muted` / `--ink`；悬停/焦点：编辑偏 `--terracotta`，删除偏 `--danger`，背景用浅 `--stamp` 或透明，圆角与卡片一致（约 10px）。
- 内联 SVG，不新增图标库。线宽和圆角跟食记卡片一致，不要做成系统 emoji 或彩色扁平大按钮。
- 他人卡片不渲染这组图标。busy 时删除图标 `disabled`，`aria-label` 改为「正在删除…」（测试可继续按 accessible name 找）。

键盘：Tab 能到两个图标；焦点环沿用全局 `:focus-visible`（terracotta）。

### 5.4 增加页去掉 intro

`app/entries/new/page.tsx` 删除整个 `.page-intro` 块（`h1`「增加记录」和副文「收藏餐饮，也记下喜欢的物品。」）。页面只渲染 `<EntryForm />`。

不补替代标题、不把这段字挪进表单顶部。位置靠 App Dock「增加」和表单第一项「记录类型」即可。站点 `metadata.title` 仍是「美食地图」，本轮不改。

编辑页 `app/entries/[id]/edit/page.tsx` 的「编辑记录」页头保持不动。

### 5.5 记录类型 + 菜系改为按钮式

**记录类型（仅创建态）：** 仍是互斥的 `place | item`，不要做成两个都能按下的 toggle。

- `fieldset` 图例保持「记录类型」。
- 两个等宽按钮：「餐饮」「物品」（不再用「餐饮店」，与列表 pill 对齐）。
- 选中：`--stamp` 底 + `--terracotta` 边/字，或实心 terracotta；未选：白底 + `--line` 边。
- 实现上保留原生 `input type="radio" name="kind"`（可 `sr-only`），可见部分是包着它的按钮外观 `label`，这样键盘方向键仍能切。
- 切换类型：餐饮显示菜系、物品显示分类+价格；坐标必填规则不变（place 必填，item 选填）。切走物品时价格只留在本地 state，提交 place 时不带 `price`。

编辑态类型锁定 pill 不变。

**菜系：** `CuisinePicker` 仍 `value: string[]`，仍可零个或多个。

- 图例保持「菜系（可多选）」。
- 每个菜系一颗切换按钮：点一下加入 id，再点去掉。不要 radio，不要下拉。
- 选中/未选视觉与类型按钮同一套 token，允许更小、可折行，不要做成整行大按钮。
- `onChange` 语义与今日 checkbox 相同：`checked ? [...value, id] : value.filter(...)`，去重上限仍 20（现有 `ids` schema）。

### 5.6 逆地理编码自动填地址

触发（仅这两类，避免按键抖动打爆 Nominatim）：

1. 「获取当前位置」**成功**拿到坐标之后。
2. 地图钉**落地**：`LocationPickerMap` 的地图 click，或 marker `dragend`（拖动过程中不请求）。

不触发：手改纬度/经度输入框、仅平移地图、仅缩放、定位失败、无坐标。

流程：

1. 先按现逻辑写回 `lat`/`lng`（表单立刻有点，place 可提交）。
2. `LocationField` 对有效坐标调用 `GET /api/geocode/reverse?lat=&lng=`（经现有 `requestJson`，带 Bearer）。
3. 若响应 `address_text` 为非空字符串：写入 `EntryForm` 的地址 state（覆盖当时地址栏内容，用户仍可再改）。截断至 300 字（与现有 `address_text` 上限一致）。
4. 若失败、超时、429、`address_text` 为 `null`：不改现有地址，不清坐标，不阻止保存。

状态文案（`LocationField` 现有 `role="status"`）：

| 时机 | 文案 |
| --- | --- |
| 正在定位 | 正在定位…（按钮已有） |
| 定位成功、正在查地址 | 正在查找地址… |
| 地址写入 | 已填入地址，可再修改 |
| 定位成功但地址失败 | 已定位，未能自动填入地址，可手动填写 |
| 定位失败 | 保持现有「无法获取定位…」 |

并发：新的一次定位/钉落地 abort 上一次 reverse 请求。地图连续 click 以最后一次为准。客户端对同一对坐标（四舍五入到 5 位小数）在本次页面生命周期内可复用上一次成功结果，避免 locate 后地图 `panTo` 若意外再触发时打两次。

`LocationField` 增加可选回调，由 `EntryForm` 写入地址：

```ts
onAddressResolved?: (addressText: string) => void;
```

地图组件仍只输出 `{ lat, lng }`。由 `LocationField` 区分「钉落地 / 定位成功」（走 reverse）和「手填经纬度」（不走 reverse），不要把 reverse 逻辑塞进 Leaflet 内部。

中国访问注意（实现时按此降级，不另接国内图商）：

- Nominatim 服务器多在境外，从国内 ECS 或用户网络可能慢、偶发超时或被干扰。超时 **8 秒** 后放弃。
- OSM 在中国地址覆盖不均匀，`display_name` 可能偏英文或粒度粗；用户手改地址是一等公民。
- 代理失败是预期路径，不是事故：表单必须仍可保存。
- 生产出网需放行 `https://nominatim.openstreetmap.org/`。本产品不为此加 Key、不改瓦片供应商。

### 5.7 编辑态相册预览

**根因：** `EntryPhotos` 把常量空数组当 `PhotoPicker` 的 `value`，并在 `addPending` 里立刻 `revokePickerPreviews`。`PhotoPicker` 的缩略图完全依赖受控 `value`，所以编辑/详情里新选的图不会出现。创建态 `EntryForm` 持有 `photos`，所以是好的。

**做法：** `EntryPhotos` 用 `useState<PickerPhoto[]>` 保存 pending。

1. `PhotoPicker` 的 `value={pending}`，`onChange` 更新 pending（保留 blob `previewUrl`）。
2. 出现新 `file` 后异步 `uploadEntryPhoto`；**不要**在选图当下 revoke。
3. 单张 confirm 成功：把它从 pending 去掉并 `URL.revokeObjectURL`，再 `onChange([...saved, photo])`。
4. 已保存照片仍按现列表渲染（含封面标记与删除）。pending 缩略图走 `PhotoPicker` 现有 thumbs（编辑态 `allowReorder={false}` 保持）。
5. `MAX_PHOTOS` 按 **已保存 + pending** 计算，满 3 禁用再选。`PhotoPicker` 增加可选 `existingCount`（默认 0）；`room = MAX_PHOTOS - existingCount - value.length`。编辑/详情传 `existingCount={photos.length}`，创建态保持 0。满员时 `disabled`。
6. 上传失败：已成功的保留；失败那张**留在 pending**（缩略图仍在），错误区显示现有中文错误，用户可点 pending 上的「删除」丢掉再重选。**不得**把失败当成已保存，也不得清掉其它已保存图。
7. `busy` 期间禁用再选，避免并行打乱 `nextPhotoSort`。
8. 创建态代码路径不改。

详情页与编辑页共用 `EntryPhotos`，两处预览一起好。

### 5.8 物品大类整行单选

**当前 `CategoryPicker`（必须保持的语义）：**

- 大类：一次只能看一个大类的小类列表（`rootId` 单值）。
- 小类：`value: string[]` 多选叶子，最多 20；应用层仍要求至少 1 个叶子才能保存物品。
- 切换大类：重新拉取该父级的 children；**不清空**已选的其它大类叶子（底部 chip 仍能显示并叉掉）。
- 空小类、加载中、失败重试文案保持。

**本轮 UI：**

- 大类：去掉 `<select>`。每个大类一个**整行**按钮，纵向排列，单选（radio 语义）。选中行 terracotta/stamp，未选描边。`aria-pressed` 或原生 radio + 全宽 label。
- 小类：保持多选。为了和菜系按钮语言一致，checkbox 可改成同一套小切换按钮，但**不得**变成单选。已选 chip「大类 / 小类 ×」保留。
- 图例保持「物品分类（至少选择一个小类）」；「大类」作为分组标题或 radio group 的 legend。

不要改 `/api/categories`，不要改 `assertLeafCategoryIds`。

### 5.9 物品可选价格

仅 `kind=item` 在 `EntryForm` 显示，放在分类选择之后、地点之前（或分类与地点之间，紧挨分类）。

| 元素 | 规格 |
| --- | --- |
| 标签 | 价格（选填，元） |
| 控件 | `input type="number"`，`step="0.01"`，`min="0"`，`inputMode="decimal"` |
| 占位 | 例如：12.5 |
| 后缀 | 输入旁静态「元」，不要货币下拉 |
| 空 | 不写、不存、不展示 |

展示（仅当 `price !== null`）：

- 列表卡：分类/标签行附近，文案 **「12.5 元」**（去掉无意义的尾随 0：`12` 显示「12 元」，`12.5` 显示「12.5 元」，`12.50` 也显示「12.5 元」）。
- 详情：名称/评分附近同样格式。
- 无价格：不渲染「未填写价格」，空白即可。
- 地图气泡、首页统计、AI 推荐：**不显示价格**。

餐饮表单不出现价格；若创建时先选物品填了价格再切回餐饮，提交体不含 `price`。编辑态类型锁定，物品编辑可改/可清空价格（空字符串 → 数据库 `NULL`）。

## 6. 数据模型

新列挂在现有 `public.entries`，**不新建表**。菜系仍是 `entry_cuisines` 多对多，**不改基数、不加 unique(entry_id)**。

文件：`supabase/migrations/007_entry_item_price.sql`（若 main 在实现前已有 `007_*`，序号顺延，不要改旧迁移）。

```sql
alter table public.entries
  add column price numeric(10,2);

alter table public.entries
  add constraint entries_price_nonnegative
  check (price is null or price >= 0);

alter table public.entries
  add constraint entries_price_item_only
  check (price is null or kind = 'item');
```

| 列 | 类型 | 含义 |
| --- | --- | --- |
| `price` | `numeric(10,2)` 可空 | 人民币元。`NULL` = 未填。`0` 是合法价格（免费/零元）。禁止负数。仅物品可非空。 |

已有行全部 `price IS NULL`。RLS 不因加列而改。`entrySelect` 已是 `*`，读路径会带上新列；TypeScript `Entry` 增加 `price: number | null`。

`createEntry` / `updateEntry`：

- `item`：写入 `price: parsed.price ?? null`（更新时空字段必须落到 `NULL`，不能留下旧价格）。
- `place`：插入/更新对象**不包含** `price`；更新餐饮时不要误把价格改掉（餐饮行本就应永远是 `NULL`）。

校验（`lib/validations/entry.ts`，只加在 `itemCreateSchema`）：

- 省略 / `null` / `""` → 视为未填（`undefined`，写入 NULL）。
- 数字或数字字符串：`>= 0` 且 `<= 999999.99`，小数最多两位（`12.5` 合法，`12.555` 拒绝）。
- `placeCreateSchema` 不声明 `price`；多传会被 discriminated union 丢掉，与今天丢掉 `categoryIds` 一样。

前端物品无小类仍先拦「请至少选择一个物品小类」。价格错误文案：「请输入有效价格（元，最多两位小数）」；后端 Zod 失败仍走现有「输入格式不正确，请检查填写内容」。

## 7. 组件

| 单元 | 文件 | 本轮职责 |
| --- | --- | --- |
| 圆点样式 | `app/globals.css` | 覆盖全局 `button` 对 `.entry-cover-dot` 的 min-size/padding；正圆；当前张略大/略亮。可新增图标工具条、确认框、类型/菜系/大类按钮、价格行的 class。 |
| 轮播 | `components/EntryCoverCarousel.tsx` | 结构可不变；若用 `::after` 则不必改 JSX。 |
| 卡片 | `components/EntryCard.tsx` | 右下角图标；确认框；有 `price` 则展示。删除仍 `onDeleted`。 |
| 确认框 | 新建 `components/ConfirmDialog.tsx` | 受控 `open`；标题/正文/取消/确认；遮罩与 Escape 关闭；初始焦点在取消；`role="dialog"` `aria-modal="true"`。无全局状态库。 |
| 详情 | `app/entries/[id]/page.tsx` | 同一确认框替换 `window.confirm`；有价格则展示。操作行文案不变。 |
| 增加页 | `app/entries/new/page.tsx` | 只留 `EntryForm`。 |
| 表单 | `components/EntryForm.tsx` | 类型按钮；把 `onAddressResolved` 传给地点；物品价格字段；提交带 `price`（仅 item）。 |
| 菜系 | `components/CuisinePicker.tsx` | 多选 toggle 按钮，API 不变。 |
| 分类 | `components/CategoryPicker.tsx` | 大类全宽单选按钮；小类仍多选。 |
| 地点 | `components/LocationField.tsx` | 定位成功与钉落地触发 reverse；状态文案；abort/去重。 |
| 选点地图 | `components/map/LocationPickerMap.tsx` | 仍只回写坐标。不要在这里 fetch。`LocationField` 包装其 `onChange` 即可（click/`dragend` 已经是「钉落地」）。 |
| 照片 | `components/EntryPhotos.tsx` | pending state + 确认框删图。 |
| 选图 | `components/PhotoPicker.tsx` | 创建流 `existingCount` 默认 0，行为不变；编辑流受控 `value` 显示缩略图，并用 `existingCount` 限制总数。 |
| 类型 | `lib/entries.ts` | `Entry.price`；create/update 写列。 |
| 校验 | `lib/validations/entry.ts` | item `price`。 |
| 代理 | 新建 `app/api/geocode/reverse/route.ts` + `lib/geocode/nominatim.ts` | 见 §8。 |
| 迁移 | `supabase/migrations/007_entry_item_price.sql` | 见 §6。 |
| 展示 | 新建小函数（如 `lib/format-price.ts`） | 「12.5 元」格式，卡片/详情共用。 |

`FoodCard`、legacy foods、地图气泡、Dock、viewport **不改**。

确认框最小 API（实现可微调属性名，行为必须一致）：

```ts
type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string; // 删除
  cancelLabel?: string; // 默认「取消」
  busy?: boolean;
  onConfirm: () => void;
  onDismiss: () => void;
};
```

`onDismiss` 不得调用传入的删除函数。确认键 `class="danger"`，取消键 `class="secondary"`。`prefers-reduced-motion: reduce` 时不要滑入动画。

## 8. API：逆地理编码

### 8.1 `GET /api/geocode/reverse?lat=&lng=`

新 Route Handler，`dynamic = "force-dynamic"`。浏览器只打本站，不直连 OSM。

**鉴权：** `requireUser`。未登录 401「请先登录」。这是给已登录登记页用的，不是开放代理。

**Query：**

| 参数 | 规则 |
| --- | --- |
| `lat` | 必填，数字，-90–90 |
| `lng` | 必填，数字，-180–180（本站用 `lng`；转发 Nominatim 时改名为 `lon`） |

非法或缺失：400「请提供有效的经纬度」。

**上游：** `https://nominatim.openstreetmap.org/reverse`

| Nominatim 参数 | 值 |
| --- | --- |
| `lat` / `lon` | 用户坐标 |
| `format` | `jsonv2` |
| `accept-language` | `zh-CN` |
| `zoom` | `18` |
| `addressdetails` | `0`（本轮只用 `display_name`） |

请求头（Nominatim 使用政策要求可识别的 UA，禁止空 UA / 伪造浏览器 UA）：

```
User-Agent: food-notes/1.0 (https://food.nerosun.cn; reverse-geocode)
Accept: application/json
```

不把用户的 `Authorization` 转给 Nominatim。不把完整上游 JSON 回给浏览器。

超时：`AbortSignal` **8 秒**。进程内串行：两次 Nominatim 请求间隔至少 **1 秒**（官方 1 req/s）。若等待 1 秒会撑破这次请求的截止时间，直接 429，不要偷偷重试多次。

**成功 200：**

```ts
{ address_text: string | null }
```

- `display_name` 有值：trim，空白压成单空格，截到 300 字，作为 `address_text`。
- 无 `display_name` 或空：`address_text: null`。客户端**不覆盖**现有地址，不当成硬错误。

**错误形状：** 一律现有 `{ error: string }` + `apiError` / `privateJson`，`Cache-Control: private, no-store`。

| HTTP | `error` | 何时 |
| --- | --- | --- |
| 401 | 请先登录 | 无/无效 Bearer |
| 400 | 请提供有效的经纬度 | 缺参或范围非法 |
| 429 | 地址查询过于频繁，请稍后再试 | 本进程排队来不及，或上游 429 |
| 504 | 查找地址超时，可稍后重试或手动填写 | 8 秒 abort |
| 502 | 暂时无法解析地址 | 上游 5xx、非 JSON、网络错误 |
| 500 | 服务暂时不可用，请稍后重试或联系管理员 | 其它未知（走 `apiError`） |

客户端对这些错误只更新 `LocationField` 状态文案，**不**写入 `EntryForm` 的 `error`（避免挡住保存）。保存仍只校验名称、评分、place 坐标、item 小类等现有规则。

不新增环境变量。User-Agent 写死为上面的产品标识，不把联系邮箱或密钥放进仓库。

### 8.2 其它 API

| 接口 | 变化 |
| --- | --- |
| `POST /api/entries`、`PUT /api/entries/[id]` | item body 可含 `price`；place 忽略。校验见 §6。 |
| `GET /api/entries`、`nearby`、`GET /api/entries/[id]` | `entry.price` 随 `*` 出现；客户端按 null 处理旧缓存即可。 |
| `GET /api/entries/map` | **不**为气泡加价格。 |
| 照片 / 菜系 / 分类 / 鉴权 | 不变。 |
| `/api/foods/*` | 不改。 |

## 9. 鉴权与密钥

| 操作 | 谁 | 失败 |
| --- | --- | --- |
| reverse geocode | 任一登录用户 | 401 |
| 写价格 | 仅随本人 create/update | 与现有 401/403 相同 |
| 删记录/照片 | 仅本人（服务端已校验） | 403；确认框不是安全边界 |

Nominatim 无 Key。R2 / AI / `SESSION_SECRET` / Supabase 仍只存在 env，本轮不新增、不打印。

## 10. 边界情况

| 场景 | 期望 |
| --- | --- |
| 全局 button 样式以后再改 | `.entry-cover-dot` 自己写死宽高、min-size、padding，不依赖「全局刚好不撑开」。 |
| 确认框打开时误点卡片其它区域 | 遮罩吃掉点击；关闭 = dismiss。 |
| 移动端原先 `confirm` 取消仍删除 | 不再调用 `window.confirm`；以对话框按钮为准。 |
| 删除确认后接口 403/网络失败 | 卡还在，中文错误，图标恢复可点。 |
| 逆地理超时/429/502 | 坐标保留，地址不动，表单可存。 |
| 逆地理成功但用户已改过地址 | 钉落地/定位成功**会覆盖**地址栏（产品选择：新点对应新地址）。随后仍可手改。手填经纬度不覆盖。 |
| 无网选点 | 钉仍可放；reverse 失败走「未能自动填入地址」。 |
| 编辑选图后上传失败 | 缩略图曾出现；失败张不进已保存；其它已保存不动；错误区中文；可删 pending 重选。 |
| 编辑已有 2 张，再选 2 张 | 只接受 1 张（总数 3）；与 `PhotoPicker` 现有 `room` 逻辑一致，分母改为 saved+pending。 |
| 物品价格 `0` | 合法，展示「0 元」。 |
| 物品价格清空后保存 | 写 `NULL`，列表/详情不再显示价格。 |
| 餐饮记录的 `price` 列 | 保持 NULL；表单无字段；即使有人改 DOM 提交也会被 schema 丢掉，CHECK 约束兜底。 |
| 切大类 | 只换正在浏览的小类列表；已选其它大类叶子仍在 `value` 里，可用 chip 去掉。 |
| 增加页无 h1 | 可接受；不要为了补偿再加 intro。 |
| `prefers-reduced-motion` | 确认框不要位移动画；轮播 `scroll-behavior: smooth` 可保持（用户主动点圆点）。 |

## 11. 测试要点

现有必须继续绿：`tests/components/entry-cover-carousel.test.ts`、`entry-card-actions.test.ts`、`entries-list-delete.test.ts`、`entry-form-edit.test.ts`、`photo-picker.test.ts`、`location-field-picker.test.ts`、`tests/validations/entry.test.ts`、`tests/entries/data.test.ts`、`tests/api/entries.test.ts`。

新增/改写：

- **圆点 CSS：** 断言 `.entry-cover-dot` 规则含正圆所需覆盖（`min-height`/`min-width`/`padding` 不再沿用 44px/10px 17px）。组件测试仍：0 张无轨道、1 张无点、2 张有点、点击「第 2 张」会 `scrollTo`。
- **确认框：** 点删除 → 对话框可见且 `fetch` 未调用；点取消/Escape → 仍无 fetch、无 `onDeleted`；点「删除」→ `DELETE` 且 busy。详情与照片各一条。测试中**不要**再 stub `window.confirm` 作为主路径。
- **图标：** 本人卡有 `aria-label`「编辑」「删除」；他人卡没有。编辑 `href` 仍带 `from`。
- **增加页：** `/entries/new` 源码或不渲染「增加记录」「收藏餐饮」。
- **类型/菜系：** 创建态两个 radio「餐饮」「物品」互斥；菜系多选：点两个名称后 `value` 长度为 2，再点取消其中一个。
- **大类：** 不是 `select#category-root`；每个大根是按钮/radio；小类仍可多选。
- **价格 schema：** item 接受 `12.5`、`0`、省略；拒绝 `-1`、`12.555`、`10000000`；place 带 `price` 解析后无该字段。`updateEntry` 对 item 写入 `price`，对 place 的 update 对象无 `price`。
- **价格展示：** `formatPrice(12.5) === "12.5 元"`，`formatPrice(12) === "12 元"`；`null` 不渲染。
- **reverse 路由：** 未登录 401；坏坐标 400；mock 上游成功返回截断后的 `address_text`；上游超时 → 504 且客户端不改地址；定位成功会请求 `/api/geocode/reverse`；手改 lat 输入不请求。
- **编辑照片：** `EntryPhotos` 在 mock `uploadEntryPhoto` 未完成前就能在 DOM 里看到 blob 缩略图；成功后进入已保存 `img[src=public_url]`；失败时已保存列表不变并有 alert。
- **Nominatim helper：** 断言 fetch URL 使用 `lon`（不是 `lng`）、UA 含 `food-notes` 与 `food.nerosun.cn`、不带 Authorization。

不强制：真连 Nominatim E2E、真机捏合、真 R2。实现后用浏览器过一遍：圆点形状、取消删除、图标进编辑、增加页无 intro、菜系多选、定位填地址、编辑选图缩略图、大类整行、物品价格保存回显。

## 12. 发布

1. 本文件所在 PR **只含设计文档**。
2. 后续实现 PR 合入 `main` 后按现网流程部署 ECS。
3. 实现 PR 须执行 `007_entry_item_price.sql`（或顺延序号）。无新密钥、无需改 R2 CORS。
4. 出网：ECS 需能访问 `nominatim.openstreetmap.org`。若被墙或长期超时，表现是「未能自动填入地址」，登记仍可用。
5. 回滚：撤应用发布则 UI/代理消失；价格列可留（可空，旧代码不读也可）。不要在紧急回滚里 drop column，除非明确要清数据。

## 13. 范围外（点到为止）

- 高德 / 腾讯 / Mapbox / 国内逆地理商、Nominatim Key、浏览器直连 OSM geocode。
- 封面重排、详情「设为封面」、照片 `sort` PATCH。
- 短信实发、改密、公开注册。
- 餐饮价格、多币种、外币。
- 菜系单选、物品小类单选、大类多选。
- 轮播自动播放、独立 `/map`、路线/热力。
- 增加页以外的文案大改（含编辑页 intro）。
- 本设计 PR 中的任何功能代码。
