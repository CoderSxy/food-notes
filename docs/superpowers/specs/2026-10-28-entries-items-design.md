# Entries + 物品分类树 — 设计说明

**日期：** 2026-10-28  
**状态：** 待用户确认  
**仓库：** CoderSxy/food-notes  
**前置：** `docs/superpowers/specs/2026-10-28-food-platform-design.md`

## 1. 目标

在现有「餐饮店登记 + 评分 + 标签 + 附近 AI」之上，支持登记**物品**（零食、酒水、饮料、奶茶、咖啡等），带**大类→小类**分类与五分评分。地图足迹、真实短信本轮不做。

### 已确认决策

- 物品**地点可选**（在家也能记）
- 餐饮继续用平铺**菜系**；物品单独用**大类→小类树**
- 数据层用统一 **`entries`**，不用硬塞进旧 `foods` 语义，也不分两套主业务表长期分叉
- 本轮 AI「附近推荐」仍只针对有坐标的餐饮；无坐标物品不进附近推荐

## 2. 为何不直接复用旧 `foods` 语义

| | 餐饮 `place` | 物品 `item` |
|--|--|--|
| 定位 | 必填 | 可选 |
| 分类 | `cuisines` 平铺多选 | `categories` 父子树，挂叶子 |
| 推荐 | 可按附近 | 无坐标则不进附近推荐 |

硬共用一张「永远必填 lat/lng + 只挂菜系」的表会导致大量空字段与分支；统一 `entries` + 分轨关联表更干净。

## 3. 数据模型

### 3.1 `categories`

| 字段 | 说明 |
|------|------|
| id | UUID PK |
| parent_id | 可空；空=大类，非空=小类 |
| name | 显示名 |
| slug | 稳定键，唯一 |
| created_at | 时间戳 |

约束：小类的 `parent_id` 必须指向大类（`parent_id IS NULL` 的行）。索引：`(parent_id)`, unique `(parent_id, name)` 或全局 `slug`。

**种子大类：** 零食、酒水、饮料、奶茶、咖啡。  
**酒水小类示例：** 白酒、红酒、啤酒、黄酒、清酒。其它大类可先少种子、允许后续扩展。

### 3.2 `entries`（由 `foods` 迁移）

| 字段 | 说明 |
|------|------|
| id | UUID PK |
| user_id | 创建者 |
| kind | `place` \| `item` |
| name | 名称 |
| note | 备注，可空 |
| rating | 1–5 整数 |
| lat / lng | **place 必填；item 可空** |
| address_text | 可空 |
| created_at / updated_at | 时间戳 |

表级或应用层校验：

- `kind = place` ⇒ `lat`、`lng` NOT NULL  
- `kind = item` ⇒ 至少一条 `entry_categories` 指向**叶子**（`parent_id IS NOT NULL`）

### 3.3 关联

- `entry_cuisines`：`entry_id` + `cuisine_id`（仅 place）
- `entry_categories`：`entry_id` + `category_id`（仅 item，多选叶子）
- `entry_tags` + 现有 `tags`：place / item 共用

### 3.4 迁移策略

1. 新建 `categories`、种子数据  
2. `foods` rename → `entries`，加 `kind` 默认 `place`  
3. `food_cuisines` → `entry_cuisines`，`food_tags` → `entry_tags`  
4. `lat/lng` 改为可空，并用 check：`kind <> 'place' OR (lat IS NOT NULL AND lng IS NOT NULL)`  
5. API/前端逐步改名；过渡期 `/api/foods*` 可代理到 entries 且 `kind=place`

## 4. 产品与 API

- 首页筛选：全部 / 餐饮 / 物品  
- 登记：先选 kind；place→定位+菜系；item→大类再小类（可多选叶子）+ 地点选填  
- 详情按 kind 展示  
- `GET /api/categories?parent_id=`  
- `GET|POST /api/entries`（及 `[id]`、nearby 仅 place）  
- AI nearby：候选仅为 `kind=place` 且有坐标

## 5. 非目标（本轮）

地图足迹、真实短信、物品口味向 AI 推荐（可后续单独立项）。

## 6. 成功标准

- 能登记无定位的物品，并挂上大类下的小类与评分  
- 原有餐饮数据迁移后仍可列表、详情、附近推荐  
- 分类种子含约定大类与酒水小类  
- 无真实密钥进入仓库  

