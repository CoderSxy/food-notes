"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { safeNext } from "@/lib/auth/redirect";
import { requestJson } from "@/lib/browser";
import EntryForm from "@/components/EntryForm";
import type { Entry } from "@/lib/entries";

export default function EditEntry({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [from, setFrom] = useState("/entries?scope=mine");

  useEffect(() => {
    setFrom(
      safeNext(
        new URLSearchParams(window.location.search).get("from") ||
          "/entries?scope=mine",
      ),
    );
    let active = true;
    Promise.all([
      requestJson<{ entry: Entry }>(`/api/entries/${encodeURIComponent(id)}`),
      requestJson<{ user: { userId: string } }>("/api/auth/me"),
    ])
      .then(([body, me]) => {
        if (!active) return;
        setEntry(body.entry);
        setUserId(me.user.userId);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const owner = entry && entry.user_id === userId;

  return (
    <>
      <div className="narrow page-intro">
        <h1>编辑记录</h1>
        <p className="muted">
          {entry
            ? entry.kind === "place"
              ? "修改这条餐饮。"
              : "修改这件物品。"
            : "正在加载记录…"}
        </p>
        <p>
          <Link href={from}>取消</Link>
        </p>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {entry && !owner && userId && (
        <p className="error" role="alert">
          只能编辑自己的记录
        </p>
      )}
      {entry && owner && <EntryForm mode="edit" entry={entry} />}
    </>
  );
}
