# 美食地图 · food-notes

一个多人使用的美食记录与附近 AI 推荐 MVP。使用 Next.js 15 App Router、TypeScript、Supabase Postgres、Zod、jose、Tailwind CSS 与 Vitest，可部署到 Vercel。

已实现用户名密码（默认）与手机号测试验证码（次要）登录、30 天 localStorage JWT + Bearer 鉴权、餐饮与物品的统一列表和详情、分类筛选、登记与本人删除、定位及手动经纬度、餐饮多菜系、物品两级分类、多标签、1–5 半星评分（0.5 分递增）、附近餐饮距离排序和 AI 推荐。页面文案为简体中文。

地图足迹使用 [Leaflet](https://leafletjs.com/) + [react-leaflet](https://react-leaflet.js.org/)，底图为 [OpenStreetMap](https://www.openstreetmap.org/copyright) 标准瓦片（需保留 © OpenStreetMap 署名）。首页两张卡片展示当前范围的餐饮/物品精确数量，并通过独立分页点位接口展示所有有坐标足迹（默认「我的」，可切换「全部」）；详情页有坐标时显示小地图；登记页支持地图点选与拖钉，并与定位/手填经纬度同步。本轮不包含独立 `/map` 页、路线或热力图。

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
7. 执行 [004_half_star_ratings.sql](supabase/migrations/004_half_star_ratings.sql) 一次，将评分改为支持 0.5 分递增的数值类型，保留已有整数评分。
8. 从项目设置复制项目 URL、anon key 和 service role key 到本地环境变量或 Vercel 环境变量。

本地「记一笔」保存失败时，运行 `npm run check:setup`（Node.js 20.19+）。脚本读取 `.env.local`（进程环境变量优先），只读检查 service_role JWT 角色、`public.entries` 及 `kind/rating/lat/lng`、半星查询、用户名密码列、账号数和菜系数；失败时退出码非零，并给出 002/003/004 迁移、种子及密钥的中文排查清单。JWT 仅解码，后续请求才验证访问；基础检查不覆盖全部约束和实际保存，请勿盲目重复执行迁移。开发环境接口显示脱敏后的数据库代码与消息，完整原始错误见服务端日志；生产环境未知错误保持通用提示。脚本不打印密钥、不写入数据，请勿提交 `.env.local` 或密钥。

迁移后主表为 `entries`，原 `foods` 数据保留，默认 `kind=place`；原关联表及其外键迁移为 `entry_cuisines` 和 `entry_tags`。数据模型：

| 表 / 类型 | 用途与约束 |
| --- | --- |
| `entries` / `place` | 餐饮，必须填写 `lat/lng`；通过 `entry_cuisines` 多选平铺菜系 |
| `entries` / `item` | 物品，地点选填；通过 `entry_categories` 至少选择一个小类，应用层校验小类存在且 `parent_id` 非空 |
| `categories` | 大类 → 小类两级树；触发器禁止第三级及将已有子类的大类移动到其它大类下 |
| `entry_tags` / `tags` | 餐饮和物品共用标签 |
| `users` / `otp_codes` | 自建账号与测试验证码；`users` 支持可空 `phone`、唯一 `username` 与 `password_hash`（预置账号，无公开注册） |

评分为 1–5 分，支持半星（0.5 分递增）；经纬度可空时仍有范围检查。分类种子包含零食、酒水、饮料、奶茶、咖啡五个大类，酒水含白酒、红酒、啤酒、黄酒、清酒，并为其它大类各提供一个起始小类。所有表开启 RLS，默认拒绝匿名客户端访问。

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

## 登录与账号

默认使用**用户名 + 密码**登录（登录页「账号密码」）；**手机验证码**为次要方式（「手机验证码」标签）。不提供公开自助注册。

预置账号步骤：

1. 在 Supabase 执行 [003_username_password.sql](supabase/migrations/003_username_password.sql)（见上文初始化列表）。
2. 本地生成密码哈希：`node scripts/hash-password.mjs '你的密码'`（至少 8 位，勿将真实生产密码提交到 git）。
3. 参考 [seed_users.example.sql](supabase/seed_users.example.sql) 将 `HASH` 替换为脚本输出后插入 `users` 表。

仅手机 OTP 的用户可继续无用户名/密码；仅密码账号的 `phone` 可为空。会话 JWT 对无手机账号同样有效。

## 验证码测试模式

登录页输入手机号后点击「发送验证码」。在本地终端或 Vercel 函数日志查看：

```text
[OTP_TEST] phone=<手机号> code=<六位验证码>
```

验证码十分钟有效，同一手机号一分钟内限制重发。正确码校验后以条件更新标记已使用，错误、过期、重复消费均拒绝。接口不返回验证码；取得服务端日志的测试人员才能完成登录。首次 OTP 登录自动创建仅手机号账号。短信提供商尚未接入，`channel` 字段预留扩展。

账号密码登录：`POST /api/auth/login`，失败统一提示「用户名或密码错误」。`GET /api/auth/me` 返回 `username`、`nickname`、`hasPhone` 等，从不返回 `password_hash`。

## 使用与 AI 行为

1. 登录后点击「记一笔」，选择「餐饮店」或「物品」，填写名称和半星评分（1–5 分，0.5 分递增）。
2. 餐饮选择菜系并填写经纬度；物品先选大类，再多选小类，地点可以留空（例如在家记录零食）。两种记录都可添加标签、地址和备注。
3. 首页地图可按「全部 / 餐饮 / 物品」筛选；记录页支持范围、类型、名称搜索及每页 20 条分页。附近 5 公里只展示有坐标的餐饮；详情显示菜系或分类路径，创建者可以删除。
4. 「AI 推荐」支持选择 1、5、10、20 公里范围。服务端仅查询 `kind=place` 且经纬度非空的附近餐饮，再调用 `${AI_BASE_URL}/chat/completions`。

附近查询以最新 500 条有坐标的餐饮记录在内存中计算 Haversine 距离并排序，旧 foods 列表最多返回最新 100 条；新记录列表使用服务端分页，首页计数与地图不受该上限限制。附近候选的 500 条上限仍是 MVP 的规模限制。推荐最多向 AI 发送最近的 30 条候选，备注截断至 200 字，最多展示五项。服务端校验 JSON 结构、过滤未知候选 ID 与重复项，卡片名称来自数据库。

无附近样本时直接显示「附近暂无足够样本，先去登记几家美食吧」，不调用 AI、不编造店名。AI 缺少 Key、请求超时、上游错误或格式错误均显示中文错误，不影响美食列表和登记。AI 请求超时为 20 秒，Vercel 推荐函数最长执行时间为 30 秒。

## 业务 API

以下接口均需要登录；DELETE 只允许记录创建者操作，删除关联由外键级联完成。

| 接口 | 返回 / 行为 |
| --- | --- |
| `GET /api/entries?scope=mine\|all&kind=place\|item&q=名称&page=1&pageSize=20` | `{ entries, total, page, pageSize }`；默认 mine，类型省略为全部，pageSize 上限 100，非法参数返回 400 |
| `GET /api/dashboard/summary?scope=mine\|all` | 当前范围的餐饮、物品、各类型有位置记录精确计数 |
| `GET /api/entries/map?scope=mine\|all&kind=all\|place\|item&cursor=...` | `{ points, nextCursor, hasMore }`，每批最多 500 个轻量点位，稳定游标分页 |
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

登录接口返回 `accessToken`、`expiresAt`、`user`；浏览器将 token 存在 `food-notes:access-token`，业务 API 通过 `Authorization: Bearer <token>` 验证签名、过期和用户存在性。旧 `food_session` Cookie 登录不再放行，更新后需重新登录一次。token 可被同源 JavaScript 读取；退出清除本地凭证，不提供已复制 JWT 的即时撤销。浏览器定位需要 HTTPS（本地 localhost 除外）。Vercel 配置或更换环境变量后请重新部署。

## 字体与页面结构

界面使用本地系统字体：微软雅黑优先，依次回退至苹方、Segoe UI、Arial、系统 sans-serif。不使用 `next/font/google`、Google Fonts 外链或字体包；构建和运行均无需下载字体。

PC 提供底部居中 Dock；移动 Web 提供右下展开菜单。登录页独立展示；`/` 为统计与地图总览，`/entries` 为分页记录，`/entries/new` 为登记，`/recommend` 为共享餐饮 AI 推荐，`/account` 为账号。范围和列表筛选写入 URL；默认「我的」，显式 all 切到共享记录。新增、删除后重新查询，用户数据不使用公共缓存。

服务端首屏只输出稳定的登录验证壳，客户端完成 token 验证后挂载业务内容；地图继续动态加载，避免 Leaflet 访问 SSR 的浏览器对象。后台登录复核保留未保存表单；登录失效或换账号会清理业务子树。详情日期继续统一 UTC 的 YYYY-MM-DD。

可选执行 `supabase/migrations/005_dashboard_indexes.sql` 添加查询索引；使用 IF NOT EXISTS，可重复执行；本轮不新增业务表。

## 验证状态与文档

单元与接口测试还覆盖 entries 类型校验、叶子分类校验、关联失败清理、匿名请求、物品所有权和旧 foods 接口的餐饮限制。基础测试覆盖距离计算、半星评分和多选校验、验证码存储与消费、会话签名、匿名请求与所有权限制、AI 配置与错误、未知 ID 过滤和无样本不调用 AI。Chromium 移动视口冒烟验证使用模拟 API，覆盖无地点物品登记及详情、带坐标和菜系的餐饮登记、三种首页筛选与附近餐饮/推荐展示；未发现浏览器运行时错误。未使用真实 Supabase 项目或真实 AI 凭据进行外部服务联调；部署后按上面的步骤完成验证。

早期 Entries 实现按 [Entries 设计说明](docs/superpowers/specs/2026-10-28-entries-items-design.md) 与 [六项实施计划](docs/superpowers/plans/2026-10-28-entries-items.md) 实现；保留原有 [基础设计](docs/superpowers/specs/2026-10-28-food-platform-design.md)。用户名密码登录见 [设计说明](docs/superpowers/specs/2026-10-29-username-password-auth-design.md) 与 [实施计划](docs/superpowers/plans/2026-10-29-username-password-auth.md)。地图足迹现已实现；真实短信与物品 AI 推荐仍不在当前范围。

## 2026-10-31 双端改版验证

本轮设计与执行记录见 [详细方案](docs/superpowers/specs/2026-10-31-responsive-dashboard-redesign.md)、[实施计划](docs/superpowers/plans/2026-10-31-responsive-dashboard.md) 和 [验证记录](docs/superpowers/plans/2026-10-31-responsive-dashboard-progress.md)。浏览器检查使用模拟业务 API，外部 Supabase 与真实 AI 尚需部署后联调。

可选浏览器回归：启动生产预览后，在已安装 Playwright 的环境运行 `node scripts/smoke-dashboard.mjs`；可通过 `PLAYWRIGHT_MODULE`、`CHROME_EXECUTABLE`、`DASHBOARD_BASE_URL`、`DASHBOARD_QA_DIR` 指定工具、浏览器、预览地址与输出目录。脚本拦截业务接口，使用合成数据，不会写入真实数据库。

本轮最终自动验证：34 个测试文件、180 项测试通过；lint 无错误（4 个既有 warning）；生产构建通过。
