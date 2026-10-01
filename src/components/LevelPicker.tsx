"use client";

import React, { useState } from "react";
import { Card, SectionHeading, PhysicalButton } from "./ui";

const LEVELS = [
  { id: "A1", name: "Iniciante", hint: "Entendo e uso frases bem simples do dia a dia." },
  { id: "A2", name: "Básico", hint: "Me viro em situações comuns: compras, rotina, viagem." },
  { id: "B1", name: "Intermediário", hint: "Converso sobre assuntos conhecidos, com alguns tropeços." },
  { id: "B2", name: "Intermediário Superior", hint: "Converso com fluência sobre vários temas e entendo bem." },
  { id: "C1", name: "Avançado", hint: "Uso o inglês com facilidade no trabalho e nos estudos." },
  { id: "C2", name: "Proficiente", hint: "Entendo praticamente tudo e me expresso com precisão." },
];

// Para quem se cadastrou sozinho: escolhe o nível inicial uma única vez. O
// admin continua podendo ajustar depois pelo painel.
export function LevelPicker({ onSaved }: { onSaved: (level: string) => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!picked) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/profile/level", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: picked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.level);
    } catch (e: any) {
      setError(e?.message || "Não foi possível salvar agora. Tente de novo.");
      setSaving(false);
    }
  }

  return (
    <Card style={{ marginBottom: 20 }}>
      <SectionHeading>Qual é o seu nível de inglês?</SectionHeading>
      <p style={{ margin: "4px 0 12px", fontSize: 13, color: "var(--muted)" }}>
        Escolha o que mais combina com você hoje. As aulas vão se ajustar a esse nível.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {LEVELS.map((l) => {
          const sel = picked === l.id;
          return (
            <button
              key={l.id}
              onClick={() => setPicked(l.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: 14,
                border: sel ? "1.5px solid var(--teal)" : "1px solid var(--line)",
                background: sel ? "rgba(246,160,23,.12)" : "#fbf8f1",
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "inherit",
                color: "var(--ink)",
              }}
            >
              <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 700, fontSize: 15, width: 30, flexShrink: 0 }}>{l.id}</span>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{l.name}</span>
                <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.35 }}>{l.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
      {error && <div style={{ fontSize: 13, color: "#8d2438", marginBottom: 10 }}>{error}</div>}
      <PhysicalButton onClick={save} disabled={!picked || saving} background="var(--teal)" color="var(--ink)" shadowColor="var(--mustard)">
        {saving ? "Salvando…" : "Começar com este nível"}
      </PhysicalButton>
    </Card>
  );
}
