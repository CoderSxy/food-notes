"use client";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { requestJson } from "@/lib/browser";
import type {
  EntrySummary,
  MapKind,
  MapPoint,
  MapPage,
  OwnerScope,
} from "@/lib/entry-types";
import { loadMapPages } from "@/lib/map-loader";
import { DynamicDashboardMap } from "@/components/map/dynamic";
import PageHeader from "@/components/layout/PageHeader";
import ScopeSwitch from "@/components/layout/ScopeSwitch";
import Icon from "@/components/layout/Icon";
function Dashboard() {
  const params = useSearchParams();
  const router = useRouter();
  const scope: OwnerScope = params.get("scope") === "all" ? "all" : "mine";
  const kind: MapKind =
    params.get("kind") === "place"
      ? "place"
      : params.get("kind") === "item"
        ? "item"
        : "all";
  const [summary, setSummary] = useState<EntrySummary | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState("");
  const [retry, setRetry] = useState(0);
  const resume = useRef<string | null>(null);
  const range = useRef("");
  const [complete, setComplete] = useState(false);
  const [changed, setChanged] = useState(false);
  const source = `/?scope=${scope}&kind=${kind}`;
  function filter(next: { scope?: OwnerScope; kind?: MapKind }) {
    router.replace(`/?scope=${next.scope ?? scope}&kind=${next.kind ?? kind}`, {
      scroll: false,
    });
  }
  useEffect(() => {
    let active = true;
    setSummary(null);
    setSummaryError("");
    requestJson<EntrySummary>(`/api/dashboard/summary?scope=${scope}`)
      .then((s) => {
        if (active) setSummary(s);
      })
      .catch((e) => {
        if (active) setSummaryError(e.message);
      });
    return () => {
      active = false;
    };
  }, [scope, retry]);
  useEffect(() => {
    const controller = new AbortController();
    const key = `${scope}:${kind}`;
    if (range.current !== key) {
      range.current = key;
      resume.current = null;
      setPoints([]);
    }
    setComplete(false);
    setLoading(true);
    setMapError("");
    setChanged(false);
    void loadMapPages(
      (cursor) =>
        requestJson<MapPage>(
          `/api/entries/map?scope=${scope}&kind=${kind}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
          { signal: controller.signal },
        ),
      (page) => {
        resume.current = page.nextCursor;
        setPoints((previous) => {
          const all = new Map(previous.map((p) => [p.id, p]));
          page.points.forEach((p) => all.set(p.id, p));
          return [...all.values()];
        });
      },
      controller.signal,
      resume.current,
    )
      .then(async () => {
        if (controller.signal.aborted) return;
        setComplete(true);
        range.current = "";
        try {
          const latest = await requestJson<EntrySummary>(
            `/api/dashboard/summary?scope=${scope}`,
            { signal: controller.signal },
          );
          if (!controller.signal.aborted)
            setSummary((old) => {
              if (old && JSON.stringify(old) !== JSON.stringify(latest))
                setChanged(true);
              return latest;
            });
        } catch {
          /* Keep independently loaded statistics if recheck fails. */
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setMapError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [scope, kind, retry]);
  const total = summary
    ? kind === "place"
      ? summary.placeCount
      : kind === "item"
        ? summary.itemCount
        : summary.placeCount + summary.itemCount
    : null;
  const mapped = summary
    ? kind === "place"
      ? summary.mappedPlaceCount
      : kind === "item"
        ? summary.mappedItemCount
        : summary.mappedPlaceCount + summary.mappedItemCount
    : null;
  return (
    <>
      <PageHeader
        title="总览"
        description={
          scope === "mine"
            ? "你记录的味道与日常，都在这里。"
            : "看看大家记录的味道与日常。"
        }
      >
        <ScopeSwitch
          value={scope}
          onChange={(value) => filter({ scope: value })}
        />
      </PageHeader>
      <div className="summary-grid">
        {[
          {
            kind: "place" as const,
            label: "餐饮记录",
            icon: "food" as const,
            count: summary?.placeCount,
          },
          {
            kind: "item" as const,
            label: "物品记录",
            icon: "item" as const,
            count: summary?.itemCount,
          },
        ].map((card) => (
          <Link
            key={card.kind}
            className={`summary-card ${card.kind}`}
            href={`/entries?scope=${scope}&kind=${card.kind}`}
          >
            <div className="summary-label">
              <span>{card.label}</span>
              <span className="category-icon">
                <Icon name={card.icon} />
              </span>
            </div>
            <div className="summary-number">
              {card.count === undefined
                ? "—"
                : card.count.toLocaleString("zh-CN")}
              <small>条</small>
            </div>
            <span className="summary-link">
              查看记录
              <Icon name="arrow" size={16} />
            </span>
          </Link>
        ))}
      </div>
      {summaryError && (
        <div className="inline-error" role="alert">
          统计加载失败：{summaryError}
          <button className="secondary" onClick={() => setRetry((v) => v + 1)}>
            重试
          </button>
        </div>
      )}
      <section className="dashboard-section">
        <div className="map-heading">
          <div>
            <h2>记录地图</h2>
            <p className="muted">餐饮与有位置的物品</p>
          </div>
          <div className="segmented" role="group" aria-label="地图类型">
            {(["all", "place", "item"] as const).map((value) => (
              <button
                key={value}
                aria-pressed={kind === value}
                onClick={() => filter({ kind: value })}
              >
                {value === "all" ? "全部" : value === "place" ? "餐饮" : "物品"}
              </button>
            ))}
          </div>
        </div>
        <DynamicDashboardMap
          key={`${scope}:${kind}`}
          points={points}
          complete={complete}
          source={source}
        />
        <div className="map-caption">
          <div className="map-legend">
            <span>
              <i className="legend-dot place" />
              餐饮
            </span>
            <span>
              <i className="legend-dot item" />
              物品
            </span>
          </div>
          <span role="status">
            {loading
              ? `正在加载点位：${points.length}${mapped !== null ? ` / ${mapped}` : ""}`
              : mapError
                ? `已加载 ${points.length} 个点位，尚未加载完整`
                : total !== null && mapped !== null
                  ? `${total} 条记录 · ${mapped} 条有位置 · ${total - mapped} 条未记录位置`
                  : `已加载 ${points.length} 个点位`}
          </span>
          <Link
            href={`/entries?scope=${scope}${kind !== "all" ? `&kind=${kind}` : ""}`}
          >
            查看记录
          </Link>
        </div>
        {mapError && (
          <div className="inline-error" role="alert">
            {mapError}
            <button
              className="secondary"
              onClick={() => setRetry((v) => v + 1)}
            >
              继续加载
            </button>
          </div>
        )}
        {changed && (
          <div className="inline-error">
            记录在加载期间有变化，可刷新获得最新点位。
            <button
              className="secondary"
              onClick={() => {
                range.current = "";
                resume.current = null;
                setRetry((v) => v + 1);
              }}
            >
              刷新地图
            </button>
          </div>
        )}
      </section>
    </>
  );
}
export default function Home() {
  return (
    <Suspense fallback={<p role="status">正在加载总览…</p>}>
      <Dashboard />
    </Suspense>
  );
}
