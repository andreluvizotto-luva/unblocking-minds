"use client";

import React, { useEffect, useState } from "react";

type Info = { ask: boolean; level: string | null; up: string | null; down: string | null; suggested: string | null };
type Answer = "easy" | "ok" | "hard";

const OPTIONS: { id: Answer; label: string }[] = [
  { id: "easy", label: "Fácil" },
  { id: "ok", label: "No ponto" },
  { id: "hard", label: "Difícil" },
];

const SKILL_NAMES: Record<string, string> = {
  reading: "Leitura",
  grammar: "Gramática",
  listening: "Escuta",
  speaking: "Fala",
  writing: "Escrita",
};

const box: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 14,
  background: "#fffdf7",
  padding: "14px 16px",
  marginBottom: 20,
  position: "relative",
};

const linkBtn = (strong: boolean): React.CSSProperties => ({
  background: "none",
  border: "none",
  padding: 0,
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: strong ? 700 : 400,
  color: strong ? "var(--ink)" : "var(--muted)",
  textDecoration: strong ? "underline" : "none",
  cursor: "pointer",
});

function CloseX({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Fechar"
      style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", fontSize: 16, color: "var(--muted)", cursor: "pointer" }}
    >
      ×
    </button>
  );
}

// Aviso no relatório quando uma ou mais habilidades ficaram mais desafiadoras.
export function ChallengeNotice({ skills }: { skills: string[] | undefined }) {
  if (!skills?.length) return null;
  const names = skills.map((s) => SKILL_NAMES[s] || s);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
  return (
    <div style={{ ...box, background: "rgba(246,160,23,.10)", borderColor: "rgba(246,160,23,.45)", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>🚀</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>Mandou bem! Hora de subir o desafio</div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>
          Pelo seu ótimo desempenho, os exercícios de {list} vão ficar um pouco mais desafiadores a partir da próxima aula.
        </div>
      </div>
    </div>
  );
}

// Ajuste de nível do assinante no relatório: pergunta leve nas 3 primeiras
// aulas, ou sugestão de subir de nível depois de 5 aumentos de desafio. A
// troca só acontece se o aluno tocar em "Trocar".
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

  async function send(direction: "up" | "down" | "accept" | "decline") {
    if (!sessionId) return;
    setState("saving");
    try {
      const r = await fetch("/api/session/level-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, direction }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error();
      if (direction === "decline") {
        setState("kept");
        return;
      }
      setNewLevel(d.level);
      onLevelChange(d.level);
      setState("changed");
    } catch {
      setState("error");
    }
  }

  if (!info?.level || hidden) return null;

  const changedMsg = `Pronto! A próxima aula já vem no ${newLevel}. Se não combinar, fale com a gente que ajustamos.`;
  const errorMsg = "Não deu para trocar agora. Tente de novo mais tarde.";

  if (info.suggested) {
    return (
      <div style={box}>
        <CloseX onClick={() => setHidden(true)} />
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, paddingRight: 20 }}>Que tal subir para o {info.suggested}? ✨</div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--muted)" }}>
          {state === "changed"
            ? changedMsg
            : state === "kept"
              ? `Combinado, seguimos no ${info.level}. Os desafios continuam crescendo com você.`
              : state === "error"
                ? errorMsg
                : `Seus desafios já subiram várias vezes no ${info.level}. Parece uma boa hora para experimentar o próximo nível.`}
        </p>
        {state === "idle" && (
          <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
            <button onClick={() => send("accept")} style={linkBtn(true)}>
              Trocar para {info.suggested}
            </button>
            <button onClick={() => send("decline")} style={linkBtn(false)}>
              Continuar no {info.level}
            </button>
          </div>
        )}
        {state === "saving" && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted)" }}>Salvando…</p>}
      </div>
    );
  }

  if (!info.ask) return null;

  const target = answer === "easy" ? info.up : answer === "hard" ? info.down : null;

  let message: React.ReactNode = null;
  if (state === "changed") message = changedMsg;
  else if (state === "kept") message = `Combinado, seguimos no ${info.level}.`;
  else if (state === "error") message = errorMsg;
  else if (answer === "ok") message = `Que bom! Seguimos no ${info.level}.`;
  else if (answer === "easy")
    message = target ? `Parece que o ${info.level} já ficou confortável. Quer experimentar o ${target}?` : "Você já está no nível mais alto. Mandou bem!";
  else if (answer === "hard")
    message = target
      ? `Tudo bem, faz parte! Quer praticar um tempo no ${target} para ganhar confiança?`
      : "Faz parte do começo! O A1 é a base, e cada aula deixa tudo mais leve.";

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

  return (
    <div style={box}>
      <CloseX onClick={() => setHidden(true)} />
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
      {target && state === "idle" && (
        <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
          <button onClick={() => send(answer === "easy" ? "up" : "down")} style={linkBtn(true)}>
            Trocar para {target}
          </button>
          <button onClick={() => setState("kept")} style={linkBtn(false)}>
            Continuar no {info.level}
          </button>
        </div>
      )}
      {state === "saving" && <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--muted)" }}>Trocando…</p>}
    </div>
  );
}
