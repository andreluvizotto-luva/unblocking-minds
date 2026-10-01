"use client";

import React, { useState } from "react";

// Paleta categórica (ver skill de dataviz do projeto) — ordem fixa, nunca ciclada.
const ALL_SERIES = [
  { key: "reading", label: "Leitura", color: "#2a78d6" },
  { key: "grammar", label: "Gramática", color: "#c23653" },
  { key: "listening", label: "Escuta", color: "#eb6834" },
  { key: "speaking", label: "Fala", color: "#1baf7a" },
  { key: "writing", label: "Escrita", color: "#eda100" },
  { key: "overall", label: "Nota geral", color: "#4a3aa7" },
] as const;

export const SKILL_COLORS: Record<string, string> = Object.fromEntries(ALL_SERIES.map((s) => [s.key, s.color]));

type Point = {
  date: string; // rótulo curto para o eixo X
  reading?: number;
  grammar?: number;
  listening?: number;
  speaking?: number;
  writing?: number;
  overall?: number;
};

const W = 400;
const H = 220;
const PAD_L = 32;
const PAD_R = 30;
const PAD_T = 16;
const PAD_B = 30;

// `only` mostra uma habilidade por vez (a chave de ALL_SERIES); sem ele,
// todas as linhas. Com seis linhas juntas o gráfico fica difícil de ler no
// celular.
export function EvolutionChart({ points, only }: { points: Point[]; only?: string }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const SERIES = only && only !== "all" ? ALL_SERIES.filter((s) => s.key === only) : ALL_SERIES;

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

  // Rótulos do eixo X: mostra no máximo ~5, sempre incluindo o primeiro e o último
  const maxTicks = 5;
  const step = Math.max(1, Math.ceil(n / maxTicks));
  // Várias aulas no mesmo dia repetiriam a data no eixo: só a primeira leva rótulo.
  const xTicks = points
    .map((_, i) => i)
    .filter((i) => i === 0 || i === n - 1 || i % step === 0)
    .filter((i, k, arr) => k === 0 || points[i].date !== points[arr[k - 1]].date);

  // Segmentos retos: curva suavizada passava por valores que não existiram
  // entre uma aula e outra (chegava a "afundar" abaixo das notas reais).
  function straightPath(pts: { x: number; y: number }[]) {
    return pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  }

  function linePath(key: (typeof ALL_SERIES)[number]["key"]) {
    // Divide em segmentos contínuos, sem ligar por cima de um valor ausente.
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
    return segments.map((seg) => straightPath(seg)).join(" ");
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

  function pick(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
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
  }

  return (
    <div style={{ position: "relative" }}>
      {SERIES.length > 1 && <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginBottom: 10 }}>
        {SERIES.map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block" }} />
            <span style={{ color: "var(--muted)" }}>{s.label}</span>
          </div>
        ))}
      </div>}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", overflow: "visible", touchAction: "pan-y" }}
        onPointerDown={(e) => pick(e)}
        onPointerMove={(e) => pick(e)}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Gridlines horizontais 0/2/4/6/8/10 */}
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="#e1e0d9" strokeWidth={1} />
            <text x={PAD_L - 8} y={y(v) + 3} fontSize={13} fill="#898781" textAnchor="end">
              {v}
            </text>
          </g>
        ))}

        {/* Eixo X */}
        {xTicks.map((i) => (
          <text key={i} x={x(i)} y={H - PAD_B + 16} fontSize={13} fill="#898781" textAnchor="middle">
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

        {/* Um ponto por aula — com poucas aulas, a linha sozinha esconde onde está cada nota */}
        {SERIES.map((s) =>
          points.map((p, i) => {
            const v = (p as any)[s.key];
            if (typeof v !== "number") return null;
            return <circle key={`${s.key}-${i}`} cx={x(i)} cy={y(v)} r={SERIES.length > 1 ? 3 : 4.5} fill={s.color} />;
          })
        )}

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
            fontSize={13}
            fill="#52514e"
            textAnchor="start"
          >
            {el.value.toFixed(1).replace(".", ",")}
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
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{v.toFixed(1).replace(".", ",")}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
