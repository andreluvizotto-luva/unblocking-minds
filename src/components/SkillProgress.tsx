"use client";

import React from "react";
import { SKILL_COLORS } from "@/components/EvolutionChart";

export const SKILL_ORDER = ["reading", "grammar", "listening", "speaking", "writing"] as const;
export const SKILL_NAMES: Record<string, string> = {
  reading: "Leitura",
  grammar: "Gramática",
  listening: "Escuta",
  speaking: "Fala",
  writing: "Escrita",
};

export type LessonPoint = { ts: number; date: string; scores: Record<string, unknown> };

// Cada aula só traz nota das habilidades que treinou (o formato decide),
// então toda conta por habilidade usa apenas as aulas que tiveram aquela
// habilidade — comparar aula a aula misturaria formatos diferentes.
export function skillValues(points: LessonPoint[], key: string) {
  return points
    .filter((p) => typeof p.scores?.[key] === "number")
    .map((p) => ({ ts: p.ts, date: p.date, value: p.scores[key] as number }));
}

const avg = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const fmt = (v: number) => v.toFixed(1).replace(".", ",");

export function skillTrend(values: number[]) {
  if (values.length < 4) return null;
  const recent = values.slice(-3);
  const before = values.slice(-6, -3);
  return avg(recent) - avg(before);
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 72;
  const h = 26;
  const v = values.slice(-10);
  if (v.length < 2) return <div style={{ width: w }} />;
  const x = (i: number) => 3 + (i / (v.length - 1)) * (w - 6);
  const y = (n: number) => 3 + (1 - Math.max(0, Math.min(10, n)) / 10) * (h - 6);
  const d = v.map((n, i) => `${i ? "L" : "M"} ${x(i).toFixed(1)} ${y(n).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ flexShrink: 0 }}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(v.length - 1)} cy={y(v[v.length - 1])} r={2.8} fill={color} />
    </svg>
  );
}

export function SkillCards({
  points,
  selected,
  onSelect,
}: {
  points: LessonPoint[];
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {SKILL_ORDER.map((key) => {
        const series = skillValues(points, key).map((s) => s.value);
        const color = SKILL_COLORS[key];
        const active = selected === key;
        const has = series.length > 0;
        const current = has ? avg(series.slice(-5)) : null;
        const trend = skillTrend(series);
        return (
          <button
            key={key}
            type="button"
            disabled={!has}
            onClick={() => onSelect(active ? null : key)}
            aria-pressed={active}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: 3,
              cursor: has ? "pointer" : "default",
              font: "inherit",
              color: "var(--ink)",
              background: active ? "#fff" : "#fbf8f1",
              border: active ? `1.5px solid ${color}` : "1px solid var(--line)",
              opacity: has ? 1 : 0.55,
            }}
          >
            <span style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: color, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{SKILL_NAMES[key]}</div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 1 }}>
                {!has
                  ? "Ainda sem aulas"
                  : trend === null
                    ? `${series.length} ${series.length === 1 ? "aula" : "aulas"}`
                    : Math.abs(trend) < 0.3
                      ? "Estável"
                      : (
                          <span style={{ color: trend > 0 ? "var(--sage)" : "var(--coral)", fontWeight: 600 }}>
                            {trend > 0 ? "↑" : "↓"} {fmt(Math.abs(trend))} {trend > 0 ? "de alta" : "de queda"}
                          </span>
                        )}
              </div>
            </div>
            <Sparkline values={series} color={color} />
            <div style={{ width: 42, textAlign: "right", fontFamily: "'Poppins', sans-serif", fontSize: 19, fontWeight: 600 }}>
              {current === null ? "—" : fmt(current)}
            </div>
          </button>
        );
      })}
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
        Média das últimas 5 aulas de cada habilidade. Toque numa habilidade para ver o gráfico.
      </div>
    </div>
  );
}
