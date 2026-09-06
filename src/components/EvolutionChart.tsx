"use client";

import React, { useState } from "react";

// Paleta categórica (ver skill de dataviz do projeto) — ordem fixa, nunca ciclada.
const SERIES = [
  { key: "reading", label: "Leitura", color: "#2a78d6" },
  { key: "grammar", label: "Gramática", color: "#c23653" },
  { key: "listening", label: "Escuta", color: "#eb6834" },
  { key: "speaking", label: "Fala", color: "#1baf7a" },
  { key: "writing", label: "Escrita", color: "#eda100" },
  { key: "overall", label: "Nota geral", color: "#4a3aa7" },
] as const;

type Point = {
  date: string; // rótulo curto para o eixo X
  reading?: number;
  grammar?: number;
  listening?: number;
  speaking?: number;
  writing?: number;
  overall?: number;
};

const W = 640;
const H = 280;
const PAD_L = 32;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 34;

export function EvolutionChart({ points }: { points: Point[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (points.length < 2) {
    return (
      <div style={{ fontSize: 13, color: "var(--muted)", padding: "24px 4px" }}>
        Complete mais aulas para começar a ver seu gráfico de evolução aqui.
      </div>
    );
  }

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n = points.length;
  const x = (i: number) => PAD_L + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => PAD_T + plotH - (Math.max(0, Math.min(10, v)) / 10) * plotH;

  // Rótulos do eixo X: mostra no máximo ~7, sempre incluindo o primeiro e o último
  const maxTicks = 7;
  const step = Math.max(1, Math.ceil(n / maxTicks));
  const xTicks = points.map((_, i) => i).filter((i) => i === 0 || i === n - 1 || i % step === 0);

  // Curva suave (Catmull-Rom convertida em Bézier cúbica) em vez de segmentos
  // retos — mais elegante, sem distorcer os valores reais nos pontos.
  function smoothPath(pts: { x: number; y: number }[]) {
    if (pts.length < 2) return "";
    if (pts.length === 2) {
      return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
    }
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
  }

  function linePath(key: (typeof SERIES)[number]["key"]) {
    // Divide em segmentos contínuos (sem "furos" onde não há dado) e suaviza
    // cada um separadamente, para não interpolar por cima de um valor ausente.
    const segments: { x: number; y: number }[][] = [];
    let current: { x: number; y: number }[] = [];
    points.forEach((p, i) => {
      const v = (p as any)[key];
      if (typeof v !== "number") {
        if (current.length) segments.push(current);
        current = [];
        return;
      }
      current.push({ x: x(i), y: y(v) });
    });
    if (current.length) segments.push(current);
    return segments.map((seg) => smoothPath(seg)).join(" ");
  }

  // Rótulos de valor no fim de cada linha, empilhados sem colidir
  const endLabels = SERIES.map((s) => {
    for (let i = n - 1; i >= 0; i--) {
      const v = (points[i] as any)[s.key];
      if (typeof v === "number") return { ...s, value: v, i };
    }
    return null;
  }).filter(Boolean) as { key: string; label: string; color: string; value: number; i: number }[];
  endLabels.sort((a, b) => b.value - a.value);
  const minGap = 13;
  for (let k = 1; k < endLabels.length; k++) {
    const prevY = y(endLabels[k - 1].value);
    let curY = y(endLabels[k].value);
    if (curY - prevY < minGap) {
      (endLabels[k] as any)._y = prevY + minGap;
    }
  }

  const hover = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div style={{ position: "relative" }}>
      {/* Legenda */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginBottom: 10 }}>
        {SERIES.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />
            <span style={{ color: "var(--muted)" }}>{s.label}</span>
          </div>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", overflow: "visible" }}
        onMouseMove={(e) => {
          const svg = e.currentTarget;
          const rect = svg.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * W;
          let closest = 0;
          let closestDist = Infinity;
          points.forEach((_, i) => {
            const d = Math.abs(x(i) - relX);
            if (d < closestDist) {
              closestDist = d;
              closest = i;
            }
          });
          setHoverIdx(closest);
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Gridlines horizontais 0/2/4/6/8/10 */}
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="#e1e0d9" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(v) + 3} fontSize={10} fill="#898781" textAnchor="end">
              {v}
            </text>
          </g>
        ))}

        {/* Eixo X */}
        {xTicks.map((i) => (
          <text key={i} x={x(i)} y={H - PAD_B + 16} fontSize={9.5} fill="#898781" textAnchor="middle">
            {points[i].date}
          </text>
        ))}

        {/* Crosshair */}
        {hoverIdx !== null && (
          <line x1={x(hoverIdx)} x2={x(hoverIdx)} y1={PAD_T} y2={H - PAD_B} stroke="#c3c2b7" strokeWidth={1} />
        )}

        {/* Linhas */}
        {SERIES.map((s) => (
          <path
            key={s.key}
            d={linePath(s.key)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.key === "overall" ? 4 : 3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* Ponto em destaque no hover */}
        {hoverIdx !== null &&
          SERIES.map((s) => {
            const v = (points[hoverIdx] as any)[s.key];
            if (typeof v !== "number") return null;
            return (
              <circle key={s.key} cx={x(hoverIdx)} cy={y(v)} r={5} fill={s.color} stroke="#fbf8f1" strokeWidth={2.5} />
            );
          })}

        {/* Rótulos de valor no fim das linhas */}
        {endLabels.map((el) => (
          <text
            key={el.key}
            x={x(el.i) + 6}
            y={((el as any)._y ?? y(el.value)) + 3}
            fontSize={10}
            fill="#52514e"
            textAnchor="start"
          >
            {el.value.toFixed(1)}
          </text>
        ))}
      </svg>

      {/* Tooltip */}
      {hover && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 4,
            padding: "8px 10px",
            fontSize: 11.5,
            minWidth: 130,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{hover.date}</div>
          {SERIES.map((s) => {
            const v = (hover as any)[s.key];
            if (typeof v !== "number") return null;
            return (
              <div key={s.key} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span style={{ color: "var(--muted)" }}>
                  <span style={{ color: s.color }}>●</span> {s.label}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{v.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
