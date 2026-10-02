"use client";

import React, { useEffect, useState } from "react";

type Info = { ask: boolean; level: string | null; up: string | null; down: string | null };
type Answer = "easy" | "ok" | "hard";

const OPTIONS: { id: Answer; label: string }[] = [
  { id: "easy", label: "Fácil" },
  { id: "ok", label: "No ponto" },
  { id: "hard", label: "Difícil" },
];

// Pergunta leve no relatório das primeiras aulas do assinante: a aula está
// no nível certo? Responder é opcional; a troca de nível só acontece se o
// aluno tocar em "Trocar".
export function LevelCheck({ sessionId, onLevelChange }: { sessionId: string | null; onLevelChange: (level: string) => void }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "changed" | "kept" | "error">("idle");
  const [newLevel, setNewLevel] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/session/level-check?sessionId=${encodeURIComponent(sessionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setInfo)
      .catch(() => {});
  }, [sessionId]);

  if (!info?.ask || !info.level || hidden) return null;

  const target = answer === "easy" ? info.up : answer === "hard" ? info.down : null;

  async function apply() {
    if (!target || !sessionId) return;
    setState("saving");
    try {
      const r = await fetch("/api/session/level-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, direction: answer === "easy" ? "up" : "down" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error();
      setNewLevel(d.level);
      onLevelChange(d.level);
      setState("changed");
    } catch {
      setState("error");
    }
  }

  let message: React.ReactNode = null;
  if (state === "changed") {
    message = `Pronto! A próxima aula já vem no ${newLevel}. Se não combinar, fale com a gente que ajustamos.`;
  } else if (state === "kept") {
    message = `Combinado, seguimos no ${info.level}.`;
  } else if (state === "error") {
    message = "Não deu para trocar agora. Tente de novo na próxima aula.";
  } else if (answer === "ok") {
    message = `Que bom! Seguimos no ${info.level}.`;
  } else if (answer === "easy") {
    message = target ? `Parece que o ${info.level} já ficou confortável. Quer experimentar o ${target}?` : "Você já está no nível mais alto. Mandou bem!";
  } else if (answer === "hard") {
    message = target
      ? `Tudo bem, faz parte! Quer praticar um tempo no ${target} para ganhar confiança?`
      : "Faz parte do começo! O A1 é a base, e cada aula deixa tudo mais leve.";
  }

  const pill = (sel: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "8px 0",
    borderRadius: 999,
    border: sel ? "1.5px solid var(--teal)" : "1px solid var(--line)",
    background: sel ? "rgba(246,160,23,.14)" : "#fff",
    fontFamily: "inherit",
    fontSize: 13.5,
    fontWeight: 600,
    color: "var(--ink)",
    cursor: "pointer",
  });

  const showActions = target && state === "idle";

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 14, background: "#fffdf7", padding: "14px 16px", marginBottom: 20, position: "relative" }}>
      <button
        onClick={() => setHidden(true)}
        aria-label="Fechar"
        style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", fontSize: 16, color: "var(--muted)", cursor: "pointer" }}
      >
        ×
      </button>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, paddingRight: 20 }}>Como foi a aula de hoje no {info.level}?</div>
      <div style={{ display: "flex", gap: 8 }}>
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => {
              if (state === "changed" || state === "saving") return;
              setAnswer(o.id);
              setState("idle");
            }}
            style={pill(answer === o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {message && <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>{message}</p>}
      {showActions && (
        <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
          <button onClick={apply} style={{ background: "none", border: "none", padding: 0, fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "var(--ink)", textDecoration: "underline", cursor: "pointer" }}>
            Trocar para {target}
          </button>
          <button onClick={() => setState("kept")} style={{ background: "none", border: "none", padding: 0, fontFamily: "inherit", fontSize: 13, color: "var(--muted)", cursor: "pointer" }}>
            Continuar no {info.level}
          </button>
        </div>
      )}
      {state === "saving" && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted)" }}>Trocando…</p>}
    </div>
  );
}
