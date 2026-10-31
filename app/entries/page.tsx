"use client";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { requestJson } from "@/lib/browser";
import type { EntryPage, OwnerScope } from "@/lib/entry-types";
import type { Entry } from "@/lib/entries";
import EntryCard from "@/components/EntryCard";
import PageHeader from "@/components/layout/PageHeader";
import ScopeSwitch from "@/components/layout/ScopeSwitch";
import Icon from "@/components/layout/Icon";
import LocationField from "@/components/LocationField";
function Records() {
  const params = useSearchParams();
  const router = useRouter();
  const scope: OwnerScope = params.get("scope") === "all" ? "all" : "mine";
  const kind = ["place", "item"].includes(params.get("kind") ?? "")
    ? params.get("kind")!
    : "";
  const q = (params.get("q") ?? "").slice(0, 100);
  const page = Math.max(1, Math.min(100000, Number(params.get("page")) || 1));
  const [data, setData] = useState<EntryPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState(q);
  const [nearby, setNearby] = useState<{ lat: string; lng: string } | null>(
    null,
  );
  const [picker, setPicker] = useState(false);
  const [location, setLocation] = useState({ lat: "", lng: "" });
  const query = new URLSearchParams({
    scope,
    page: String(page),
    pageSize: "20",
  });
  if (kind) query.set("kind", kind);
  if (q) query.set("q", q);
  const queryKey = query.toString();
  const source = `/entries?${queryKey}`;
  function change(next: Record<string, string>) {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([key, value]) =>
      value ? p.set(key, value) : p.delete(key),
    );
    if (!("page" in next)) p.delete("page");
    setNearby(null);
    router.replace(`/entries?${p}`, { scroll: false });
  }
  useEffect(() => {
    setSearch(q);
  }, [q]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    const url = nearby
      ? `/api/entries/nearby?scope=${scope}&lat=${encodeURIComponent(nearby.lat)}&lng=${encodeURIComponent(nearby.lng)}`
      : `/api/entries?${queryKey}`;
    requestJson<EntryPage | { entries: Entry[] }>(url, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted)
          setData(
            "total" in result
              ? result
              : {
                  entries: result.entries,
                  total: result.entries.length,
                  page: 1,
                  pageSize: result.entries.length || 20,
                },
          );
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [queryKey, nearby, retry, scope]);
  return (
    <>
      <PageHeader
        title="记录"
        description={
          nearby
            ? "附近 5 公里的餐饮记录，按距离排序。"
            : scope === "mine"
              ? "收藏过的餐饮与物品。"
              : "大家分享的餐饮与物品。"
        }
      >
        <Link className="button" href="/entries/new">
          <Icon name="plus" size={18} />
          增加记录
        </Link>
      </PageHeader>
      <div className="row between">
        <ScopeSwitch
          value={scope}
          onChange={(value) => change({ scope: value })}
        />
        <div className="segmented" role="group" aria-label="记录类型">
          {[
            { value: "", label: "全部" },
            { value: "place", label: "餐饮" },
            { value: "item", label: "物品" },
          ].map((t) => (
            <button
              key={t.value}
              aria-pressed={!nearby && kind === t.value}
              onClick={() => change({ kind: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-panel">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            change({ q: search.trim() });
          }}
        >
          <input
            aria-label="按名称搜索记录"
            value={search}
            maxLength={100}
            placeholder="搜索记录名称"
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit">搜索</button>
        </form>
        <button className="secondary" onClick={() => setPicker((v) => !v)}>
          <Icon name="locate" size={17} />
          附近餐饮
        </button>
        {nearby && (
          <button className="secondary" onClick={() => setNearby(null)}>
            返回最新记录
          </button>
        )}
      </div>
      {picker && (
        <form
          className="panel narrow"
          onSubmit={(e) => {
            e.preventDefault();
            setNearby({ ...location });
            setPicker(false);
          }}
        >
          <h2>查看附近餐饮</h2>
          <LocationField value={location} onChange={setLocation} required />
          <p className="muted">
            只查询餐饮；从当前范围最新 500 条带位置餐饮中查找附近 5
            公里，不含物品。
          </p>
          <button>查看附近</button>
        </form>
      )}
      {nearby && (
        <p className="muted">
          附近模式不使用名称搜索与列表分页；范围仍为「
          {scope === "mine" ? "我的" : "全部"}」，候选为最新 500 条有位置餐饮。
        </p>
      )}
      {loading ? (
        <p role="status" className="loading-line">
          正在加载记录…
        </p>
      ) : error ? (
        <div className="inline-error" role="alert">
          {error}
          <button className="secondary" onClick={() => setRetry((v) => v + 1)}>
            重新加载
          </button>
        </div>
      ) : (
        data && (
          <>
            <p className="muted result-count">
              {nearby ? "找到" : "共"} {data.total} 条记录
            </p>
            {data.entries.length ? (
              <div className="grid">
                {data.entries.map((entry) => (
                  <EntryCard key={entry.id} entry={entry} source={source} />
                ))}
              </div>
            ) : (
              <div className="panel empty">
                <h2>
                  {q
                    ? "没有找到匹配的记录"
                    : nearby
                      ? "附近还没有餐饮记录"
                      : "这里还没有记录"}
                </h2>
                <p>
                  {q
                    ? "换个关键词，或清除筛选再看看。"
                    : "增加一条记录，把喜欢的事物留下来。"}
                </p>
                {q ? (
                  <button
                    className="secondary"
                    onClick={() => {
                      setSearch("");
                      change({ q: "" });
                    }}
                  >
                    清除搜索
                  </button>
                ) : (
                  <Link className="button" href="/entries/new">
                    增加记录
                  </Link>
                )}
              </div>
            )}
            {!nearby && data.total > 0 && (
              <div className="pagination">
                <button
                  className="secondary"
                  disabled={page <= 1}
                  onClick={() => change({ page: String(page - 1) })}
                >
                  上一页
                </button>
                <span>
                  第 {page} / {Math.max(1, Math.ceil(data.total / 20))} 页
                </span>
                <button
                  className="secondary"
                  disabled={page * 20 >= data.total}
                  onClick={() => change({ page: String(page + 1) })}
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )
      )}
    </>
  );
}
export default function Entries() {
  return (
    <Suspense fallback={<p role="status">正在加载记录…</p>}>
      <Records />
    </Suspense>
  );
}
