"use client";
import { useEffect, useState } from "react";
import LocationField from "@/components/LocationField";
import RecommendResult from "@/components/RecommendResult";
import type { Recommendation } from "@/lib/ai/client";
import { requestJson, jsonBody } from "@/lib/browser";
export default function Recommend() {
  const [location, setLocation] = useState({ lat: "", lng: "" }),
    [radius, setRadius] = useState("5"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<{
      recommendations: Recommendation[];
      message?: string;
    } | null>(null);
  useEffect(() => {
    requestJson("/api/auth/me").catch((e) => setError(e.message));
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await requestJson(
          "/api/recommend",
          jsonBody({
            lat: Number(location.lat),
            lng: Number(location.lng),
            radiusKm: Number(radius),
          }),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="hero">
        <h1>AI 推荐</h1>
        <p>从全部共享餐饮记录中，找一份适合你的下一餐。</p>
        <p className="muted">
          仅推荐有位置的餐饮，不含物品。候选来自最新 500
          条有位置餐饮，最多选取附近 30 条，由 AI
          结合距离、评分、菜系与标签给出理由。
        </p>
      </section>
      <form className="panel narrow" onSubmit={submit}>
        <LocationField value={location} onChange={setLocation} />
        <label htmlFor="radius">查找范围</label>
        <select
          id="radius"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
        >
          <option value="1">附近 1 公里</option>
          <option value="5">附近 5 公里</option>
          <option value="10">附近 10 公里</option>
          <option value="20">附近 20 公里</option>
        </select>
        <p>
          <button disabled={busy}>
            {busy ? "正在挑选好味道…" : "帮我选一餐"}
          </button>
        </p>
        <p className="error" role="alert">
          {error}
        </p>
        <p className="muted" role="status">
          {busy ? "正在读取附近记录，预计需要几秒钟。" : ""}
        </p>
      </form>
      {result && (
        <div style={{ marginTop: 28 }}>
          <RecommendResult {...result} />
        </div>
      )}
    </>
  );
}
