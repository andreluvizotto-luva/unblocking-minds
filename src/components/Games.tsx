"use client";

import React, { useEffect, useState } from "react";
import { PhysicalButton, ProcessingAnimation, playAdvanceSound, playCheckSound } from "./ui";
import { GUESS_COST_PER_CLUE, GUESS_MAX_SCORE, guessPointsFor, normalizeName } from "@/lib/games";

// Grava a partida no recorde/histórico. Falha aqui nunca pode estragar o
// fim do jogo para o aluno — no pior caso a partida só não entra no
// histórico (ex: tabela ainda não criada no banco).
export async function saveScore(game: "quiz" | "guess" | "trivia" | "words", score: number, detail: Record<string, unknown>) {
  try {
    await fetch("/api/games/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, score, detail }),
    });
  } catch {
    // ignorado de propósito
  }
}

export const kicker: React.CSSProperties = {
  fontFamily: "'Work Sans', sans-serif",
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--mustard-dark)",
};

export function ScorePill({ points }: { points: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 999,
        background: "rgba(246,160,23,.14)",
        border: "1px solid rgba(246,160,23,.45)",
        fontFamily: "'Work Sans', sans-serif",
        fontSize: 13,
        fontWeight: 600,
        color: "var(--mustard-dark)",
        whiteSpace: "nowrap",
      }}
    >
      {points} pts
    </span>
  );
}

export function ErrorBox({ message, onRetry, onExit }: { message: string; onRetry: () => void; onExit: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 14, color: "var(--wine)", lineHeight: 1.5 }}>{message}</p>
      <PhysicalButton onClick={onRetry} background="var(--teal)" color="var(--ink)" shadowColor="var(--mustard)">
        Tentar de novo
      </PhysicalButton>
      <button onClick={onExit} style={linkButton}>
        Voltar aos games
      </button>
    </div>
  );
}

export const linkButton: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--muted)",
  fontSize: 13,
  textDecoration: "underline",
  cursor: "pointer",
  padding: "6px 0",
  fontFamily: "inherit",
};

// ---------- Quiz ----------
export function QuizGame({ onExit, variant = "quiz" }: { onExit: () => void; variant?: "quiz" | "trivia" }) {
  const trivia = variant === "trivia";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState<any[]>([]);
  const [points, setPoints] = useState(10);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    setIdx(0);
    setPicked(null);
    setScore(0);
    setCorrect(0);
    setFinished(false);
    try {
      const res = await fetch(trivia ? "/api/games/trivia" : "/api/games/quiz", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQuestions(data.questions || []);
      setPoints(data.pointsPerQuestion || 10);
    } catch (e: any) {
      setError(e?.message || `Não foi possível montar o ${trivia ? "trivia" : "quiz"} agora. Tente de novo em alguns instantes.`);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <ProcessingAnimation
        title={trivia ? "Montando o seu trivia…" : "Montando o seu quiz…"}
        messages={
          trivia
            ? ["Did you know? Buscando curiosidades…", "Misturando os temas…", "Quase lá…"]
            : ["Speed up guys! Separando as perguntas…", "Calibrando pro seu nível…", "Quase lá…"]
        }
      />
    );
  }
  if (error) return <ErrorBox message={error} onRetry={load} onExit={onExit} />;

  if (finished) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "center" }}>
        <span style={kicker}>{trivia ? "Trivia concluído" : "Quiz concluído"}</span>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 52, fontWeight: 700, lineHeight: 1, color: "var(--ink)" }}>{score}</div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--muted)" }}>
          pontos · {correct} de {questions.length} certas
        </p>
        <PhysicalButton onClick={load} background="var(--teal)" color="var(--ink)" shadowColor="var(--mustard)">
          Jogar de novo
        </PhysicalButton>
        <button onClick={onExit} style={linkButton}>
          Voltar aos games
        </button>
      </div>
    );
  }

  const q = questions[idx];
  const answered = picked !== null;
  const isRight = answered && picked === q.answerIndex;
  const isLast = idx === questions.length - 1;

  function pick(i: number) {
    if (answered) return;
    playCheckSound();
    setPicked(i);
    if (i === q.answerIndex) {
      setScore((s) => s + points);
      setCorrect((c) => c + 1);
    }
  }

  function next() {
    playAdvanceSound();
    if (isLast) {
      setFinished(true);
      saveScore(variant, score, {
        correct,
        total: questions.length,
        ...(trivia ? { seen: questions.map((x: any) => String(x.q).slice(0, 90)) } : {}),
      });
    } else {
      setIdx(idx + 1);
      setPicked(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={kicker}>
          Pergunta {idx + 1} de {questions.length}
          {trivia && q.category ? ` · ${q.category}` : ""}
        </span>
        <ScorePill points={score} />
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "#e6e1d4", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 999, background: "var(--teal)", width: `${((idx + (answered ? 1 : 0)) / questions.length) * 100}%`, transition: "width .4s" }} />
      </div>

      <p style={{ margin: 0, fontFamily: "'Poppins', sans-serif", fontSize: 18, lineHeight: 1.35, fontWeight: 600, letterSpacing: "-0.01em" }}>{q.q}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {(q.options || []).map((opt: string, oi: number) => {
          const isChosen = picked === oi;
          const isCorrectOpt = answered && oi === q.answerIndex;
          const isWrongChosen = answered && isChosen && oi !== q.answerIndex;
          let bg = "#fffdf7", border = "rgba(16,20,58,.14)", badgeBg = "#efeade", badgeColor = "#7d7768", mark = String.fromCharCode(65 + oi);
          let textColor = "var(--ink)";
          if (isCorrectOpt) {
            bg = "rgba(37,211,102,.16)"; border = "#1a7a44"; badgeBg = "#1a7a44"; badgeColor = "var(--ink-on-dark)"; mark = "✓";
          } else if (isWrongChosen) {
            bg = "rgba(194,54,83,.12)"; border = "var(--wine)"; badgeBg = "var(--wine)"; badgeColor = "var(--ink-on-dark)"; mark = "✕"; textColor = "#8d2438";
          } else if (answered) {
            textColor = "var(--muted)"; border = "rgba(16,20,58,.08)";
          }
          return (
            <button
              key={oi}
              onClick={() => pick(oi)}
              disabled={answered}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                textAlign: "left",
                width: "100%",
                minHeight: 54,
                padding: "10px 14px",
                borderRadius: 16,
                border: `2px solid ${border}`,
                background: bg,
                cursor: answered ? "default" : "pointer",
                fontFamily: "inherit",
                transition: "background .2s, border-color .2s",
              }}
            >
              <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, background: badgeBg, color: badgeColor, display: "grid", placeItems: "center", fontSize: 13, fontWeight: 600 }}>
                {mark}
              </span>
              <span style={{ fontSize: 15.5, lineHeight: 1.35, color: textColor }}>{opt}</span>
            </button>
          );
        })}
      </div>

      {answered && (
        <div style={{ borderRadius: 14, padding: "13px 15px", background: isRight ? "rgba(37,211,102,.14)" : "rgba(194,54,83,.1)", display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: isRight ? "#14663a" : "#8d2438" }}>{isRight ? `Certo! +${points}` : "Vamos de novo"}</span>
          {q.explanation && <span style={{ fontSize: 13.5, lineHeight: 1.45, color: isRight ? "#14663a" : "#8d2438" }}>{q.explanation}</span>}
        </div>
      )}

      {answered && (
        <PhysicalButton onClick={next} background="#283758" color="var(--ink-on-dark)" shadowColor="#10143a">
          {isLast ? "Ver resultado →" : "Próxima pergunta →"}
        </PhysicalButton>
      )}
    </div>
  );
}

// ---------- Quem é? ----------

// Compara o palpite com o nome sem exigir grafia perfeita: ignora
// maiúsculas, acentos e pontuação (normalizeName), e tolera pequenos erros
// de digitação ("ainstein" vale para Einstein). Também aceita só o
// sobrenome.
function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

export function isCorrectGuess(guess: string, name: string, aliases: string[]) {
  const g = normalizeName(guess);
  if (!g) return false;
  const candidates = new Set<string>();
  for (const c of [name, ...aliases]) {
    const n = normalizeName(c);
    if (!n) continue;
    candidates.add(n);
    // Sobrenome sozinho também vale ("Einstein"), desde que não seja curto
    // demais para virar um acerto por acaso.
    const last = n.split(" ").pop() || "";
    if (last.length >= 4) candidates.add(last);
  }
  for (const c of Array.from(candidates)) {
    const tolerance = c.length <= 4 ? 0 : c.length <= 8 ? 1 : 2;
    if (levenshtein(g, c) <= tolerance) return true;
  }
  return false;
}

export function GuessGame({ onExit }: { onExit: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [round, setRound] = useState<{ name: string; aliases: string[]; clues: string[]; reveal: string } | null>(null);
  const [shown, setShown] = useState(1);
  const [guess, setGuess] = useState("");
  const [wrongFeedback, setWrongFeedback] = useState("");
  const [result, setResult] = useState<{ solved: boolean; points: number } | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    setShown(1);
    setGuess("");
    setWrongFeedback("");
    setResult(null);
    try {
      const res = await fetch("/api/games/guess", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRound(data);
    } catch (e: any) {
      setError(e?.message || "Não foi possível escolher uma personalidade agora. Tente de novo em alguns instantes.");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <ProcessingAnimation
        title="Escolhendo uma personalidade…"
        messages={["Who could it be? Pensando em alguém…", "Escrevendo as dicas…", "Quase lá…"]}
      />
    );
  }
  if (error || !round) return <ErrorBox message={error} onRetry={load} onExit={onExit} />;

  const currentPoints = guessPointsFor(shown);

  function finish(solved: boolean) {
    const pts = solved ? currentPoints : 0;
    setResult({ solved, points: pts });
    saveScore("guess", pts, { name: round!.name, cluesShown: shown, solved });
  }

  function submitGuess() {
    if (!guess.trim()) {
      setWrongFeedback("Escreva um nome primeiro.");
      return;
    }
    if (isCorrectGuess(guess, round!.name, round!.aliases)) {
      playAdvanceSound();
      finish(true);
    } else {
      playCheckSound();
      setWrongFeedback(`Ainda não é "${guess.trim()}". Tente de novo${shown < round!.clues.length ? " ou peça mais uma dica" : ""}.`);
    }
  }

  function moreClue() {
    if (shown >= round!.clues.length) return;
    playCheckSound();
    setShown(shown + 1);
    setWrongFeedback("");
  }

  if (result) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "center" }}>
        <span style={kicker}>{result.solved ? "Você acertou!" : "Era…"}</span>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 26, fontWeight: 600, color: "var(--ink)" }}>{round.name}</div>
        {round.reveal && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>{round.reveal}</p>}
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 44, fontWeight: 700, lineHeight: 1, color: "var(--ink)", marginTop: 4 }}>{result.points}</div>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)" }}>
          pontos{result.solved ? ` · com ${shown} dica${shown > 1 ? "s" : ""}` : ""}
        </p>
        <PhysicalButton onClick={load} background="var(--teal)" color="var(--ink)" shadowColor="var(--mustard)">
          Jogar de novo
        </PhysicalButton>
        <button onClick={onExit} style={linkButton}>
          Voltar aos games
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={kicker}>
          Dica {shown} de {round.clues.length}
        </span>
        <ScorePill points={currentPoints} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {round.clues.slice(0, shown).map((clue, i) => (
          <div
            key={i}
            style={{
              borderLeft: "4px solid var(--sage)",
              background: i === shown - 1 ? "rgba(79,98,72,.12)" : "rgba(79,98,72,.06)",
              borderRadius: "0 14px 14px 0",
              padding: "12px 14px",
              fontSize: 15.5,
              lineHeight: 1.5,
              color: "#1d2340",
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 2 }}>Dica {i + 1}</span>
            {clue}
          </div>
        ))}
      </div>

      <input
        value={guess}
        onChange={(e) => {
          setGuess(e.target.value);
          setWrongFeedback("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submitGuess();
        }}
        placeholder="Who is it? Escreva o nome"
        style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", fontSize: 15, fontFamily: "inherit", color: "var(--ink)", background: "#fff" }}
      />
      {wrongFeedback && <p style={{ margin: "-8px 0 0", fontSize: 13, color: "#8d2438" }}>{wrongFeedback}</p>}

      <PhysicalButton onClick={submitGuess} background="var(--teal)" color="var(--ink)" shadowColor="var(--mustard)">
        Chutar
      </PhysicalButton>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {shown < round.clues.length ? (
          <button
            onClick={moreClue}
            style={{
              padding: "9px 14px",
              borderRadius: 999,
              border: "1px solid var(--line)",
              background: "#fbf8f1",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--ink)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Pedir outra dica (−{GUESS_COST_PER_CLUE} pts)
          </button>
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Todas as dicas já foram reveladas.</span>
        )}
        <button onClick={() => finish(false)} style={linkButton}>
          Desistir e ver quem é
        </button>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
        Começa valendo {GUESS_MAX_SCORE} pontos · cada dica a mais tira {GUESS_COST_PER_CLUE}
      </p>
    </div>
  );
}

