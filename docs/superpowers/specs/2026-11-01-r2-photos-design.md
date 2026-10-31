# food-notes 可选照片上传（Cloudflare R2）设计说明

日期：2026-11-01（Asia/Shanghai）
状态：已与 Nero 确认方向，待实现计划

## 背景

`CoderSxy/food-notes` 的餐饮（place）与物品（item）登记目前只有文字、评分、标签/分类与坐标，没有图片。Nero 希望登记时可选拍照或选图，客户端合理压缩后存到 Cloudflare R2（免费额度），并在列表、详情、地图气泡展示。

## 已确认需求

- 每条登记最多 **3** 张，可不传。
- 展示：列表缩略图 + 详情页 + 地图气泡（封面图）。
- 选图：相册 + 现场拍照 + 粘贴截图。
- 压缩目标：单张约 **1MB**（硬顶约 1.2MB）。
- 保存后本人可增删换（仍 ≤3）。
- 可见性：登录用户可看他人图（与现有登记一致）。

## 方案选择

采用 **方案 A：浏览器压缩 + R2 预签名 PUT 直传**。

不采用 B（服务端收图再压）：ECS 内存紧张且带宽经服务器。
不采用 C（Cloudflare Images）：额外产品与费用，本轮不需要。

## 架构

1. 客户端选图 → Canvas 压成 WebP（不支持则 JPEG），长边约 2048，目标约 1MB。
2. `POST /api/photos/presign` 鉴权并签发短时预签名 PUT。
3. 浏览器直传 R2。
4. `POST /api/photos/confirm` 写入 `entry_photos`。
5. 读路径用公开 URL（自定义域名或 `R2_PUBLIC_BASE_URL`）；写路径仅预签名 + 本人校验。
6. 服务端不经手文件字节。

对象键：`entries/{userId}/{entryId}/{photoId}.webp`（或 `.jpg`）。

## 数据模型

新表 `public.entry_photos`：

| 列 | 说明 |
| --- | --- |
| id | uuid PK |
| entry_id | FK → entries，on delete cascade |
| user_id | FK → users（冗余便于鉴权） |
| r2_key | text，桶内对象键 |
| public_url | text，可读 URL |
| sort | int 0–2，0 为封面 |
| width / height / bytes | 可选元数据 |
| content_type | text |
| created_at | timestamptz |

约束：同一 `entry_id` 最多 3 行（应用层校验 + 可选 DB 约束）。
列表与地图 API 附带 `cover_photo_url`（sort=0）；详情附带 `photos[]`。

## 上传与交互

- 登记表单增加「照片（可选，最多 3）」：相册、`capture` 拍照、粘贴。
- 缩略图可删、可调顺序（第一张封面）。
- 建议顺序：先保存登记正文 → 再压缩并直传 → confirm；单张失败可重试。
- 详情：本人增删换；`DELETE /api/photos/[id]` 删库并尽力删 R2。
- 无图时列表/地图保持现状。

## API

### `POST /api/photos/presign`

需登录。Body：`{ entryId, contentType, bytes, width?, height? }`。
校验：本人拥有 entry；照片数 < 3；contentType ∈ jpeg/png/webp；bytes ≤ 约 1.2MB。
返回：`{ uploadUrl, r2Key, publicUrl, photoId, headers? }`。Presign 约 5 分钟有效。

### `POST /api/photos/confirm`

需登录。Body：`{ entryId, photoId, r2Key, publicUrl, sort, width?, height?, bytes?, contentType }`。
校验归属与 key 前缀；写入 `entry_photos`。

### `DELETE /api/photos/[id]`

需登录且本人；删行并删除 R2 对象。

### 登记 API 扩展

entries 列表/详情/map 响应增加封面或 photos，不破坏现有字段。

## 安全与配置

环境变量（仅服务端，不进仓库）：

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`
- 可选：`R2_ENDPOINT`

R2 桶：公开读或自定义域名；CORS 允许生产与本地开发源 PUT/GET。
未配置 R2 时：登记仍可无图保存；选图提示「图片存储未配置」。

## 错误与边界

- 压缩/上传失败：中文提示，可重试。
- 超过 3 张：前端禁用，后端 400。
- 删除登记：cascade 删库；R2 尽力删除。
- 粘贴非图片：忽略并提示。

## 测试

- 单元：presign 鉴权、满 3 张拒绝、类型/大小、confirm 归属。
- 组件：PhotoPicker 选/删/排序/粘贴（mock）。
- 本轮不强制真连 R2 E2E。

## 非目标

- Cloudflare Images / Worker 多尺寸。
- 视频、HEIC 服务端转码。
- 未登录公开看图。
- 孤儿对象定时清扫（可后续）。

## 实现与发布

- 优先 Cloud Agent；合并后部署 ECS，写入 R2 环境变量并配 CORS。
- 迁移：`supabase/migrations/005_entry_photos.sql`（序号以仓库最新为准）。
- 凭据由 Nero 提供，只写入 `.env.local` / 服务器 `food-notes.env`，永不提交。
