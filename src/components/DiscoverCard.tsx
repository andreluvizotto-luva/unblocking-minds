"use client";

import React, { useEffect, useState } from "react";
import { Card, SectionHeading } from "./ui";

type Item = { title: string; url: string; by?: string; source?: string; summary?: string };
type Data = { video: Item; song: Item; article: Item | null };

const ROWS: { key: keyof Data; label: string; bg: string; icon: React.ReactNode }[] = [
  {
    key: "video",
    label: "TED Talk",
    bg: "var(--coral)",
    icon: <polygon points="6 4 20 12 6 20 6 4" />,
  },
  {
    key: "article",
    label: "News article",
    bg: "var(--sage)",
    icon: (
      <>
        <path d="M4 5h13v14H6a2 2 0 0 1-2-2V5z" />
        <path d="M17 9h3v8a2 2 0 0 1-2 2h-1" />
        <line x1="8" y1="9" x2="13" y2="9" />
        <line x1="8" y1="13" x2="13" y2="13" />
      </>
    ),
  },
  {
    key: "song",
    label: "Song",
    bg: "var(--mustard)",
    icon: (
      <>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </>
    ),
  },
];

export function DiscoverCard({ level }: { level: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [n, setN] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/discover?level=${encodeURIComponent(level)}&n=${n}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [level, n]);

  if (failed && !data) return null;

  return (
    <Card style={{ marginBottom: 22 }}>
      <SectionHeading>Discover</SectionHeading>
      <p style={{ margin: "4px 0 10px", fontSize: 12.5, color: "var(--muted)" }}>Free English content picked for your level.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ROWS.map((r) => {
          const item = data?.[r.key] as Item | null | undefined;
          if (data && !item) return null;
          const sub = item ? [item.by || item.source, item.summary].filter(Boolean).join(" · ") : "";
          return (
            <a
              key={r.key}
              href={item?.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!item}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: 16,
                border: "1px solid var(--line)",
                background: "#fbf8f1",
                textDecoration: "none",
                color: "var(--ink)",
                pointerEvents: item ? "auto" : "none",
              }}
            >
              <span style={{ width: 36, height: 36, borderRadius: 999, background: r.bg, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {r.icon}
                </svg>
              </span>
              <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--muted)" }}>{r.label}</span>
                <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>{item ? item.title : "Loading…"}</span>
                {sub && (
                  <span
                    style={{
                      fontSize: 11.5,
                      lineHeight: 1.35,
                      color: "var(--muted)",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {sub}
                  </span>
                )}
              </span>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="M7 17L17 7" />
                <polyline points="8 7 17 7 17 16" />
              </svg>
            </a>
          );
        })}
      </div>
      <button
        onClick={() => setN((v) => v + 1)}
        style={{ marginTop: 12, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "var(--ink)", textDecoration: "underline" }}
      >
        See other suggestions
      </button>
    </Card>
  );
}
