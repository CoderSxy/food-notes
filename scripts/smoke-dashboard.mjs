// Browser regression with mocked business APIs. Never writes to a real database.
import { createRequire } from "node:module";
import fs from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
const loadModule = createRequire(import.meta.url);
const { chromium } = loadModule(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseUrl = process.env.DASHBOARD_BASE_URL || "http://127.0.0.1:3188";
const outDir =
  process.env.DASHBOARD_QA_DIR ||
  path.join(os.tmpdir(), "food-notes-dashboard-qa");
fs.mkdirSync(outDir, { recursive: true });
const mutations = [];
let simulateMeFailure = false;
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROME_EXECUTABLE ||
      (process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : undefined),
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  const expectedHttpErrors = [];
  const externalFonts = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") {
      if (
        m.location().url.includes("/api/auth/me") &&
        /status of (401|500)/.test(m.text())
      )
        expectedHttpErrors.push(m.text());
      else errors.push(m.text());
    }
  });
  page.on("request", (r) => {
    if (/fonts\.googleapis|fonts\.gstatic/.test(r.url()))
      externalFonts.push(r.url());
  });
  const token =
    "eyJhbGciOiJIUzI1NiJ9." +
    Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 86400 }),
    ).toString("base64url") +
    ".test";
  await context.addInitScript(
    (token) => localStorage.setItem("food-notes:access-token", token),
    token,
  );
  const entries = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      user_id: "me",
      kind: "place",
      name: "巷口面馆",
      rating: 4.5,
      lat: 31.23,
      lng: 121.47,
      address_text: "上海市黄浦区",
      note: "汤底清爽，下次再来。",
      created_at: "2026-10-31T00:00:00Z",
      cuisines: [{ id: "c", name: "江浙菜" }],
      categories: [],
      tags: [],
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      user_id: "me",
      kind: "item",
      name: "手冲咖啡豆",
      rating: 4,
      lat: 31.232,
      lng: 121.472,
      address_text: "街角咖啡店",
      note: null,
      created_at: "2026-10-30T00:00:00Z",
      cuisines: [],
      categories: [
        { id: "x", name: "咖啡豆", parent_id: "p", parent: { name: "咖啡" } },
      ],
      tags: [],
    },
  ];
  await context.route("**/api/**", async (route) => {
    const r = route.request(),
      url = new URL(r.url());
    let data;
    if (url.pathname === "/api/auth/me") {
      if (simulateMeFailure)
        return route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "临时服务异常" }),
        });
      if (r.headers().authorization === "Bearer invalid")
        return route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ error: "请先登录" }),
        });
      data = {
        user: {
          userId: "me",
          username: "demo",
          nickname: "小食记",
          phone: null,
        },
      };
    } else if (url.pathname === "/api/dashboard/summary")
      data = {
        scope: url.searchParams.get("scope"),
        placeCount: 128,
        itemCount: 76,
        mappedPlaceCount: 128,
        mappedItemCount: 22,
      };
    else if (url.pathname === "/api/entries/map")
      data = { points: entries, nextCursor: null, hasMore: false };
    else if (url.pathname === "/api/entries" && r.method() === "GET") {
      const kind = url.searchParams.get("kind");
      const q = url.searchParams.get("q");
      const rows = entries.filter(
        (e) => (!kind || e.kind === kind) && (!q || e.name.includes(q)),
      );
      data = { entries: rows, total: rows.length, page: 1, pageSize: 20 };
    } else if (url.pathname === "/api/entries" && r.method() === "POST") {
      mutations.push(r.postDataJSON());
      data = { entry: entries[0] };
    } else if (url.pathname.startsWith("/api/entries/"))
      data = r.method() === "DELETE" ? { ok: true } : { entry: entries[0] };
    else if (url.pathname === "/api/cuisines")
      data = {
        cuisines: [
          { id: "33333333-3333-4333-8333-333333333333", name: "江浙菜" },
        ],
      };
    else if (url.pathname === "/api/tags") data = { tags: [] };
    else if (url.pathname === "/api/categories")
      data = {
        categories: url.searchParams.has("parent_id")
          ? [
              {
                id: "44444444-4444-4444-8444-444444444444",
                name: "咖啡豆",
                parent_id: "33333333-3333-4333-8333-333333333333",
              },
            ]
          : [
              {
                id: "33333333-3333-4333-8333-333333333333",
                name: "咖啡",
                parent_id: null,
              },
            ],
      };
    else if (url.pathname === "/api/recommend")
      data = {
        recommendations: [],
        message: "附近暂无足够样本，先去登记几家美食吧",
      };
    else if (url.pathname === "/api/auth/logout") data = { ok: true };
    else data = { ok: true, accessToken: token };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  const checks = [];
  for (const width of [360, 390, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl + "/");
    await page.getByRole("heading", { name: "总览", exact: true }).waitFor();
    await page.locator(".leaflet-container").waitFor();
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll("img.leaflet-tile")].every(
            (i) => i.complete && i.naturalWidth > 0,
          ),
        null,
        { timeout: 15000 },
      )
      .catch(() => {});
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      font: getComputedStyle(document.body).fontFamily,
      cards: [...document.querySelectorAll(".summary-card")].map((e) =>
        Math.round(e.getBoundingClientRect().width),
      ),
      mapHeight: document
        .querySelector(".map-canvas--dashboard")
        .getBoundingClientRect().height,
    }));
    if (metrics.scroll > width)
      throw Error(`overflow at ${width}: ${metrics.scroll}`);
    await page.screenshot({
      path: `${outDir}/home-${width}.png`,
      fullPage: true,
    });
    checks.push(metrics);
    if (width < 768) {
      await page.getByRole("button", { name: "展开菜单" }).click();
      await page.getByRole("link", { name: "记录", exact: true }).click();
      await page.getByRole("heading", { name: "记录", exact: true }).waitFor();
    }
  }
  await page.goto(baseUrl + "/entries?scope=all&kind=item");
  await page.getByRole("heading", { name: "记录", exact: true }).waitFor();
  await page.getByRole("link", { name: "手冲咖啡豆" }).waitFor();
  await page.getByRole("textbox", { name: "按名称搜索记录" }).fill("不存在");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await page.getByRole("heading", { name: "没有找到匹配的记录" }).waitFor();
  for (const path of [
    "/entries/new",
    "/recommend",
    "/account",
    "/entries/" + entries[0].id,
  ]) {
    await page.goto(baseUrl + path);
    await page.locator(".app-main h1").waitFor();
    await page.screenshot({
      path: outDir + "/" + path.replaceAll("/", "_") + ".png",
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl + "/entries/new");
  await page.getByLabel("餐饮名称").fill("测试面馆");
  await page
    .getByRole("slider", { name: "评分", exact: true })
    .press("ArrowRight");
  simulateMeFailure = true;
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await page.waitForTimeout(200);
  assert.equal(await page.getByLabel("餐饮名称").inputValue(), "测试面馆");
  simulateMeFailure = false;
  await page.getByLabel("纬度（-90 至 90）").fill("31.23");
  await page.getByLabel("经度（-180 至 180）").fill("121.47");
  await page.getByRole("button", { name: "保存记录" }).click();
  await page.waitForURL("**/entries/11111111-1111-4111-8111-111111111111?**");
  assert.equal(mutations.at(-1).rating, 4.5);
  assert.equal(mutations.at(-1).kind, "place");
  await page.goto(baseUrl + "/entries/new");
  await page.getByRole("radio", { name: "物品", exact: true }).check();
  await page.getByLabel("物品名称").fill("咖啡豆");
  await page
    .getByLabel("大类", { exact: true })
    .selectOption("33333333-3333-4333-8333-333333333333");
  await page.getByRole("checkbox", { name: "咖啡豆", exact: true }).check();
  await page.getByRole("button", { name: "保存记录" }).click();
  await page.waitForURL("**/entries/11111111-1111-4111-8111-111111111111?**");
  assert.equal(mutations.at(-1).kind, "item");
  assert.equal(mutations.at(-1).lat, undefined);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除我的记录" }).click();
  await page.waitForURL("**/entries?scope=mine");
  await page.goto(baseUrl + "/recommend");
  await page.getByLabel("纬度（-90 至 90）").fill("31.23");
  await page.getByLabel("经度（-180 至 180）").fill("121.47");
  await page.getByRole("button", { name: "帮我选一餐" }).click();
  await page.getByText("附近暂无足够样本，先去登记几家美食吧").waitFor();
  await page.evaluate(() => {
    localStorage.setItem("food-notes:access-token", "invalid");
    window.dispatchEvent(new Event("food-notes:auth-changed"));
  });
  await page.waitForURL("**/login**");
  assert.equal(
    await page.evaluate(() => localStorage.getItem("food-notes:access-token")),
    null,
  );
  await page.getByLabel("用户名", { exact: true }).fill("demo");
  await page.getByLabel("密码", { exact: true }).fill("password1");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForURL("**/recommend");
  const other = await context.newPage();
  await other.goto(baseUrl + "/entries");
  await other.getByRole("heading", { name: "记录", exact: true }).waitFor();
  await page.goto(baseUrl + "/account");
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.waitForURL("**/login**");
  await other.waitForURL("**/login**");
  await page.getByRole("heading", { name: "欢迎回来" }).waitFor();
  await page.screenshot({ path: outDir + "/login.png", fullPage: true });
  // A new browser context without a token must land on login, preserving the destination.
  const anon = await browser.newContext();
  const anonPage = await anon.newPage();
  await anonPage.goto(baseUrl + "/entries");
  await anonPage.waitForURL("**/login?next=**");
  const landscape = await context.newPage();
  await landscape.setViewportSize({ width: 844, height: 390 });
  await landscape.goto(baseUrl + "/");
  await landscape.locator(".app-main h1").waitFor();
  const overflow = await landscape.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  if (overflow) throw Error("landscape overflow");
  fs.writeFileSync(
    outDir + "/report.json",
    JSON.stringify(
      {
        checks,
        errors,
        expectedHttpErrors,
        externalFonts,
        anonymousUrl: anonPage.url(),
        landscapeOverflow: overflow,
        mutations: mutations.map((m) => ({
          kind: m.kind,
          rating: m.rating,
          hasLocation: typeof m.lat === "number",
        })),
        workflowChecks: [
          "draft retained on background 500",
          "place and locationless item saved",
          "owner delete returns to list",
          "AI empty state",
          "invalid token cleared",
          "login restores destination",
          "cross-tab logout",
        ],
      },
      null,
      2,
    ),
  );
  await browser.close();
  assert.equal(
    expectedHttpErrors.length,
    2,
    "Expected the deliberately injected 500 and 401 only",
  );
  if (errors.length || externalFonts.length)
    throw Error(JSON.stringify({ errors, externalFonts }));
  console.log(
    "Browser smoke passed: 5 widths, landscape, list search, pages, logout and anonymous redirect.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
