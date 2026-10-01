"use client";

import React, { useEffect, useRef, useState } from "react";
import { PhysicalButton, ProcessingAnimation, playCheckSound } from "./ui";
import { ErrorBox, ScorePill, kicker, linkButton, saveScore } from "./Games";
import { wordPoints, WORDS_SECONDS, WORDS_MAX_SCORE } from "@/lib/games";

type Round = { letters: string[]; words: string[]; common: string[] };

function embaralhar(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function WordsGame({ onExit }: { onExit: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [round, setRound] = useState<Round | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [left, setLeft] = useState(WORDS_SECONDS);
  const [finished, setFinished] = useState(false);
  const savedRef = useRef(false);

  async function load() {
    setLoading(true);
    setError("");
    setPicked([]);
    setFound([]);
    setMessage(null);
    setLeft(WORDS_SECONDS);
    setFinished(false);
    savedRef.current = false;
    try {
      const res = await fetch("/api/games/words", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRound(data);
      setOrder(embaralhar(data.letters.length));
    } catch (e: any) {
      setError(e?.message || "Não foi possível sortear as letras agora. Tente de novo.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const score = Math.min(
    WORDS_MAX_SCORE,
    found.reduce((a, w) => a + wordPoints(w), 0)
  );

  function finish() {
    if (savedRef.current || !round) return;
    savedRef.current = true;
    setFinished(true);
    saveScore("words", score, { letters: round.letters.join(""), found: found.length, possible: round.words.length });
  }

  // Relógio da rodada: um tique por segundo; ao zerar, a partida acaba.
  useEffect(() => {
    if (loading || error || !round || finished) return;
    if (left <= 0) {
      finish();
      return;
    }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, loading, error, round, finished]);

  const current = round ? picked.map((i) => round.letters[i]).join("") : "";

  function addTile(i: number) {
    if (finished || picked.includes(i)) return;
    setPicked((p) => [...p, i]);
    setMessage(null);
  }

  function backspace() {
    setPicked((p) => p.slice(0, -1));
    setMessage(null);
  }

  function submit() {
    if (!round || finished) return;
    if (current.length < 3) {
      setMessage({ text: "Use pelo menos 3 letras.", ok: false });
      return;
    }
    if (found.includes(current)) {
      setMessage({ text: `"${current}" você já achou.`, ok: false });
    } else if (round.words.includes(current)) {
      playCheckSound();
      setFound((f) => [current, ...f]);
      setMessage({ text: `${current.toUpperCase()} +${wordPoints(current)}`, ok: true });
    } else {
      setMessage({ text: `"${current}" não está no dicionário.`, ok: false });
    }
    setPicked([]);
  }

  // Teclado físico: letras entram nas peças livres, Backspace apaga, Enter envia.
  const teclado = useRef<(e: KeyboardEvent) => void>(() => {});
  teclado.current = (e) => {
    if (!round || finished || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Backspace") {
      e.preventDefault();
      backspace();
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      const l = e.key.toLowerCase();
      const i = order.find((idx) => round.letters[idx] === l && !picked.includes(idx));
      if (i !== undefined) addTile(i);
    }
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => teclado.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (loading) {
    return (
      <ProcessingAnimation
        title="Sorteando as letras…"
        messages={["Shuffling the letters…", "Conferindo as palavras possíveis…", "Quase lá…"]}
      />
    );
  }
  if (error || !round) return <ErrorBox message={error} onRetry={load} onExit={onExit} />;

  if (finished) {
    const missed = round.common.filter((w) => !found.includes(w)).sort((a, b) => b.length - a.length || a.localeCompare(b));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "center" }}>
        <span style={kicker}>Fim da rodada</span>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 52, fontWeight: 700, lineHeight: 1, color: "var(--ink)" }}>{score}</div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
          pontos · {found.length} {found.length === 1 ? "palavra" : "palavras"} de {round.words.length} possíveis
        </p>
        {missed.length > 0 && (
          <div style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={kicker}>Palavras comuns que ficaram de fora</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {missed.slice(0, 18).map((w) => (
                <span key={w} style={{ padding: "5px 10px", borderRadius: 999, background: "#efeade", fontSize: 13.5, color: "var(--ink)" }}>
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}
        <PhysicalButton onClick={load} background="var(--teal)" color="var(--ink)" shadowColor="var(--mustard)">
          Jogar de novo
        </PhysicalButton>
        <button onClick={onExit} style={linkButton}>
          Voltar aos games
        </button>
      </div>
    );
  }

  const smallBtn: React.CSSProperties = {
    flex: 1,
    padding: "11px 0",
    borderRadius: 12,
    border: "1px solid var(--line)",
    background: "#fbf8f1",
    fontSize: 13.5,
    fontWeight: 500,
    color: "var(--ink)",
    cursor: "pointer",
    fontFamily: "inherit",
  };
  const urgent = left <= 15;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ ...kicker, color: urgent ? "var(--wine)" : "var(--mustard-dark)" }}>Tempo {fmtTime(left)}</span>
        <ScorePill points={score} />
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "#e6e1d4", overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            borderRadius: 999,
            background: urgent ? "var(--wine)" : "var(--teal)",
            width: `${(left / WORDS_SECONDS) * 100}%`,
            transition: "width 1s linear",
          }}
        />
      </div>

      <div
        style={{
          minHeight: 62,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 16,
          border: "2px dashed rgba(16,20,58,.18)",
          background: "#fffdf7",
          fontFamily: "'Poppins', sans-serif",
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink)",
        }}
      >
        {current || (
          <span style={{ fontSize: 14, fontWeight: 400, letterSpacing: 0, textTransform: "none", color: "var(--muted)" }}>
            Toque nas letras para formar uma palavra
          </span>
        )}
      </div>

      <div style={{ minHeight: 20, textAlign: "center", fontSize: 13.5, fontWeight: 600, color: message?.ok ? "#14663a" : "#8d2438" }}>
        {message?.text}
      </div>

      <div style={{ display: "flex", gap: 7 }}>
        {order.map((i) => {
          const used = picked.includes(i);
          return (
            <button
              key={i}
              onClick={() => addTile(i)}
              disabled={used}
              aria-label={round.letters[i]}
              style={{
                flex: 1,
                minWidth: 0,
                aspectRatio: "1 / 1.15",
                borderRadius: 12,
                border: "2px solid #283758",
                background: used ? "#e6e1d4" : "#283758",
                color: used ? "transparent" : "var(--ink-on-dark)",
                fontFamily: "'Poppins', sans-serif",
                fontSize: 22,
                fontWeight: 600,
                textTransform: "uppercase",
                cursor: used ? "default" : "pointer",
                opacity: used ? 0.5 : 1,
              }}
            >
              {round.letters[i]}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={backspace} style={smallBtn}>
          Apagar
        </button>
        <button
          onClick={() => {
            setOrder(embaralhar(round.letters.length));
            setPicked([]);
          }}
          style={smallBtn}
        >
          Embaralhar
        </button>
      </div>
      <PhysicalButton onClick={submit} background="var(--teal)" color="var(--ink)" shadowColor="var(--mustard)">
        Enviar palavra
      </PhysicalButton>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={kicker}>Suas palavras · {found.length}</span>
        {found.length === 0 ? (
          <span style={{ fontSize: 13, color: "var(--muted)" }}>Palavras de 3 a 7 letras. Quanto maior, mais pontos.</span>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {found.map((w) => (
              <span key={w} style={{ padding: "5px 10px", borderRadius: 999, background: "rgba(37,211,102,.16)", fontSize: 13.5, color: "#14663a", fontWeight: 500 }}>
                {w}
              </span>
            ))}
          </div>
        )}
      </div>

      <button onClick={finish} style={linkButton}>
        Terminar agora
      </button>
    </div>
  );
}
