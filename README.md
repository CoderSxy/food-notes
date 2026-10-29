# 美食地图 · food-notes

一个多人使用的美食记录与附近 AI 推荐 MVP。使用 Next.js 15 App Router、TypeScript、Supabase Postgres、Zod、jose、Tailwind CSS 与 Vitest，可部署到 Vercel。

已实现手机号测试验证码登录、30 天 httpOnly JWT 会话、餐饮与物品的统一列表和详情、分类筛选、登记与本人删除、定位及手动经纬度、餐饮多菜系、物品两级分类、多标签、1–5 整数评分、附近餐饮距离排序和 AI 推荐。页面文案为简体中文。

## 本地运行

需要 Node.js 20.19+ 和 npm。

```bash
npm install
cp .env.example .env.local
# 在 .env.local 中填写自己的配置
npm run dev
```

访问 <http://localhost:3000>。环境变量只在请求处理时读取；无真实密钥也可以执行 `npm run build`。

```bash
npm test
npm run lint
npm run build
npm start
```

## Supabase 初始化

1. 创建 Supabase 项目。
2. 在 SQL Editor 执行 [001_initial.sql](supabase/migrations/001_initial.sql)。首次执行一次即可。
3. 执行 [seed.sql](supabase/seed.sql) 初始化十种常用菜系；种子可重复执行。
4. 执行 [002_entries_items.sql](supabase/migrations/002_entries_items.sql)，将已有餐饮及关联表迁移到 `entries`，保留数据与 RLS。迁移只执行一次。
5. 执行 [seed_categories.sql](supabase/seed_categories.sql)，初始化物品大类与小类；种子可重复执行。
6. 执行 [003_username_password.sql](supabase/migrations/003_username_password.sql) 一次，使 `phone` 可空并添加 `username`、`password_hash` 列。
7. 从项目设置复制项目 URL、anon key 和 service role key 到本地环境变量或 Vercel 环境变量。

迁移后主表为 `entries`，原 `foods` 数据保留，默认 `kind=place`；原关联表及其外键迁移为 `entry_cuisines` 和 `entry_tags`。数据模型：

| 表 / 类型 | 用途与约束 |
| --- | --- |
| `entries` / `place` | 餐饮，必须填写 `lat/lng`；通过 `entry_cuisines` 多选平铺菜系 |
| `entries` / `item` | 物品，地点选填；通过 `entry_categories` 至少选择一个小类，应用层校验小类存在且 `parent_id` 非空 |
| `categories` | 大类 → 小类两级树；触发器禁止第三级及将已有子类的大类移动到其它大类下 |
| `entry_tags` / `tags` | 餐饮和物品共用标签 |
| `users` / `otp_codes` | 自建账号与测试验证码 |

评分为 1–5 整数；经纬度可空时仍有范围检查。分类种子包含零食、酒水、饮料、奶茶、咖啡五个大类，酒水含白酒、红酒、啤酒、黄酒、清酒，并为其它大类各提供一个起始小类。所有表开启 RLS，默认拒绝匿名客户端访问。

本应用使用自建 JWT，而非 Supabase Auth。数据请求全部经过服务端 Route Handlers：服务端校验会话及记录所有者，再通过 service role 访问数据库。service role 绕过 RLS，严禁提供给浏览器。未登录无法读美食、登记或调用推荐，删除仅限本人记录。MVP 暂未提供编辑功能。

## 环境变量

| 名称 | 用途 / 配置 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 HTTPS URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 项目 anon key；预留客户端集成，当前请求仍走服务端 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端数据库密钥，禁止在客户端使用 |
| `SESSION_SECRET` | 至少 32 字符的随机密钥；更换会使现有会话失效 |
| `AI_BASE_URL` | 默认 `https://api.nerosun.cn/v1`，OpenAI 兼容接口的 `/v1` 地址 |
| `AI_API_KEY` | 自备，仅服务端；未配置时推荐提示错误，登录与美食功能仍可用 |
| `AI_MODEL` | 默认 `deepseek-v4.1-flash` |
| `OTP_TEST_MODE` | 保持 `true`；`false` 会拒绝发送，因为尚未接入短信服务商 |

`.env.example` 只包含空密钥和非敏感默认值。`.env`、`.env.local`、其他 `.env*` 与 `.vercel` 均已忽略，只有 `.env.example` 可提交。

## 验证码测试模式

登录页输入手机号后点击「发送验证码」。在本地终端或 Vercel 函数日志查看：

```text
[OTP_TEST] phone=<手机号> code=<六位验证码>
```

验证码十分钟有效，同一手机号一分钟内限制重发。正确码校验后以条件更新标记已使用，错误、过期、重复消费均拒绝。接口不返回验证码；取得服务端日志的测试人员才能完成登录。首次登录自动创建账号。短信提供商尚未接入，`channel` 字段预留扩展。

## 使用与 AI 行为

1. 登录后点击「记一笔」，选择「餐饮店」或「物品」，填写名称和整数评分。
2. 餐饮选择菜系并填写经纬度；物品先选大类，再多选小类，地点可以留空（例如在家记录零食）。两种记录都可添加标签、地址和备注。
3. 首页可按「全部 / 餐饮 / 物品」筛选。附近 5 公里只展示有坐标的餐饮；详情显示菜系或分类路径，创建者可以删除。
4. 「AI 推荐」支持选择 1、5、10、20 公里范围。服务端仅查询 `kind=place` 且经纬度非空的附近餐饮，再调用 `${AI_BASE_URL}/chat/completions`。

附近查询以最新 500 条有坐标的餐饮记录在内存中计算 Haversine 距离并排序，列表最多返回最新 100 条；这是 MVP 的规模限制。推荐最多向 AI 发送最近的 30 条候选，备注截断至 200 字，最多展示五项。服务端校验 JSON 结构、过滤未知候选 ID 与重复项，卡片名称来自数据库。

无附近样本时直接显示「附近暂无足够样本，先去登记几家美食吧」，不调用 AI、不编造店名。AI 缺少 Key、请求超时、上游错误或格式错误均显示中文错误，不影响美食列表和登记。AI 请求超时为 20 秒，Vercel 推荐函数最长执行时间为 30 秒。

## 业务 API

以下接口均需要登录；DELETE 只允许记录创建者操作，删除关联由外键级联完成。

| 接口 | 返回 / 行为 |
| --- | --- |
| `GET /api/entries?kind=place\|item` | `{ entries }`；省略 `kind` 返回两种类型，非法类型返回 400 |
| `POST /api/entries` | `{ entry }`，201；公共字段 `kind/name/rating/tagNames`，餐饮另传 `lat/lng/cuisineIds`，物品另传非空 `categoryIds`（UUID 数组），`lat/lng` 可省略；地址和备注选填 |
| `GET /api/entries/[id]` | `{ entry }`，含菜系、小类及其父类名称、标签；无记录返回 404 |
| `DELETE /api/entries/[id]` | `{ ok: true }`；非本人返回 403 |
| `GET /api/categories` | `{ categories }`，大类 |
| `GET /api/categories?parent_id=uuid` | `{ categories }`，指定大类的小类 |
| `GET /api/entries/nearby?lat=31&lng=121&radiusKm=5` | `{ entries }`，仅有坐标的餐饮，按距离排序 |
| `POST /api/recommend` | 继续使用 `lat/lng/radiusKm`，候选仅来自附近餐饮 |

过渡期保留 `/api/foods`、`/api/foods/[id]`、`/api/foods/nearby`，读写、详情、删除与附近查询都只处理餐饮，保持旧的 `{ foods }` / `{ food }` 返回字段。旧创建请求省略 `kind` 时视为 `place`，显式 `kind=item` 会拒绝；物品 ID 在旧详情和删除接口返回 404。旧页面 `/foods/new` 与 `/foods/[id]` 跳转至 `/entries/*`。

## Vercel 部署

1. 在 Vercel 导入本 Git 仓库，选择 Next.js 框架、Node.js 20.19+。
2. 在项目环境变量中填写上表所有配置，生产与预览环境分别配置；不要上传 `.env.local`。
3. 确认 Supabase 迁移和种子已执行，部署默认命令 `npm run build`。
4. 打开生成的 HTTPS 地址，发送验证码并从函数日志取码，验证登录。
5. 登记一条带多菜系、多标签、评分 4 的记录，确认首页与详情可读。
6. 以记录附近坐标请求推荐；以无记录坐标验证样本不足提示；退出后确认写入和推荐返回 401。
7. 用第二个账号确认不能删除第一个账号的记录。

生产 Cookie 使用 `secure`、`httpOnly`、`sameSite=lax`。浏览器定位需要 HTTPS（本地 localhost 除外）。Vercel 配置或更换环境变量后请重新部署。

## 验证状态与文档

单元与接口测试还覆盖 entries 类型校验、叶子分类校验、关联失败清理、匿名请求、物品所有权和旧 foods 接口的餐饮限制。基础测试覆盖距离计算、整数评分和多选校验、验证码存储与消费、会话签名、匿名请求与所有权限制、AI 配置与错误、未知 ID 过滤和无样本不调用 AI。Chromium 移动视口冒烟验证使用模拟 API，覆盖无地点物品登记及详情、带坐标和菜系的餐饮登记、三种首页筛选与附近餐饮/推荐展示；未发现浏览器运行时错误。未使用真实 Supabase 项目或真实 AI 凭据进行外部服务联调；部署后按上面的步骤完成验证。

本轮按 [Entries 设计说明](docs/superpowers/specs/2026-10-28-entries-items-design.md) 与 [六项实施计划](docs/superpowers/plans/2026-10-28-entries-items.md) 实现；保留原有 [基础设计](docs/superpowers/specs/2026-10-28-food-platform-design.md)。地图足迹、真实短信与物品 AI 推荐不在本轮范围内。
