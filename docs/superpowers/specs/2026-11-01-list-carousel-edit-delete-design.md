# 列表封面轮播 + 本人编辑删除 — 设计说明

**日期：** 2026-11-01（Asia/Shanghai）  
**状态：** 已与 Nero 确认产品方向，待实现计划  
**仓库：** CoderSxy/food-notes  
**前置：** `docs/superpowers/specs/2026-11-01-r2-photos-design.md`（`entry_photos`、封面 `sort===0`、详情本人删图）  
**部署目标：** 合并后部署 ECS，生产域 `food.nerosun.cn`

三条相关 UX 修复合并为一份设计，一次实现、一次发布。

## 1. 目标

1. **禁止移动端网页捏合缩放。** 根布局导出 Next.js `viewport`，`maximumScale: 1`、`userScalable: false`，移动 Safari / Chrome 不能 pinch-zoom；桌面滚轮/快捷键缩放不受影响。
2. **列表卡片封面改为手动横滑轮播。** 无自动播放；从封面图起滑；圆点指示当前张；横滑只换图，点标题/正文仍进详情。
3. **本人记录在列表可编辑、删除。** 本人卡片显示「编辑」「删除」；删除走现有 `DELETE` 并尽量不整页刷新；编辑进入 `/entries/[id]/edit`，复用 `EntryForm`，类型锁定，保存后回到列表。

成功标准：

- 手机打开任意已登录页，双指捏合不能放大整页。
- 有 2–3 张图的卡片能横滑换图，圆点跟随；1 张或 0 张行为与现网一致（单图或无封面区）。
- 「全部」范围下只在自己的卡片上看到编辑/删除；删后卡片消失；编辑保存后落回原来的列表筛选。

## 2. 非目标

- 不引入 Swiper / embla / 其它轮播库（`package.json` 当前无此类依赖）。
- 不做自动播放、循环广告式轮播、封面视频。
- 不做照片「设为封面」/重排序 **API**（创建页 `PhotoPicker` 本地「设为封面」可保持；详情/编辑页现有 `EntryPhotos` 仍无调序）。后续单独设计。
- 编辑时不允许把餐饮 `place` 改成物品 `item`，或反向。
- 不改地图气泡：继续只用 `cover_photo_url`。
- 不新增表、不写 migration、不加环境变量。
- 不改 legacy `/api/foods/*` 写路径；本轮只扩展 `entries`。

## 3. 现状

| 点 | 现状 |
| --- | --- |
| 缩放 | `app/layout.tsx` 只导出 `metadata`，无 `viewport`。移动浏览器可捏合放大。 |
| 列表封面 | `EntryCard` 仅在有 `cover_photo_url` 时渲染单张 `<img>`。标题是 `Link`，封面本身不是链接。 |
| 列表数据 | `listEntryPage` / `nearbyPlaceEntries` 调用 `attachPhotos`（默认不加 `photos`），只带 `cover_photo_url`。`getEntry` 才 `{ full: true }` 带完整 `photos[]`。 |
| 地图 | `listMapPoints` → `attachCoverUrls`，气泡只用封面。 |
| 删除 | `DELETE /api/entries/[id]` 已存在：登录 + 本人；cascade 库行并尽力删 R2。详情页有「删除我的记录」+ `confirm`。列表没有。 |
| 更新 | **没有** `updateEntry`，`/api/entries/[id]` 无 `PUT`/`PATCH`。`lib/validations/entry.ts` 只有 `entryCreateSchema` / `EntryCreate`。 |
| 表单 | `EntryForm` 仅创建：可选类型、`POST /api/entries`，成功后带 `from`/`safeNext` 进详情。 |
| 照片 | 创建用 `PhotoPicker` 保存后再 `uploadEntryPhoto`；详情用 `EntryPhotos`（即时 `presign`/`confirm`/`DELETE /api/photos/[id]`）。 |
| 当前用户 | `AppShell` 已包 `AuthProvider`；`useAuth().user.userId` 可用。详情页另打 `/api/auth/me`。 |
| 导航 | `AppDock`：`/entries/*` 且不是 `/entries/new` 高亮「记录」。新编辑路由会自动落在「记录」，不必改 Dock。 |

## 4. 方案选择

### 4.1 禁止缩放

采用 Next.js 15 根布局 `export const viewport`（不要手写 `<meta name="viewport">`，以免和框架生成标签打架）。

```ts
import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};
```

放在 `app/layout.tsx`，与现有 `metadata` 并列。全站生效，含登录页。

**可访问性取舍（仍按产品要求做）：** iOS Safari 上 `user-scalable=no` / `maximum-scale=1` 会阻止依赖捏合放大的低视力用户放大页面。本产品文案以中文为主、字号已按改版方案加大，产品明确要求禁缩放。实现时在代码旁用一句注释标出该取舍，不另做「仅部分路由禁缩放」。桌面端 Chrome/Firefox 的 Ctrl+滚轮 / 快捷键缩放不走该 meta，保持不变。

### 4.2 列表轮播数据

**推荐：扩展 `attachPhotos`，列表带薄 `photos`。**

| 方案 | 做法 | 取舍 |
| --- | --- | --- |
| **A（采用）** | `attachPhotos` 增加 `mode: "cover" \| "thin" \| "full"`。列表/附近用 `"thin"`：`photos: { id, public_url, sort }[]`，仍保留 `cover_photo_url`。 | 卡片有稳定 `id` 做 key；不把 `r2_key` 泄漏到「全部」列表。 |
| B | 只加 `photo_urls: string[]`（封面优先）。 | 更瘦，但圆点/滑动缺少稳定 key，且与详情 `photos` 形状不一致。 |
| C | 列表也 `full: true` 整份 `EntryPhoto`。 | 实现最少，但 `r2_key` 出现在他人可见的列表响应里，不采用。 |

默认（不传）保持今天的 `"cover"`，避免地图与其它调用方多带照片。`listMapPoints` / `attachCoverUrls` **不改**。

排序约定（与 `coverUrlFromPhotos` 一致）：

1. `photos` 按 `sort` 升序。
2. 轮播初始张 = `sort === 0` 的那张；若无（封面已删、只剩 1/2），取排序后第一张。按 `sort` 升序后即数组下标 `0`。
3. `cover_photo_url` 继续等于该初始张的 `public_url`，供旧测试与地图使用。

`Entry` 类型已有可选 `photos?: EntryPhoto[]`。薄列表用：

```ts
export type EntryPhotoThumb = Pick<EntryPhoto, "id" | "public_url" | "sort">;
```

列表响应的 `photos` 为 `EntryPhotoThumb[]`。客户端把它们当只读展示即可，不必当完整 `EntryPhoto`。

### 4.3 更新动词

**采用 `PUT /api/entries/[id]`**（整份可写字段替换，不含照片、不含 `kind` 变更）。

表单提交的是完整可写字段集，与创建体同形；`PATCH` 部分合并没有产品需求。照片继续走独立照片 API，不进 PUT body。

## 5. 建议 UX

### 5.1 列表封面轮播

无图：不渲染封面区（与现网相同）。

有图：把 `.entry-cover` 换成横向 snap 轨道：

- 容器：`overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;` 一张一屏宽，`scroll-snap-align: start`。
- **无 autoplay、无 timer、无循环克隆。**
- 建议隐藏滚动条（仍可滑）。
- `photos.length > 1` 时在封面底部叠圆点；当前张 `aria-current="true"`。圆点可点，点击 `scrollTo` 对应张（键盘与细滑定位）。
- 用 `scroll` 事件按 `scrollLeft / clientWidth` 四舍五入更新当前下标；`scroll-snap` 停稳后圆点与图对齐。
- 封面区**不是**链接，避免滑动手势误进详情。标题 `Link` 不变；备注、菜系/分类/标签、地址保持现状（非整卡可点）。
- 横滑只应换图：封面区 `touch-action: pan-x`；卡片其它区域保持页面纵向滚动。
- 图片 `alt`：第一张「封面照片」，其余可空（与详情 `EntryPhotos` 一致），避免每张都把店名读一遍。

不把整张 `article` 改成链接。现网本来就只有标题可点，本轮保持，从而自然避开「滑封面却跳详情」。

### 5.2 列表：编辑 / 删除

当 `entry.user_id === currentUserId`（`useAuth().user.userId`）时，在卡片底部（备注下方）显示两个操作：

| 控件 | 文案 | 行为 |
| --- | --- | --- |
| 次要按钮 / `Link` | 编辑 | 去 `/entries/{id}/edit?from={encodeURIComponent(source)}`，`source` 即现有列表回链（含 scope/kind/q/page）。 |
| 危险按钮 | 删除 | `window.confirm("确定删除这条记录吗？")`（与详情同一句）→ `DELETE /api/entries/{id}` → 成功后从当前 `data.entries` 去掉该卡，`total -= 1`。 |

他人卡片（含「全部」里别人的记录）不渲染这两个按钮。未登录进不了列表（`AppShell` 已拦）。

删除后尽量不整页刷新：

- 成功：本地更新 `data`，按钮恢复可点。
- 失败：卡片留着，在列表顶部或该卡内显示接口中文错误。
- 若当前页删空且 `page > 1`：用现有 `change({ page: String(page - 1) })` 回上一页（会重拉该页，可接受）。
- 附近模式同样本地移除，无分页则不必改 URL。

删除过程中该卡「删除」`disabled`，文案「正在删除…」，避免连点。

### 5.3 编辑页 `/entries/[id]/edit`

新客户端页，结构贴近 `/entries/new`：

- 页头：「编辑记录」；辅文按 `kind`：「修改这条餐饮。」 / 「修改这件物品。」
- 拉取 `GET /api/entries/{id}` 预填；非本人不要依赖前端藏按钮——服务端 PUT 会 403；GET 今日任何登录用户可读，编辑页加载后若 `entry.user_id !== me` 显示「只能编辑自己的记录」并停用表单（可不自动跳走）。
- 复用 `EntryForm`，增加编辑模式（见 §6）。
- **类型锁定：** 「记录类型」改为只读展示（`pill`：餐饮 / 物品），不渲染可点 radio。不能靠改 DOM 改类型——PUT 再拒一次。
- 字段：名称、评分、备注、地址、lat/lng、菜系或分类、标签——校验与创建相同（`place` 坐标必填，`item` 至少一小类）。
- 照片：编辑态挂现成 `EntryPhotos`（与详情相同：即时增删，最多 3）。不要走创建态「先攒本地再随保存上传」——记录已有 `id`。本轮不做调序/设为封面。
- 主按钮：「保存修改」/ 「正在保存…」。
- 保存成功：`router.push(safeNext(from || "/entries?scope=mine"))`，**回到列表**（创建成功仍去详情，不改）。
- `from` 必须经 `safeNext`，规则与创建/详情返回相同。
- 次要：「取消」链回 `from`（同样 `safeNext`）。

### 5.4 详情（建议一并做）

详情已有本人删除，保留文案与 `confirm`。在删除按钮旁加「编辑」链到 `/entries/{id}/edit?from={source}`。不改删除逻辑。

## 6. UI 组件

| 单元 | 文件 | 职责 |
| --- | --- | --- |
| `viewport` | `app/layout.tsx` | 导出 §4.1 的 `Viewport`。 |
| `EntryCoverCarousel` | 新建 `components/EntryCoverCarousel.tsx` | 纯展示：接收 `photos: EntryPhotoThumb[]`，snap 横滑 + 圆点 + 当前下标。无路由、无删除。 |
| `EntryCard` | `components/EntryCard.tsx` | 封面改走 carousel（无图则跳过）；可选 `currentUserId` 或内部 `useAuth()`。推荐 **卡片内 `useAuth()`**，列表/附近不必再往下传。本人显示编辑/删除；删除通过 `onDeleted(id)` 通知父级。 |
| 列表 | `app/entries/page.tsx` | `onDeleted` 里改本地 `data`；不必为轮播改筛选。 |
| 编辑页 | 新建 `app/entries/[id]/edit/page.tsx` | 读 `id`，渲染编辑态 `EntryForm`。 |
| `EntryForm` | `components/EntryForm.tsx` | `mode?: "create" \| "edit"`（默认 `create`），`entry?: Entry`。编辑态：预填、锁定 `kind`、照片用 `EntryPhotos`、`PUT`、成功回列表。 |
| 详情 | `app/entries/[id]/page.tsx` | 本人增加编辑链接。 |
| 样式 | `app/globals.css` | `.entry-cover` 改为轨道；新增 snap 子项、圆点、卡片操作行。保持 16:9。 |

`FoodCard` / legacy foods 页不改。

`EntryForm` 编辑预填：

- `kind`、`name`、`note`、`rating`、`address_text`
- `lat`/`lng` 转成 `LocationField` 的字符串（无坐标则空）
- `cuisineIds` / `categoryIds` 来自 `entry.cuisines` / `entry.categories`
- `tags` 来自 `entry.tags[].name`

创建态代码路径保持：`PhotoPicker` → `POST` → 逐张上传 → 去详情。

## 7. 数据与 API

### 7.1 `attachPhotos`

```ts
export async function attachPhotos<T extends Entry>(
  entries: T[],
  opts?: { mode?: "cover" | "thin" | "full" },
): Promise<T[]>;
```

兼容：继续接受现有 `{ full: true }`，等价于 `mode: "full"`（`getEntry` 与现有测试不用改调用写法）。新代码优先写 `mode`。行为：

| mode | `cover_photo_url` | `photos` |
| --- | --- | --- |
| `cover`（默认） | 有 | 不挂 |
| `thin` | 有 | `{ id, public_url, sort }[]`，按 sort 升序 |
| `full` | 有 | 完整 `EntryPhoto[]`（详情/删除 R2 仍需要 `r2_key`） |

调用点：

- `listEntryPage`、`nearbyPlaceEntries` → `thin`
- `getEntry` → `full`
- `listEntries`（legacy 最新 100）→ **thin**（与分页列表同一形状，避免日后复用时缺图）。
- `listMapPoints` 继续 `attachCoverUrls`，不进 `photos`

查询已是按 `entry_id` chunk，本轮不改 SQL，只在组装时投影字段。每页 20 × 最多 3 张，体积可接受。

### 7.2 `PUT /api/entries/[id]`

文件：`app/api/entries/[id]/route.ts` 新增 `PUT`。

1. `requireUser`；未登录 401「请先登录」。
2. `id` 必须是 UUID，否则走现有 `apiError`。
3. `getEntry(id)`：无则 404「记录不存在」。
4. `entry.user_id !== user.userId` → 403「只能编辑自己的记录」（与删除「只能删除自己的记录」对称）。
5. Body 用 **同一套创建校验**，再冻结类型：
   - 复用 `entryCreateSchema`（`EntryCreate`）。
   - 解析成功后若 `parsed.kind !== entry.kind` → 400「不能更改记录类型」。
   - 客户端编辑态不提交可改的 `kind` 也可：实现时可先把现存 `kind` 写入 body 再 parse，使 UI 省略 `kind` 字段。**以服务端现存 `kind` 为准，请求里的 `kind` 只能相同或省略。**
6. `updateEntry(userId, id, parsed)`，`privateJson({ entry })`。建议 200（替换已有资源，不是 201）。

`updateEntry` 放在 `lib/entries.ts`（与 `createEntry` 并列）：

- `item`：`assertLeafCategoryIds(parsed.categoryIds)`。
- `update` 行：`name, note, rating, lat, lng, address_text, updated_at: now`。不改 `user_id`、`kind`、`created_at`。
- 关联 **整表替换**：删该 entry 的 `entry_cuisines` / `entry_categories` / `entry_tags`，再按 `kind` 插入（place 写菜系、item 写分类；标签 upsert `tags` 后挂 `entry_tags`，与 `createEntry` 相同）。
- 不碰 `entry_photos`。
- 返回 `getEntry(id)`。
- 关联写入失败应抛错；不必像创建那样删主行。实现时可用尽量小的顺序（先更主行再换关联）；失败时主行可能已更新、关联旧——可接受，重试保存即可。不为本轮加事务中间件。

校验复用：

```ts
// lib/validations/entry.ts
export const entryCreateSchema = /* 已有 */;
export type EntryCreate = z.infer<typeof entryCreateSchema>;
export type EntryUpdate = EntryCreate; // 同形；kind 不可变由 updateEntry / PUT 强制
```

不要另写一套放宽/收紧规则。`place` 仍要坐标，`item` 仍要 ≥1 小类。

### 7.3 不变的 API

- `DELETE /api/entries/[id]`：列表与详情共用。
- `GET /api/entries/[id]`：编辑页预填。
- `POST /api/photos/presign`、`POST /api/photos/confirm`、`DELETE /api/photos/[id]`：编辑页 `EntryPhotos` 原样使用。
- `GET /api/entries`、`GET /api/entries/nearby`：响应多可选 `photos`，旧字段保留。
- `GET /api/entries/map`：仍只有 `cover_photo_url`。

## 8. 鉴权与归属

| 操作 | 谁能做 | 失败 |
| --- | --- | --- |
| 看列表/详情/图 | 任一登录用户（与现网可见性相同） | 401 |
| 列表上显示编辑/删除 | 仅 `entry.user_id === 当前用户`（前端） | 不展示 |
| `PUT` / `DELETE` | 仅本人（服务端再判） | 403 |
| 改 `kind` | 无人 | 400 |
| 改他人记录 | 无人 | 403 |
| 编辑页增删照片 | 现有照片 API：仅主人 | 403 |

前端藏按钮不是安全边界。`scope=all` 只扩大可见范围，不扩大写权限（与改版方案 §6 一致）。

## 9. 错误处理

| 场景 | 用户看到 |
| --- | --- |
| 列表删除失败 | 卡还在；中文错误（网络或 403/404） |
| 删除未确认 | `confirm` 点取消则什么都不做 |
| 编辑加载 404 | 「记录不存在」 |
| 编辑加载后发现非本人 | 「只能编辑自己的记录」，表单禁用 |
| 保存校验失败 | 沿用创建：前端先拦（物品无小类「请至少选择一个物品小类」），后端 400 |
| 试图改 kind | 400「不能更改记录类型」 |
| 照片增删失败 | `EntryPhotos` 现有错误区；**不阻止**字段 PUT |
| 字段已保存、照片半失败 | 编辑态照片是即时的，与 PUT 解耦；按单张错误提示即可 |
| R2 未配置 | `EntryPhotos` / `PhotoPicker` 已有「图片存储未配置」路径，不另做 |

文案用中文，与现网 `HttpError` 风格一致，不新造英文 toast。

## 10. 测试要点

现有测试必须继续绿：`tests/photos/attach.test.ts`、`tests/api/entries.test.ts`、`tests/components/rating-display.test.ts`（单封面图）、`tests/validations/entry.test.ts`。

新增/扩展：

- **viewport：** `app/layout.tsx` 导出的对象含 `maximumScale: 1`、`userScalable: false`、`width: "device-width"`。
- **`attachPhotos`：** `mode: "thin"` 只含 `id`/`public_url`/`sort`，无 `r2_key`；顺序按 sort；无 `sort===0` 时 `cover_photo_url` 仍为排序后第一张。`mode: "cover"` 不挂 `photos`。地图用例仍只断言 `cover_photo_url`。
- **Carousel：** 0 张不渲染轨道；1 张有图无点；2+ 张有点且默认第一张（封面）。无 timer。点击标题仍是详情 `href`（可用现有 `source` 查询）。
- **卡片操作：** `user_id === 当前用户` 有「编辑」「删除」；否则无。删除取消不发请求；确认后 `DELETE`；父级列表去掉该 id。
- **PUT：** 未登录 401；他人 403；不存在 404；`kind` 不一致 400；合法 place/item 更新调用 `updateEntry`。
- **`updateEntry` / schema：** 复用创建规则（坐标、小类、半星、标签归一）；不改 `kind`。
- **`EntryForm` 编辑：** 预填名称/评分/`kind` 只读；提交 `PUT` 而非 `POST`；成功跳到 `safeNext(from)`。
- **Dock（可选）：** `/entries/{id}/edit` 仍高亮「记录」——现逻辑已覆盖，不必新测除非改了 `AppDock`。

本轮不强制真机捏合或真连 R2 E2E。实现后应用浏览器走一遍：列表滑图、本人删卡、编辑保存回列表、他人卡无按钮。

## 11. 发布

1. 实现 PR 合入 `main`（本文件所在 PR **只含设计文档**，不含功能代码）。
2. 按现网流程部署 ECS 上的 food-notes。
3. 生产：`https://food.nerosun.cn` — 手机禁缩放、列表轮播、本人编辑删除。
4. 无需 migration、无需新密钥、无需改 R2 CORS。
5. 回滚：撤该发布即可；无数据形态变更。已用新 PUT 改过的行就是普通字段更新。

## 12. 后续（点到为止，不设计）

- 详情/编辑「设为封面」与拖拽调序，以及对应 `PATCH` 照片 `sort` API。
- 轮播自动播放。
- 编辑时转换 place ↔ item（需要拆关联并补坐标/分类，产品已排除）。
- 列表封面点击进详情（若以后要整卡可点，必须把手势和点击拆开）。
