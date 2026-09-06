"use client";

import React, { useEffect, useState } from "react";
import { Card, Button } from "./ui";

const PHASES: { label: string; seconds: number }[] = [
  { label: "Inspire", seconds: 4 },
  { label: "Segure", seconds: 4 },
  { label: "Expire", seconds: 4 },
  { label: "Segure", seconds: 4 },
];

const TOTAL_CYCLES = 2;

// Ritual de respiração consciente ("Box Breathing") antes de falar —
// baseado no método Respire, Fale e Desbloqueie da Unblocking Minds.
export function BreathingRitual({ onDone }: { onDone: () => void }) {
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [count, setCount] = useState(PHASES[0].seconds);
  const [cycle, setCycle] = useState(1);
  const [running, setRunning] = useState(true);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!running || finished) return;
    const t = setTimeout(() => {
      if (count > 1) {
        setCount((c) => c - 1);
        return;
      }
      // avança de fase
      const nextIdx = (phaseIdx + 1) % PHASES.length;
      if (nextIdx === 0) {
        if (cycle >= TOTAL_CYCLES) {
          setFinished(true);
          return;
        }
        setCycle((c) => c + 1);
      }
      setPhaseIdx(nextIdx);
      setCount(PHASES[nextIdx].seconds);
    }, 1000);
    return () => clearTimeout(t);
  }, [count, phaseIdx, cycle, running, finished]);

  const phase = PHASES[phaseIdx];
  const scale = phase.label === "Inspire" ? 1.15 : phase.label === "Expire" ? 0.85 : 1;

  return (
    <Card style={{ marginBottom: 14, background: "var(--sage)", color: "#fbf8f1", textAlign: "center", padding: "28px 20px" }}>
      <div
        style={{
          display: "inline-block",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          background: "var(--coral)",
          color: "var(--ink)",
          borderRadius: 20,
          padding: "4px 14px",
          marginBottom: 14,
        }}
      >
        RITUAL DE RESPIRAÇÃO
      </div>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 17, marginBottom: 4 }}>
        Antes de falar, vamos respirar juntos
      </div>
      <div style={{ fontSize: 12.5, opacity: 0.85, marginBottom: 22 }}>
        Sua voz precisa de apoio. Respirar bem ajuda a desbloquear a fala espontânea.
      </div>

      {!finished ? (
        <>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              border: "2px solid rgba(255,255,255,0.6)",
              margin: "0 auto 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${scale})`,
              transition: "transform 1s linear",
            }}
          >
            <span style={{ fontSize: 22, fontWeight: 700 }}>{count}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{phase.label}</div>
          <div style={{ fontSize: 11.5, opacity: 0.75, marginBottom: 18 }}>
            ciclo {cycle} de {TOTAL_CYCLES}
          </div>
          <button
            onClick={onDone}
            style={{
              background: "none",
              border: "none",
              color: "#fbf8f1",
              textDecoration: "underline",
              fontSize: 12,
              cursor: "pointer",
              opacity: 0.85,
            }}
          >
            Pular ritual
          </button>
        </>
      ) : (
        <Button onClick={onDone} style={{ padding: "11px 26px" }}>
          Pronta(o) para falar
        </Button>
      )}
    </Card>
  );
}
