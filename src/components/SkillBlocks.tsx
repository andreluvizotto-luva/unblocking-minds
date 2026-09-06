"use client";

import React, { useState, useEffect } from "react";
import { Card, Button, SectionLabel, useCloudSpeech, useAudioRecorder, ProcessingAnimation } from "./ui";
import { BreathingRitual } from "./BreathingRitual";
import { supabaseBrowser } from "@/lib/supabase-browser";

// Vozes da OpenAI TTS agrupadas por gênero — usadas para garantir que, nas
// aulas de Escuta comparativa (2 áudios), cada personagem soe com uma voz
// coerente com seu gênero, e que as duas vozes nunca sejam iguais entre si.
const MALE_VOICES = ["echo", "onyx", "fable"];
const FEMALE_VOICES = ["nova", "shimmer", "alloy"];
const ALL_VOICES = [...MALE_VOICES, ...FEMALE_VOICES];

function hashSeed(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function poolForGender(gender?: string) {
  if (gender === "male") return MALE_VOICES;
  if (gender === "female") return FEMALE_VOICES;
  return ALL_VOICES;
}

function pickComparisonVoices(genderA: string | undefined, genderB: string | undefined, seed: string) {
  const poolA = poolForGender(genderA);
  const voiceA = poolA[hashSeed(seed + "-a") % poolA.length];
  const poolBRaw = poolForGender(genderB).filter((v) => v !== voiceA);
  const poolB = poolBRaw.length > 0 ? poolBRaw : ALL_VOICES.filter((v) => v !== voiceA);
  const voiceB = poolB[hashSeed(seed + "-b") % poolB.length];
  return { voiceA, voiceB };
}

export const SKILL_META: Record<string, { label: string; icon: string }> = {
  reading: { label: "Leitura", icon: "📖" },
  grammar: { label: "Gramática", icon: "🧩" },
  listening: { label: "Escuta", icon: "🎧" },
  speaking: { label: "Fala", icon: "🎙️" },
  writing: { label: "Escrita", icon: "✍️" },
};

// Renderiza uma frase com lacuna: "before" + espaço em branco + "after".
// Usada nos desafios de preenchimento de lacunas de Gramática, Escuta e Fala.
function GapSentence({ before, after, filled }: { before: string; after: string; filled?: string }) {
  return (
    <span style={{ fontFamily: "'Poppins', sans-serif" }}>
      {before}
      {"  "}
      <span
        style={{
          display: "inline-block",
          minWidth: 64,
          borderBottom: "2px solid var(--teal)",
          textAlign: "center",
          fontWeight: 700,
          color: filled ? "var(--ink)" : "transparent",
          padding: "0 4px",
        }}
      >
        {filled || "____"}
      </span>
      {"  "}
      {after}
    </span>
  );
}

type Difficulty = { skill: string; area: string; note: string };

function NextButton({ onNext, isLast, disabled }: { onNext: () => void; isLast: boolean; disabled?: boolean }) {
  return (
    <Button onClick={onNext} disabled={disabled} style={{ width: "100%", marginTop: 16, padding: "12px 0" }}>
      {isLast ? "Ver relatório da aula" : "Próxima habilidade"}
    </Button>
  );
}

async function logDifficultyDirect(sessionId: string, skill: string, area: string, note: string) {
  const supabase = supabaseBrowser();
  await supabase.from("difficulties").insert({ session_id: sessionId, skill, area, note });
}

// ---------- Reading ----------
export function ReadingBlock({
  sessionId,
  data,
  onDifficulty,
  onNext,
  isLast,
}: {
  sessionId: string;
  data: any;
  onDifficulty: (d: Difficulty) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);

  async function check() {
    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      if (answers[i] !== q.answerIndex) {
        const note = `Errou: "${q.q}"`;
        onDifficulty({ skill: "Leitura", area: q.area || "compreensão", note });
        await logDifficultyDirect(sessionId, "Leitura", q.area || "compreensão", note);
      }
    }
    setChecked(true);
  }

  return (
    <div>
      {data.isComparison ? (
        <>
          <Card style={{ marginBottom: 10 }}>
            <SectionLabel>{data.textA?.label || "Texto A"}</SectionLabel>
            <p style={{ fontSize: 15, lineHeight: 1.7, fontFamily: "'Poppins', sans-serif", margin: 0 }}>{data.textA?.text}</p>
          </Card>
          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>{data.textB?.label || "Texto B"}</SectionLabel>
            <p style={{ fontSize: 15, lineHeight: 1.7, fontFamily: "'Poppins', sans-serif", margin: 0 }}>{data.textB?.text}</p>
          </Card>
          <div style={{ fontSize: 12.5, color: "var(--muted-on-dark)", marginBottom: 14 }}>
            🔍 Compare os dois textos antes de responder — algumas perguntas pedem para identificar as diferenças entre eles.
          </div>
        </>
      ) : (
        <Card style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 15.5, lineHeight: 1.7, fontFamily: "'Poppins', sans-serif" }}>{data.text}</p>
        </Card>
      )}
      {data.questions.map((q: any, i: number) => (
        <Card key={i} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{q.q}</div>
          {q.options.map((opt: string, oi: number) => {
            const isChosen = answers[i] === oi;
            const isCorrect = checked && oi === q.answerIndex;
            const isWrongChosen = checked && isChosen && oi !== q.answerIndex;
            return (
              <button
                key={oi}
                disabled={checked}
                onClick={() => setAnswers((a) => ({ ...a, [i]: oi }))}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  marginBottom: 6,
                  borderRadius: 3,
                  fontSize: 13.5,
                  cursor: checked ? "default" : "pointer",
                  border:
                    "1px solid " +
                    (isCorrect ? "var(--teal)" : isWrongChosen ? "var(--wine)" : isChosen ? "var(--teal)" : "var(--line)"),
                  background: isCorrect ? "#eaf0ec" : isWrongChosen ? "#f5e7e9" : isChosen ? "#eaf0ec" : "#fbf8f1",
                }}
              >
                {opt}
              </button>
            );
          })}
        </Card>
      ))}
      {!checked ? (
        <Button onClick={check} variant="ghost" style={{ width: "100%", padding: "11px 0" }}>
          Corrigir respostas
        </Button>
      ) : (
        <NextButton onNext={onNext} isLast={isLast} />
      )}
    </div>
  );
}

// ---------- Grammar ----------
export function GrammarBlock({
  sessionId,
  data,
  onDifficulty,
  onNext,
  isLast,
}: {
  sessionId: string;
  data: any;
  onDifficulty: (d: Difficulty) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);

  async function check() {
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (answers[i] !== item.answerIndex) {
        const note = `Errou a lacuna: "${item.before} ___ ${item.after}"`;
        onDifficulty({ skill: "Gramática", area: item.area || "gramática", note });
        await logDifficultyDirect(sessionId, "Gramática", item.area || "gramática", note);
      }
    }
    setChecked(true);
  }

  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 14, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>{data.instructions}</p>
      </Card>
      {data.items.map((item: any, i: number) => {
        const chosen = answers[i];
        const isRight = checked && chosen === item.answerIndex;
        const isWrong = checked && chosen !== undefined && chosen !== item.answerIndex;
        return (
          <Card key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 15, marginBottom: 10 }}>
              <GapSentence
                before={item.before}
                after={item.after}
                filled={chosen !== undefined ? item.options[chosen] : undefined}
              />
            </div>
            {item.options.map((opt: string, oi: number) => {
              const isChosen = answers[i] === oi;
              const isCorrect = checked && oi === item.answerIndex;
              const isWrongChosen = checked && isChosen && oi !== item.answerIndex;
              return (
                <button
                  key={oi}
                  disabled={checked}
                  onClick={() => setAnswers((a) => ({ ...a, [i]: oi }))}
                  style={{
                    display: "inline-block",
                    padding: "7px 14px",
                    marginRight: 8,
                    marginBottom: 6,
                    borderRadius: 20,
                    fontSize: 13.5,
                    cursor: checked ? "default" : "pointer",
                    border:
                      "1px solid " +
                      (isCorrect ? "var(--teal)" : isWrongChosen ? "var(--wine)" : isChosen ? "var(--teal)" : "var(--line)"),
                    background: isCorrect ? "#eaf0ec" : isWrongChosen ? "#f5e7e9" : isChosen ? "#eaf0ec" : "#fbf8f1",
                  }}
                >
                  {opt}
                </button>
              );
            })}
            {isRight !== undefined && isWrong && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                Resposta certa: <strong>{item.options[item.answerIndex]}</strong>
              </div>
            )}
          </Card>
        );
      })}
      {!checked ? (
        <Button onClick={check} variant="ghost" style={{ width: "100%", padding: "11px 0" }}>
          Corrigir respostas
        </Button>
      ) : (
        <NextButton onNext={onNext} isLast={isLast} />
      )}
    </div>
  );
}

// ---------- Listening ----------
export function ListeningBlock({
  sessionId,
  data,
  onDifficulty,
  onNext,
  isLast,
}: {
  sessionId: string;
  data: any;
  onDifficulty: (d: Difficulty) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const isComparison = !!data.isComparison;

  // Quando há 2 áudios (modo comparativo), as vozes precisam ser sempre
  // diferentes entre si e coerentes com o gênero de cada personagem.
  const { voiceA, voiceB } = isComparison
    ? pickComparisonVoices(data.textA?.gender, data.textB?.gender, sessionId)
    : { voiceA: undefined, voiceB: undefined };

  // Modo normal usa só o player A (com um único áudio). Modo comparativo
  // usa os dois players lado a lado — daí os dois hooks sempre chamados,
  // mesmo que o B fique sem uso fora do modo comparativo.
  const playerA = useCloudSpeech();
  const playerB = useCloudSpeech();
  const [playedA, setPlayedA] = useState(false);
  const [playedB, setPlayedB] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [checked, setChecked] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [gapAnswers, setGapAnswers] = useState<Record<number, number>>({});
  const [gapChecked, setGapChecked] = useState(false);
  const gapFill: any[] = data.gapFill || [];

  // Busca o áudio (gerado no servidor via OpenAI TTS) assim que o bloco
  // monta, para que o play() do usuário seja síncrono — exigência do
  // Safari/iOS para permitir a reprodução.
  useEffect(() => {
    const cleanup = playerA.attachFromText(isComparison ? data.textA?.text : data.text, sessionId + "-a", voiceA);
    return cleanup;
  }, [data, sessionId, retryTick]);

  useEffect(() => {
    if (!isComparison) return;
    const cleanup = playerB.attachFromText(data.textB?.text, sessionId + "-b", voiceB);
    return cleanup;
  }, [data, sessionId, retryTick, isComparison]);

  const played = isComparison ? playedA && playedB : playedA;

  async function check() {
    for (let i = 0; i < data.questions.length; i++) {
      const q = data.questions[i];
      if (answers[i] !== q.answerIndex) {
        const note = `Errou: "${q.q}"`;
        onDifficulty({ skill: "Escuta", area: q.area || "compreensão auditiva", note });
        await logDifficultyDirect(sessionId, "Escuta", q.area || "compreensão auditiva", note);
      }
    }
    setChecked(true);
  }

  async function checkGaps() {
    for (let i = 0; i < gapFill.length; i++) {
      const item = gapFill[i];
      if (gapAnswers[i] !== item.answerIndex) {
        const note = `Errou a lacuna: "${item.before} ___ ${item.after}"`;
        onDifficulty({ skill: "Escuta", area: item.area || "compreensão auditiva (lacunas)", note });
        await logDifficultyDirect(sessionId, "Escuta", item.area || "compreensão auditiva (lacunas)", note);
      }
    }
    setGapChecked(true);
  }

  function AudioPlayerCard({
    label,
    player,
    hasPlayed,
    onPlayed,
  }: {
    label?: string;
    player: ReturnType<typeof useCloudSpeech>;
    hasPlayed: boolean;
    onPlayed: () => void;
  }) {
    function play() {
      player.play();
      onPlayed();
    }
    return (
      <Card style={{ marginBottom: 14, textAlign: "center" }}>
        {label && <SectionLabel>{label}</SectionLabel>}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {player.loadError ? (
            <Button variant="ghost" onClick={() => setRetryTick((t) => t + 1)} style={{ padding: "11px 22px" }}>
              ⚠️ Falha ao gerar áudio, toque para tentar de novo
            </Button>
          ) : !player.ready ? (
            <Button disabled style={{ padding: "11px 22px" }}>
              Preparando áudio…
            </Button>
          ) : !player.speaking ? (
            <Button onClick={play} style={{ padding: "11px 22px" }}>
              {hasPlayed ? "🔁 Ouvir novamente" : "▶ Ouvir o áudio"}
            </Button>
          ) : !player.paused ? (
            <Button onClick={player.pause} variant="ghost" style={{ padding: "11px 22px" }}>
              ⏸ Pausar
            </Button>
          ) : (
            <Button onClick={player.resume} style={{ padding: "11px 22px" }}>
              ▶ Continuar
            </Button>
          )}
        </div>
        {!label && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
            Ouça quantas vezes precisar antes de responder. Dá para pausar e continuar de onde parou.
          </div>
        )}
      </Card>
    );
  }

  return (
    <div>
      {isComparison ? (
        <>
          <AudioPlayerCard label={data.textA?.label || "Áudio A"} player={playerA} hasPlayed={playedA} onPlayed={() => setPlayedA(true)} />
          <AudioPlayerCard label={data.textB?.label || "Áudio B"} player={playerB} hasPlayed={playedB} onPlayed={() => setPlayedB(true)} />
          <div style={{ fontSize: 12.5, color: "var(--muted-on-dark)", marginBottom: 14 }}>
            🔍 Ouça os dois áudios antes de responder — algumas perguntas pedem para identificar as diferenças entre eles.
          </div>
        </>
      ) : (
        <AudioPlayerCard player={playerA} hasPlayed={playedA} onPlayed={() => setPlayedA(true)} />
      )}
      {played &&
        data.questions.map((q: any, i: number) => (
          <Card key={i} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{q.q}</div>
            {q.options.map((opt: string, oi: number) => {
              const isChosen = answers[i] === oi;
              const isCorrect = checked && oi === q.answerIndex;
              const isWrongChosen = checked && isChosen && oi !== q.answerIndex;
              return (
                <button
                  key={oi}
                  disabled={checked}
                  onClick={() => setAnswers((a) => ({ ...a, [i]: oi }))}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 10px",
                    marginBottom: 6,
                    borderRadius: 3,
                    fontSize: 13.5,
                    cursor: checked ? "default" : "pointer",
                    border:
                      "1px solid " +
                      (isCorrect ? "var(--teal)" : isWrongChosen ? "var(--wine)" : isChosen ? "var(--teal)" : "var(--line)"),
                    background: isCorrect ? "#eaf0ec" : isWrongChosen ? "#f5e7e9" : isChosen ? "#eaf0ec" : "#fbf8f1",
                  }}
                >
                  {opt}
                </button>
              );
            })}
          </Card>
        ))}
      {played && !checked && (
        <Button onClick={check} variant="ghost" style={{ width: "100%", padding: "11px 0" }}>
          Corrigir respostas
        </Button>
      )}

      {checked && gapFill.length > 0 && (
        <Card style={{ marginTop: 4, marginBottom: 14 }}>
          <SectionLabel>Complete o que você ouviu</SectionLabel>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
            Ouça de novo se precisar e escolha a palavra que completa cada frase do áudio.
          </div>
          {gapFill.map((item: any, i: number) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 14.5, marginBottom: 8 }}>
                <GapSentence
                  before={item.before}
                  after={item.after}
                  filled={gapAnswers[i] !== undefined ? item.options[gapAnswers[i]] : undefined}
                />
              </div>
              {item.options.map((opt: string, oi: number) => {
                const isChosen = gapAnswers[i] === oi;
                const isCorrect = gapChecked && oi === item.answerIndex;
                const isWrongChosen = gapChecked && isChosen && oi !== item.answerIndex;
                return (
                  <button
                    key={oi}
                    disabled={gapChecked}
                    onClick={() => setGapAnswers((a) => ({ ...a, [i]: oi }))}
                    style={{
                      display: "inline-block",
                      padding: "7px 14px",
                      marginRight: 8,
                      marginBottom: 6,
                      borderRadius: 20,
                      fontSize: 13.5,
                      cursor: gapChecked ? "default" : "pointer",
                      border:
                        "1px solid " +
                        (isCorrect ? "var(--teal)" : isWrongChosen ? "var(--wine)" : isChosen ? "var(--teal)" : "var(--line)"),
                      background: isCorrect ? "#eaf0ec" : isWrongChosen ? "#f5e7e9" : isChosen ? "#eaf0ec" : "#fbf8f1",
                    }}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ))}
          {!gapChecked && (
            <Button onClick={checkGaps} variant="ghost" style={{ width: "100%", padding: "11px 0" }}>
              Corrigir lacunas
            </Button>
          )}
        </Card>
      )}

      {checked && (gapFill.length === 0 || gapChecked) && <NextButton onNext={onNext} isLast={isLast} />}
    </div>
  );
}

// ---------- Speaking ----------
export function SpeakingBlock({
  sessionId,
  level,
  data,
  onDifficulty,
  onNext,
  isLast,
}: {
  sessionId: string;
  level: string;
  data: any;
  onDifficulty: (d: Difficulty) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const { start, stop, recording, supported } = useAudioRecorder();
  const [feedback, setFeedback] = useState<any>(null);
  const [loadingFb, setLoadingFb] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [showRitual, setShowRitual] = useState(true);
  const [transcribing, setTranscribing] = useState(false);
  const [recordError, setRecordError] = useState("");
  const [showTextFallback, setShowTextFallback] = useState(false);

  // Desafios de completar a frase em voz alta, antes da pergunta aberta.
  const gapFill: any[] = data.gapFill || [];
  const [gapIdx, setGapIdx] = useState(0);
  const [gapDone, setGapDone] = useState(gapFill.length === 0);
  const [gapTranscript, setGapTranscript] = useState("");
  const [gapResult, setGapResult] = useState<"correct" | "wrong" | null>(null);
  const [gapTyped, setGapTyped] = useState("");

  function normalizeAnswer(txt: string) {
    return txt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
  }

  async function handleGapStart() {
    setRecordError("");
    setGapTranscript("");
    setGapResult(null);
    await start();
  }

  async function handleGapStop() {
    setTranscribing(true);
    setRecordError("");
    try {
      const result = await stop();
      if (!result) throw new Error("Gravação vazia");
      const form = new FormData();
      form.append("audio", result.blob, result.filename);
      const res = await fetch("/api/speaking/transcribe", { method: "POST", body: form });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Falha ao transcrever");
      resolveGapAnswer(resData.transcript || "");
    } catch {
      setRecordError("Não foi possível transcrever o áudio. Tente gravar de novo ou digite a resposta abaixo.");
    } finally {
      setTranscribing(false);
    }
  }

  async function resolveGapAnswer(spokenText: string) {
    const item = gapFill[gapIdx];
    setGapTranscript(spokenText);
    const isRight = normalizeAnswer(spokenText).includes(normalizeAnswer(item.answer));
    setGapResult(isRight ? "correct" : "wrong");
    if (!isRight) {
      const note = `Disse "${spokenText}" em vez de completar com "${item.answer}" em: "${item.before} ___ ${item.after}"`;
      onDifficulty({ skill: "Fala", area: "preenchimento de lacunas", note });
      await logDifficultyDirect(sessionId, "Fala", "preenchimento de lacunas", note);
    }
  }

  function nextGap() {
    if (gapIdx < gapFill.length - 1) {
      setGapIdx((i) => i + 1);
      setGapTranscript("");
      setGapTyped("");
      setGapResult(null);
    } else {
      setGapDone(true);
    }
  }

  async function handleStart() {
    setRecordError("");
    setFinalTranscript("");
    setFeedback(null);
    await start();
  }

  // Ao parar a gravação, envia o áudio para a rota de transcrição
  // (OpenAI Whisper no servidor) — funciona igual em PC, iOS e Android,
  // ao contrário da antiga SpeechRecognition do navegador.
  async function handleStop() {
    setTranscribing(true);
    setRecordError("");
    try {
      const result = await stop();
      if (!result) throw new Error("Gravação vazia");
      const form = new FormData();
      form.append("audio", result.blob, result.filename);
      const res = await fetch("/api/speaking/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao transcrever");
      setFinalTranscript(data.transcript || "");
    } catch {
      setRecordError("Não foi possível transcrever o áudio. Tente gravar de novo ou digite sua resposta abaixo.");
      setShowTextFallback(true);
    } finally {
      setTranscribing(false);
    }
  }

  async function evaluate() {
    setLoadingFb(true);
    try {
      const res = await fetch("/api/speaking/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          level,
          prompt: data.prompt,
          targetPoints: data.targetPoints,
          transcript: finalTranscript,
        }),
      });
      const fb = await res.json();
      if (!res.ok) throw new Error(fb.error);
      setFeedback(fb);
      (fb.difficulties || []).forEach((d: any) => onDifficulty({ skill: "Fala", area: d.area, note: d.note }));
    } catch {
      setFeedback({ error: true });
    }
    setLoadingFb(false);
  }

  if (showRitual) {
    return <BreathingRitual onDone={() => setShowRitual(false)} />;
  }

  if (!gapDone) {
    const item = gapFill[gapIdx];
    return (
      <div>
        <Card style={{ marginBottom: 14 }}>
          <SectionLabel>Complete a frase em voz alta ({gapIdx + 1}/{gapFill.length})</SectionLabel>
          <div style={{ fontSize: 17, marginTop: 6 }}>
            <GapSentence before={item.before} after={item.after} filled={gapResult ? item.answer : undefined} />
          </div>
        </Card>

        {supported ? (
          <Card style={{ marginBottom: 14, textAlign: "center" }}>
            {!recording && !transcribing && !gapResult && (
              <Button onClick={handleGapStart} style={{ padding: "11px 22px" }}>
                🎙️ Falar a frase completa
              </Button>
            )}
            {recording && (
              <Button onClick={handleGapStop} variant="danger" style={{ padding: "11px 22px" }}>
                ⏹ Parar e conferir
              </Button>
            )}
            {transcribing && (
              <Button disabled style={{ padding: "11px 22px" }}>
                Conferindo…
              </Button>
            )}
            {gapTranscript && (
              <div style={{ fontSize: 13, marginTop: 12, fontStyle: "italic", color: "var(--muted)" }}>
                Você disse: "{gapTranscript}"
              </div>
            )}
            {recordError && <div style={{ fontSize: 12.5, color: "var(--wine)", marginTop: 10 }}>{recordError}</div>}
            {gapResult && (
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  marginTop: 10,
                  color: gapResult === "correct" ? "var(--teal)" : "var(--wine)",
                }}
              >
                {gapResult === "correct" ? "✓ Isso mesmo!" : `A resposta certa era "${item.answer}".`}
              </div>
            )}
          </Card>
        ) : (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8, lineHeight: 1.5 }}>
              Seu navegador não permite gravar áudio aqui. Fale a frase em voz alta para praticar e digite abaixo o
              que você disse.
            </div>
            <input
              value={gapTyped}
              onChange={(e) => setGapTyped(e.target.value)}
              placeholder="Digite a palavra ou frase que você falou…"
              style={{
                width: "100%",
                padding: 10,
                borderRadius: 3,
                border: "1px solid var(--line)",
                fontSize: 14,
                fontFamily: "inherit",
              }}
            />
            {!gapResult && gapTyped && (
              <Button
                onClick={() => resolveGapAnswer(gapTyped)}
                variant="ghost"
                style={{ width: "100%", padding: "10px 0", marginTop: 10 }}
              >
                Conferir
              </Button>
            )}
            {gapResult && (
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  marginTop: 10,
                  color: gapResult === "correct" ? "var(--teal)" : "var(--wine)",
                }}
              >
                {gapResult === "correct" ? "✓ Isso mesmo!" : `A resposta certa era "${item.answer}".`}
              </div>
            )}
          </Card>
        )}

        {gapResult && (
          <Button onClick={nextGap} style={{ width: "100%", padding: "12px 0" }}>
            {gapIdx < gapFill.length - 1 ? "Próxima frase" : "Continuar para a pergunta aberta"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 15, fontFamily: "'Poppins', sans-serif", lineHeight: 1.6 }}>{data.prompt}</p>
      </Card>

      {supported && !showTextFallback && (
        <Card style={{ marginBottom: 14, textAlign: "center" }}>
          {!recording && !transcribing && (
            <Button onClick={handleStart} style={{ padding: "11px 22px" }}>
              🎙️ Falar agora
            </Button>
          )}
          {recording && (
            <Button onClick={handleStop} variant="danger" style={{ padding: "11px 22px" }}>
              ⏹ Parar e transcrever
            </Button>
          )}
          {transcribing && (
            <Button disabled style={{ padding: "11px 22px" }}>
              Transcrevendo…
            </Button>
          )}
          <div style={{ fontSize: 13, marginTop: 12, minHeight: 20, fontStyle: "italic", color: "var(--muted)" }}>
            {finalTranscript || (recording ? "Gravando…" : "Sua fala transcrita aparecerá aqui")}
          </div>
          {recordError && (
            <div style={{ fontSize: 12.5, color: "var(--wine)", marginTop: 10 }}>{recordError}</div>
          )}
          <button
            onClick={() => setShowTextFallback(true)}
            style={{
              marginTop: 12,
              background: "none",
              border: "none",
              color: "var(--muted)",
              fontSize: 12,
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Prefiro digitar minha resposta
          </button>
        </Card>
      )}

      {(!supported || showTextFallback) && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8, lineHeight: 1.5 }}>
            {!supported
              ? "Seu navegador não permite gravar áudio aqui (é preciso HTTPS ou permissão de microfone). Sem problema: fale em voz alta normalmente para praticar e depois digite abaixo o que você disse, para receber a mesma avaliação."
              : "Digite abaixo o que você falou (ou o que diria) para receber a avaliação."}
          </div>
          <textarea
            value={finalTranscript}
            onChange={(e) => setFinalTranscript(e.target.value)}
            placeholder="Digite aqui o que você falou…"
            rows={4}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 3,
              border: "1px solid var(--line)",
              fontSize: 14,
              fontFamily: "inherit",
              resize: "vertical",
            }}
          />
          {supported && (
            <button
              onClick={() => setShowTextFallback(false)}
              style={{
                marginTop: 10,
                background: "none",
                border: "none",
                color: "var(--muted)",
                fontSize: 12,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Prefiro gravar minha voz
            </button>
          )}
        </Card>
      )}

      {finalTranscript && !feedback && (
        <Button onClick={evaluate} disabled={loadingFb} variant="ghost" style={{ width: "100%", padding: "11px 0" }}>
          {loadingFb ? "Avaliando…" : "Avaliar minha fala"}
        </Button>
      )}

      {loadingFb && (
        <ProcessingAnimation
          size="compact"
          messages={["Ouvindo com atenção…", "Destravando seu feedback…", "Ajustando os detalhes…"]}
        />
      )}

      {feedback && !feedback.error && (
        <Card style={{ marginTop: 14 }}>
          <SectionLabel>Cobertura do tema</SectionLabel>
          <p style={{ fontSize: 13.5, marginBottom: 12 }}>{feedback.coverage}</p>
          <SectionLabel>Fluência</SectionLabel>
          <p style={{ fontSize: 13.5, marginBottom: 12 }}>{feedback.fluencyNote}</p>
          <SectionLabel>Pronúncia (estimada)</SectionLabel>
          <p style={{ fontSize: 13.5, marginBottom: 12 }}>{feedback.pronunciationNote}</p>
          {feedback.grammarIssues?.length > 0 && (
            <>
              <SectionLabel>Pontos de gramática</SectionLabel>
              <ul style={{ fontSize: 13.5, marginTop: 0, paddingLeft: 18 }}>
                {feedback.grammarIssues.map((g: string, i: number) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {g}
                  </li>
                ))}
              </ul>
            </>
          )}
          <SectionLabel>Versão corrigida</SectionLabel>
          <p style={{ fontSize: 13.5, fontStyle: "italic" }}>{feedback.correctedVersion}</p>
        </Card>
      )}

      {feedback && !feedback.error && <NextButton onNext={onNext} isLast={isLast} />}
    </div>
  );
}

// ---------- Writing ----------
export function WritingBlock({
  sessionId,
  level,
  data,
  onDifficulty,
  onNext,
  isLast,
}: {
  sessionId: string;
  level: string;
  data: any;
  onDifficulty: (d: Difficulty) => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<any>(null);
  const [loadingFb, setLoadingFb] = useState(false);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  async function evaluate() {
    setLoadingFb(true);
    try {
      const res = await fetch("/api/writing/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, level, prompt: data.prompt, text }),
      });
      const fb = await res.json();
      if (!res.ok) throw new Error(fb.error);
      setFeedback(fb);
      (fb.difficulties || []).forEach((d: any) => onDifficulty({ skill: "Escrita", area: d.area, note: d.note }));
    } catch {
      setFeedback({ error: true });
    }
    setLoadingFb(false);
  }

  return (
    <div>
      <Card style={{ marginBottom: 14 }}>
        <p style={{ fontSize: 15, fontFamily: "'Poppins', sans-serif", lineHeight: 1.6, marginBottom: 4 }}>{data.prompt}</p>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Mínimo sugerido: {data.minWords} palavras</div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!!feedback}
          placeholder="Write your answer in English…"
          rows={6}
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            resize: "vertical",
            fontSize: 14.5,
            lineHeight: 1.6,
            background: "transparent",
          }}
        />
        <div style={{ fontSize: 12, color: "var(--muted)", textAlign: "right" }}>{wordCount} palavras</div>
      </Card>

      {!feedback && (
        <Button
          onClick={evaluate}
          disabled={loadingFb || wordCount === 0}
          variant="ghost"
          style={{ width: "100%", padding: "11px 0" }}
        >
          {loadingFb ? "Corrigindo…" : "Corrigir meu texto"}
        </Button>
      )}

      {loadingFb && (
        <ProcessingAnimation
          size="compact"
          messages={["Lendo seu texto com carinho…", "Destravando sugestões pra você…", "Ajustando os detalhes…"]}
        />
      )}

      {feedback && !feedback.error && (
        <Card style={{ marginTop: 14 }}>
          {feedback.annotatedIssues?.length > 0 && (
            <>
              <SectionLabel>Correções pontuais</SectionLabel>
              {feedback.annotatedIssues.map((a: any, i: number) => (
                <div key={i} style={{ marginBottom: 10, fontSize: 13.5 }}>
                  <div style={{ textDecoration: "line-through", color: "var(--wine)" }}>{a.original}</div>
                  <div style={{ color: "var(--teal)" }}>→ {a.suggestion}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12.5 }}>{a.issue}</div>
                </div>
              ))}
            </>
          )}
          <SectionLabel>Estrutura</SectionLabel>
          <p style={{ fontSize: 13.5, marginBottom: 10 }}>{feedback.structureNote}</p>
          <SectionLabel>Vocabulário</SectionLabel>
          <p style={{ fontSize: 13.5, marginBottom: 10 }}>{feedback.vocabularyNote}</p>
          <SectionLabel>Versão corrigida</SectionLabel>
          <p style={{ fontSize: 13.5, fontStyle: "italic" }}>{feedback.correctedVersion}</p>
        </Card>
      )}

      {feedback && !feedback.error && <NextButton onNext={onNext} isLast={isLast} />}
    </div>
  );
}
