"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, Button, SectionLabel, Spark, PhysicalButton, ProcessingAnimation, Lockup } from "@/components/ui";
import {
  SKILL_META,
  ReadingBlock,
  GrammarBlock,
  ListeningBlock,
  SpeakingBlock,
  WritingBlock,
} from "@/components/SkillBlocks";
import { BottomNav } from "@/components/BottomNav";
import { checkAccessOrRedirect } from "@/lib/access-check";
import { ShareResultButton } from "@/components/ShareResultCard";
import { AchievementStrip, type AchievementItem } from "@/components/Gamification";
import { getQuoteOfDay } from "@/lib/quotes";

const LEVEL_LABELS: Record<string, string> = {
  A1: "Iniciante",
  A2: "Básico",
  B1: "Intermediário",
  B2: "Intermediário Superior",
  C1: "Avançado",
  C2: "Proficiente",
};

const TOPIC_KINDS = [
  { id: "news", label: "Assunto do momento" },
  { id: "music", label: "Música" },
  { id: "biography", label: "Biografia inspiradora" },
  { id: "travel", label: "Viagem" },
  { id: "work", label: "Trabalho" },
  { id: "health", label: "Saúde e Bem-Estar" },
  { id: "sports", label: "Esportes" },
  { id: "cooking", label: "Culinária" },
  { id: "technology", label: "Tecnologia" },
  { id: "astrology", label: "Astrologia" },
  { id: "custom", label: "Escrever minha situação" },
];

const CUSTOM_TOPIC_MAX = 140;

// Saudação em inglês, do jeito que se fala de verdade — o aluno já entra
// no app "ouvindo" inglês. Respeita a hora do dia e mistura algumas
// casuais que servem a qualquer hora, para não repetir sempre a mesma.
const GREETINGS_BY_PERIOD: Record<"morning" | "afternoon" | "evening", string[]> = {
  morning: ["Good morning", "Morning", "Rise and shine", "Top of the morning"],
  afternoon: ["Good afternoon", "Afternoon", "Hope your day's going well"],
  evening: ["Good evening", "Evening", "Hope you had a good day"],
};
const GREETINGS_ANYTIME = ["Hey", "Hey there", "Hi there", "What's up", "Welcome back", "Look who's here", "Great to see you"];

function pickGreeting(hour: number): string {
  const period = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const pool = [...GREETINGS_BY_PERIOD[period], ...GREETINGS_ANYTIME];
  return pool[Math.floor(Math.random() * pool.length)];
}

// Ordem canônica das 5 habilidades. Uma aula pode não ter todas — o formato
// escolhido decide quais entram (ver FORMAT_SKILLS) — então o pedido real de
// cada aula é sempre derivado do conteúdo gerado (deriveSkillOrder), nunca
// assumido como "as 5 sempre".
const ALL_SKILLS = ["reading", "grammar", "listening", "speaking", "writing"];

// Rótulos curtos da trilha de progresso. Antes era um slice(0, 4) cego, que
// produzia "Escu" e "Gram" na tela: palavra cortada no meio lê como defeito,
// não como abreviação. Só "Gramática" precisa mesmo encurtar.
const SKILL_SHORT: Record<string, string> = {
  reading: "Leitura",
  grammar: "Gram.",
  listening: "Escuta",
  speaking: "Fala",
  writing: "Escrita",
};

// Erro cuja mensagem já está escrita para o aluno ler (as rotas montam essa
// frase em src/lib/erro-do-aluno.ts). Serve para distinguir do erro técnico do
// próprio fetch — "Failed to fetch", "NetworkError" — que nunca pode ir para a
// tela: vem em inglês e não diz nada a quem só queria estudar.
class ErroDoAluno extends Error {}

function deriveSkillOrder(content: any): string[] {
  return ALL_SKILLS.filter((k) => content && content[k]);
}

// Mesmos formatos que /api/session/generate aceita (ver FORMAT_SKILLS lá).
// Leitura já inclui a interpretação (sempre foram a mesma habilidade no
// app); Escuta+Fala e Escrita+Gramática combinam pares que se apoiam.
const LESSON_FORMATS = [
  { id: "reading", label: "Leitura + Interpretação", skills: ["reading"], minutes: "4-6 min" },
  { id: "listening_speaking", label: "Listening + Speaking", skills: ["listening", "speaking"], minutes: "7-10 min" },
  { id: "writing_grammar", label: "Writing + Grammar", skills: ["writing", "grammar"], minutes: "7-10 min" },
  { id: "full", label: "Aula completa", skills: ALL_SKILLS, minutes: "15-20 min" },
];

// Selo colorido com ícone de contorno para cada formato de aula — mesma
// linguagem visual do material de marca (círculo colorido + ícone branco).
const FORMAT_ICON_CONFIG: Record<string, { bg: string; path: React.ReactNode }> = {
  reading: {
    bg: "var(--teal)",
    path: (
      <>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </>
    ),
  },
  listening_speaking: {
    bg: "var(--coral)",
    path: (
      <>
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      </>
    ),
  },
  writing_grammar: {
    bg: "var(--success)",
    path: <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />,
  },
  full: {
    bg: "#9b7fd4",
    path: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  },
};

// Ícone de contorno de uma cor só para cada tema. Sem círculo colorido de
// propósito: o seletor de formato logo abaixo já usa círculos coloridos, e
// as duas listas não podem disputar atenção. Nenhum ícone repete os do
// formato (lápis, estrela), por isso "Escrever minha situação" é um balão
// e Astrologia é só a lua.
const TOPIC_ICON_PATHS: Record<string, React.ReactNode> = {
  news: (
    <>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </>
  ),
  biography: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  travel: (
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  ),
  work: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>
  ),
  health: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  ),
  sports: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polygon points="12 7.5 16 10.4 14.5 15 9.5 15 8 10.4" />
      <path d="M12 7.5V2M16 10.4l5.5-1.4M14.5 15l3 5M9.5 15l-3 5M8 10.4 2.5 9" />
    </>
  ),
  cooking: (
    <>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </>
  ),
  technology: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </>
  ),
  astrology: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  custom: (
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  ),
};

function TopicIcon({ id, color }: { id: string; color: string }) {
  const path = TOPIC_ICON_PATHS[id];
  if (!path) return null;
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden="true">
      {path}
    </svg>
  );
}

function FormatIcon({ id, size = 22 }: { id: string; size?: number }) {
  const c = FORMAT_ICON_CONFIG[id];
  if (!c) return null;
  return (
    <span style={{ width: size, height: size, borderRadius: 999, background: c.bg, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {c.path}
      </svg>
    </span>
  );
}

// Trilha de progresso das habilidades desta aula (pode ser 1, 2 ou 5,
// dependendo do formato escolhido) — a atual expande e mostra o nome
// completo, as demais colapsam para a abreviação de 4 letras.
function SkillTrack({ skillIdx, skillOrder }: { skillIdx: number; skillOrder: string[] }) {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "flex-end" }}>
      {skillOrder.map((key, i) => {
        const meta = SKILL_META[key];
        const done = i < skillIdx;
        const current = i === skillIdx;
        return (
          <div key={key} style={{ flex: current ? 2.2 : 1, display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
            <div style={{ height: 6, borderRadius: 999, background: "rgba(247,245,239,.18)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 999,
                  background: done || current ? (done ? "var(--success)" : "var(--teal)") : "transparent",
                  width: done || current ? "100%" : "0%",
                  transition: "width .6s cubic-bezier(.4,0,.2,1), background .3s",
                }}
              />
            </div>
            <span
              style={{
                fontFamily: "'Work Sans', sans-serif",
                fontSize: current ? 12 : 10.5,
                fontWeight: current ? 600 : 500,
                color: current ? "var(--ink-on-dark)" : done ? "#3ee07a" : "var(--muted-on-dark)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {current ? meta.label : SKILL_SHORT[key] || meta.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [stage, setStage] = useState<"setup" | "loading" | "session" | "report">("setup");
  const [level, setLevel] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [topicKind, setTopicKind] = useState("news");
  const [customTopic, setCustomTopic] = useState("");
  const [format, setFormat] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [content, setContent] = useState<any>(null);
  const [skillIdx, setSkillIdx] = useState(0);
  const [log, setLog] = useState<{ skill: string; area: string; note: string }[]>([]);
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  // Aula deixada pela metade, para o aluno retomar de onde parou.
  const [pending, setPending] = useState<any>(null);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const [confirmandoDescarteInicial, setConfirmandoDescarteInicial] = useState(false);
  const [saindo, setSaindo] = useState(false);

  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [nextAchievement, setNextAchievement] = useState<AchievementItem | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const quote = React.useMemo(() => getQuoteOfDay(), []);
  const greeting = React.useMemo(() => pickGreeting(new Date().getHours()), []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      const ok = await checkAccessOrRedirect(supabase, data.user.id, router);
      if (!ok) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, default_level, is_admin")
        .eq("id", data.user.id)
        .single();
      setStudentName(profile?.name || null);
      setIsAdmin(!!profile?.is_admin);
      setLevel(profile?.default_level || null);
      setCheckingAuth(false);

      fetch("/api/session/pending")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setPending(d?.pending || null))
        .catch(() => {});

      fetch("/api/profile/gamification")
        .then((r) => (r.ok ? r.json() : null))
        .then((gam) => {
          if (!gam) return;
          setAchievements(gam.achievements || []);
          setNextAchievement(gam.nextAchievement || null);
          setCurrentStreak(gam.currentStreak || 0);
          setSessionCount(gam.sessionCount || 0);
        })
        .catch(() => {});
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function startSession() {
    if (!level || !format) return;
    if (topicKind === "custom" && !customTopic.trim()) return;
    setError("");
    setStage("loading");
    try {
      const res = await fetch("/api/session/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicKind, format, customTopic: customTopic.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new ErroDoAluno(
          data?.error || "Não foi possível montar a aula agora. Tente de novo em alguns instantes."
        );
      }
      setSessionId(data.sessionId);
      setContent(data.content);
      setLog([]);
      setSkillIdx(0);
      setStage("session");
    } catch (e: any) {
      setError(
        e instanceof ErroDoAluno
          ? e.message
          : "A conexão falhou no meio do caminho. Confira sua internet e tente de novo."
      );
      setStage("setup");
    }
  }

  // Reconsulta o banco em vez de assumir o estado local: se por algum
  // motivo houver outra aula em aberto, ela precisa aparecer na hora.
  async function refreshPending() {
    const res = await fetch("/api/session/pending")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    setPending(res?.pending || null);
  }

  // Retoma a aula que ficou pela metade, no ponto exato onde parou.
  function resumeSession() {
    if (!pending) return;
    setSessionId(pending.sessionId);
    setContent(pending.content);
    setLog(pending.log || []);
    setSkillIdx(pending.skillIndex || 0);
    setStage("session");
  }

  // "Terminar depois": salva o ponto atual e volta para a tela inicial. A
  // aula continua em aberto e reaparece como pendente na próxima visita.
  async function finishLater() {
    if (!sessionId) return;
    try {
      await fetch("/api/session/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, skillIndex: skillIdx }),
      });
    } catch {
      // se a gravação falhar, a aula continua em aberto de qualquer forma;
      // o aluno só volta para o começo dela em vez do ponto exato.
    }
    await refreshPending();
    setStage("setup");
  }

  // Descarte a partir da tela inicial, sem precisar entrar na aula.
  async function discardPending() {
    if (!pending) return;
    setSaindo(true);
    try {
      await fetch("/api/session/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: pending.sessionId }),
      });
    } catch {
      // se falhar, a aula segue pendente e o aluno pode tentar de novo
    }
    await refreshPending();
    setConfirmandoDescarteInicial(false);
    setSaindo(false);
  }

  // "Sair da aula": descarta tudo o que foi feito nela.
  async function discardSession() {
    if (!sessionId) return;
    setSaindo(true);
    try {
      await fetch("/api/session/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
    } catch {
      // mesmo que a exclusão falhe, tiramos o aluno da aula; a aula órfã
      // no máximo reaparece como pendente depois.
    }
    await refreshPending();
    setSessionId(null);
    setContent(null);
    setLog([]);
    setSkillIdx(0);
    setConfirmandoSaida(false);
    setSaindo(false);
    setStage("setup");
  }

  function addLog(entry: { skill: string; area: string; note: string }) {
    setLog((l) => [...l, entry]);
  }

  function nextSkill() {
    const order = deriveSkillOrder(content);
    if (skillIdx < order.length - 1) {
      const proximo = skillIdx + 1;
      setSkillIdx(proximo);
      // Grava o avanço em segundo plano: assim, mesmo que o aluno feche a
      // aba sem clicar em "terminar depois", ele volta no ponto certo.
      if (sessionId) {
        fetch("/api/session/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, skillIndex: proximo }),
        }).catch(() => {});
      }
    } else {
      generateReport();
    }
  }

  async function generateReport() {
    setStage("report");
    setReportLoading(true);
    try {
      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new ErroDoAluno(
          data?.error || "Não foi possível montar o relatório agora. Seu progresso está salvo."
        );
      }
      setReport(data);
    } catch (e: any) {
      setReport({
        summary: "",
        bySkill: {},
        recurringDifficulties: [],
        recommendations: [],
        _saveFailed: true,
        _errorMessage: e?.message || "Não foi possível gerar nem salvar o relatório desta aula.",
      });
    }
    setReportLoading(false);
  }

  function restart() {
    setStage("setup");
    setContent(null);
    setReport(null);
    setLog([]);
    setSkillIdx(0);
    setSessionId(null);
  }

  if (checkingAuth) return null;

  const skillOrder = deriveSkillOrder(content);
  const currentSkill = skillOrder[skillIdx];

  const nextSkillLabel = skillIdx < skillOrder.length - 1 ? SKILL_META[skillOrder[skillIdx + 1]].label : undefined;

  if (stage === "session" && content && sessionId) {
    return (
      <div style={{ minHeight: "100vh" }}>
        <div style={{ background: "#283758", padding: "44px 20px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ maxWidth: 640, margin: "0 auto", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <Lockup size={18} />
              <button
                onClick={finishLater}
                style={{ border: "none", background: "transparent", color: "var(--muted-on-dark)", fontFamily: "'Work Sans', sans-serif", fontSize: 13, fontWeight: 500, padding: "6px 0", cursor: "pointer" }}
              >
                Terminar depois
              </button>
              <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12, fontWeight: 600, color: "var(--ink-on-dark)", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
                {skillIdx + 1} de {skillOrder.length} · {SKILL_META[currentSkill].label}
              </span>
            </div>
            <SkillTrack skillIdx={skillIdx} skillOrder={skillOrder} />
          </div>
        </div>

        <div style={{ background: "#f7f5ef", minHeight: "calc(100vh - 132px)", padding: "22px 20px 100px" }}>
          <div style={{ maxWidth: 640, margin: "0 auto", color: "var(--ink)" }}>
            {currentSkill === "reading" && (
              <ReadingBlock
                sessionId={sessionId}
                data={content.reading}
                topicTitle={content.topic?.title}
                nextLabel={nextSkillLabel}
                onDifficulty={addLog}
                onNext={nextSkill}
                isLast={skillIdx === skillOrder.length - 1}
              />
            )}
            {currentSkill === "grammar" && (
              <GrammarBlock sessionId={sessionId} data={content.grammar} onDifficulty={addLog} onNext={nextSkill} isLast={skillIdx === skillOrder.length - 1} />
            )}
            {currentSkill === "listening" && (
              <ListeningBlock sessionId={sessionId} data={content.listening} onDifficulty={addLog} onNext={nextSkill} isLast={skillIdx === skillOrder.length - 1} />
            )}
            {currentSkill === "speaking" && (
              <SpeakingBlock sessionId={sessionId} level={level} data={content.speaking} readingRecap={content.reading} onDifficulty={addLog} onNext={nextSkill} isLast={skillIdx === skillOrder.length - 1} />
            )}
            {currentSkill === "writing" && (
              <WritingBlock sessionId={sessionId} level={level} data={content.writing} readingRecap={content.reading} onDifficulty={addLog} onNext={nextSkill} isLast={skillIdx === skillOrder.length - 1} />
            )}

            {/* Sair da aula: guardando o progresso, ou descartando tudo. */}
            <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--line)" }}>
              {!confirmandoSaida ? (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button
                    onClick={() => setConfirmandoSaida(true)}
                    style={{
                      padding: "10px 18px",
                      background: "transparent",
                      color: "var(--muted)",
                      border: "1px solid var(--line)",
                      borderRadius: 3,
                      fontFamily: "inherit",
                      fontWeight: 600,
                      fontSize: 13.5,
                      cursor: "pointer",
                    }}
                  >
                    Sair da aula
                  </button>
                </div>
              ) : (
                <Card style={{ borderColor: "var(--wine)" }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 6 }}>Sair e perder esta aula?</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 14 }}>
                    Esta aula e tudo o que você já respondeu nela serão apagados, e ela não vai gerar relatório. Não há
                    como recuperar depois. Se quiser voltar a ela mais tarde, use <strong>Terminar depois</strong>.
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={discardSession}
                      disabled={saindo}
                      style={{
                        padding: "10px 18px",
                        background: "var(--wine)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 3,
                        fontFamily: "inherit",
                        fontWeight: 600,
                        fontSize: 13.5,
                        cursor: "pointer",
                      }}
                    >
                      {saindo ? "Saindo…" : "Sim, apagar esta aula"}
                    </button>
                    <button
                      onClick={() => setConfirmandoSaida(false)}
                      disabled={saindo}
                      style={{
                        padding: "10px 18px",
                        background: "transparent",
                        color: "var(--muted)",
                        border: "1px solid var(--line)",
                        borderRadius: 3,
                        fontFamily: "inherit",
                        fontWeight: 600,
                        fontSize: 13.5,
                        cursor: "pointer",
                      }}
                    >
                      Continuar na aula
                    </button>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
        <BottomNav onSignOut={signOut} isAdmin={isAdmin} />
      </div>
    );
  }

  if (stage === "report") {
    return (
      <>
        <ReportView loading={reportLoading} report={report} topic={content?.topic} level={level} onRestart={restart} log={log} />
        <BottomNav onSignOut={signOut} isAdmin={isAdmin} />
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "24px 16px 100px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", color: "var(--ink-on-dark)" }}>
        <div style={{ marginBottom: stage === "setup" ? 18 : 22 }}>
          <Lockup size={20} />
        </div>

        {stage === "setup" && (
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, color: "var(--muted-on-dark)" }}>{greeting},</span>
                <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 24, lineHeight: 1.15, fontWeight: 600, letterSpacing: "-0.01em" }}>
                  {studentName ? studentName.split(" ")[0] : "friend"}
                </span>
              </div>
              {currentStreak > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 999, background: "rgba(246,160,23,.16)", border: "1px solid rgba(246,160,23,.4)", flexShrink: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--teal)" }} />
                  <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13, fontWeight: 600, color: "var(--teal)" }}>
                    {currentStreak} {currentStreak === 1 ? "dia" : "dias"}
                  </span>
                </div>
              )}
            </div>

            <p style={{ margin: "0 0 22px", fontFamily: "'Caveat', cursive", fontSize: 21, fontWeight: 500, lineHeight: 1.3, color: "var(--mustard-bright)" }}>
              “{quote.text}”
            </p>

            <Card style={{ marginBottom: 16 }}>
              <SectionLabel>Assunto de hoje</SectionLabel>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {TOPIC_KINDS.map((t) => {
                  const selected = topicKind === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTopicKind(t.id)}
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        borderRadius: 20,
                        padding: "8px 14px 8px 12px",
                        fontSize: 13.5,
                        fontWeight: 500,
                        transition: "transform 0.12s ease, background 0.12s ease",
                        transform: selected ? "scale(1.04)" : "none",
                        // Tracejado marca a única opção em que o aluno escreve
                        // em vez de só escolher.
                        border: selected ? "1px solid var(--teal)" : t.id === "custom" ? "1px dashed #b9b4a4" : "1px solid var(--line)",
                        background: selected ? "var(--teal)" : "#fbf8f1",
                        color: "var(--ink)",
                      }}
                    >
                      <TopicIcon id={t.id} color={selected ? "var(--ink)" : "var(--muted)"} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {topicKind === "custom" && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value.slice(0, CUSTOM_TOPIC_MAX))}
                    placeholder='Ex: "Entrevista de emprego numa empresa de tecnologia" ou "Pedir comida num restaurante indiano em Londres"'
                    rows={2}
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--line)",
                      fontSize: 13.5,
                      fontFamily: "inherit",
                      color: "var(--ink)",
                      resize: "vertical",
                    }}
                  />
                  <div style={{ textAlign: "right", fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                    {customTopic.length}/{CUSTOM_TOPIC_MAX}
                  </div>
                </div>
              )}
            </Card>

            <Card style={{ marginBottom: 20 }}>
              <SectionLabel>Formato da aula</SectionLabel>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {LESSON_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      borderRadius: 20,
                      padding: "6px 16px 6px 6px",
                      fontSize: 13.5,
                      fontWeight: 500,
                      transition: "transform 0.12s ease, background 0.12s ease",
                      transform: format === f.id ? "scale(1.04)" : "none",
                      border: format === f.id ? "1px solid var(--teal)" : "1px solid var(--line)",
                      background: format === f.id ? "var(--teal)" : "#fbf8f1",
                      color: "var(--ink)",
                    }}
                  >
                    <FormatIcon id={f.id} size={26} />
                    {f.label}
                  </button>
                ))}
              </div>
            </Card>

            {error && <div style={{ color: "var(--wine)", fontSize: 13.5, marginBottom: 12 }}>{error}</div>}

            {level && pending ? (
              // Com uma aula em aberto, o caminho principal é retomá-la. Só
              // depois de terminar ou descartar é que ele começa outra —
              // evita acumular aulas pela metade.
              <div style={{ borderRadius: 18, border: "1px dashed rgba(247,245,239,.32)", padding: "16px 18px", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 12, background: "var(--coral)", display: "grid", placeItems: "center", fontFamily: "'Poppins', sans-serif", fontSize: 15, fontWeight: 600, color: "var(--ink-on-dark)", flexShrink: 0 }}>
                    ↺
                  </span>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14, fontWeight: 600 }}>{pending.topicTitle}</span>
                    <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12.5, color: "var(--muted-on-dark)" }}>
                      Nível {pending.level} · parou em{" "}
                      {(() => {
                        const pendingOrder = deriveSkillOrder(pending.content);
                        const meta = SKILL_META[pendingOrder[pending.skillIndex || 0]];
                        return meta ? `${meta.label.toLowerCase()} · ${meta.labelEn.toLowerCase()}` : "leitura · reading";
                      })()}
                    </span>
                  </div>
                </div>
                <PhysicalButton onClick={resumeSession} background="var(--teal)" color="var(--ink)" shadowColor="var(--mustard)">
                  Continuar de onde parei
                </PhysicalButton>
                {!confirmandoDescarteInicial ? (
                  <div style={{ fontSize: 12.5, color: "var(--muted-on-dark)", marginTop: 12, textAlign: "center" }}>
                    Quer começar outra?{" "}
                    <span
                      onClick={() => setConfirmandoDescarteInicial(true)}
                      style={{ color: "var(--coral)", cursor: "pointer", fontWeight: 600 }}
                    >
                      Descartar esta aula
                    </span>
                  </div>
                ) : (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line-on-dark)" }}>
                    <div style={{ fontSize: 13, color: "var(--muted-on-dark)", lineHeight: 1.6, marginBottom: 12 }}>
                      Esta aula e tudo o que você já respondeu nela serão apagados, e ela não vai gerar relatório. Não
                      há como recuperar depois.
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={discardPending}
                        disabled={saindo}
                        style={{
                          padding: "9px 16px",
                          background: "var(--wine)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 3,
                          fontFamily: "inherit",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        {saindo ? "Apagando…" : "Sim, apagar"}
                      </button>
                      <button
                        onClick={() => setConfirmandoDescarteInicial(false)}
                        disabled={saindo}
                        style={{
                          padding: "9px 16px",
                          background: "transparent",
                          color: "var(--muted-on-dark)",
                          border: "1px solid var(--line-on-dark)",
                          borderRadius: 3,
                          fontFamily: "inherit",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : level ? (
              <div style={{ borderRadius: 22, background: "#f7f5ef", padding: 22, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 14px 34px rgba(16,20,58,.22)", marginBottom: 22 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mustard-dark)" }}>
                    Aula de hoje · {LEVEL_LABELS[level] || level}
                  </span>
                  <h2 style={{ margin: 0, fontFamily: "'Poppins', sans-serif", fontSize: 22, lineHeight: 1.2, fontWeight: 600, letterSpacing: "-0.015em", color: "var(--ink)" }}>
                    {format ? "Pronta quando você estiver" : "Escolha um formato acima"}
                  </h2>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {(LESSON_FORMATS.find((f) => f.id === format)?.skills || ALL_SKILLS).map((key) => (
                    <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <span style={{ width: "100%", height: 5, borderRadius: 999, background: "#e2ddd0" }} />
                      <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 9.5, color: "#7d7768", letterSpacing: "0.02em" }}>
                        {SKILL_SHORT[key] || SKILL_META[key].label}
                      </span>
                    </div>
                  ))}
                </div>
                {format && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Work Sans', sans-serif", fontSize: 13, color: "#5d5849" }}>
                    <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--sage)" }} />
                    {(() => {
                      const chosen = LESSON_FORMATS.find((f) => f.id === format)!;
                      return (
                        <span>
                          {chosen.skills.length} habilidade{chosen.skills.length > 1 ? "s" : ""} · cerca de {chosen.minutes}
                        </span>
                      );
                    })()}
                  </div>
                )}
                {(() => {
                  const missingCustomText = topicKind === "custom" && !customTopic.trim();
                  const ready = !!format && !missingCustomText;
                  const label = !format
                    ? "Escolha um formato para começar"
                    : missingCustomText
                    ? "Escreva sua situação acima"
                    : "Começar aula de hoje";
                  return (
                    <PhysicalButton
                      onClick={startSession}
                      disabled={!ready}
                      background={ready ? "var(--teal)" : "#e2ddd0"}
                      color={ready ? "var(--ink)" : "#5d5849"}
                      shadowColor={ready ? "var(--mustard)" : "#d3ccbc"}
                      style={{ gap: 8 }}
                    >
                      <span>{label}</span>
                      {ready && (
                        <img src="/spark.png" alt="" style={{ width: 22, height: 22, flexShrink: 0, filter: "brightness(0) saturate(100%)" }} />
                      )}
                    </PhysicalButton>
                  );
                })()}
              </div>
            ) : (
              <Card style={{ textAlign: "center", borderColor: "var(--mustard)", marginBottom: 20 }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>⏳</div>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>Aguardando seu nível</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  Um administrador do +Unblocking ainda vai definir seu nível de proficiência (CEFR). Assim que isso
                  acontecer, você já poderá começar a praticar.
                </div>
              </Card>
            )}

            {level && (
              <Card style={{ marginBottom: 22 }}>
                <SectionLabel>Games</SectionLabel>
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  {[
                    {
                      id: "quiz",
                      title: "Quiz",
                      hint: "Pontos por acerto",
                      bg: "var(--teal)",
                      icon: (
                        <>
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </>
                      ),
                    },
                    {
                      id: "guess",
                      title: "Quem é?",
                      hint: "Adivinhe pelas dicas",
                      bg: "var(--coral)",
                      icon: (
                        <>
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </>
                      ),
                    },
                  ].map((g) => (
                    <button
                      key={g.id}
                      onClick={() => router.push(`/games?game=${g.id}`)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: 12,
                        borderRadius: 16,
                        border: "1px solid var(--line)",
                        background: "#fbf8f1",
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={{ width: 34, height: 34, borderRadius: 999, background: g.bg, display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          {g.icon}
                        </svg>
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap" }}>{g.title}</span>
                        <span style={{ fontSize: 11.5, lineHeight: 1.3, color: "var(--muted)" }}>{g.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-on-dark)" }}>
                Suas conquistas
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1, borderRadius: 16, background: "rgba(79,98,72,.55)", padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 22, fontWeight: 600, color: "var(--ink-on-dark)" }}>{currentStreak}</span>
                  <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 11.5, lineHeight: 1.3, color: "#dcd8c9" }}>dias seguidos</span>
                </div>
                <div style={{ flex: 1, borderRadius: 16, background: "rgba(201,137,27,.3)", padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 22, fontWeight: 600, color: "var(--teal)" }}>{sessionCount}</span>
                  <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 11.5, lineHeight: 1.3, color: "#dcd8c9" }}>aulas concluídas</span>
                </div>
                <div style={{ flex: 1, borderRadius: 16, background: "rgba(234,80,99,.28)", padding: 14, display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 22, fontWeight: 600, color: "var(--coral)" }}>{level || "—"}</span>
                  <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 11.5, lineHeight: 1.3, color: "#dcd8c9" }}>nível atual</span>
                </div>
              </div>
              {achievements.length > 0 && (
                <Card className="fade-in-up" style={{ marginTop: 4, background: "#1f2b4a", border: "1px solid var(--line-on-dark)", color: "var(--ink-on-dark)" }}>
                  <AchievementStrip achievements={achievements} nextAchievement={nextAchievement} onDark />
                </Card>
              )}
            </div>
          </div>
        )}

        {stage === "loading" && (
          <Card style={{ textAlign: "center", padding: "40px 24px" }}>
            <ProcessingAnimation
              title="Preparando sua aula…"
              messages={[
                "Escolhendo um tema que combina com você…",
                "Speed up guys! Quase lá…",
                "Destravando novas palavras para hoje…",
                "O inglês é para ontem — já estamos nessa…",
                "Montando os exercícios de cada habilidade…",
                "Let's go! Calibrando a dificuldade certa pro seu nível…",
                "Preparando o seu próximo desbloqueio…",
              ]}
            />
          </Card>
        )}

      </div>
      <BottomNav onSignOut={signOut} isAdmin={isAdmin} />
    </div>
  );
}

// Cor por habilidade dos cartões "Para praticar amanhã" — cada categoria
// de erro ganha uma cor da paleta, coerente com o uso dela no resto do app.
const SKILL_TAG_COLOR: Record<string, string> = {
  Leitura: "var(--mustard-dark)",
  Gramática: "var(--mustard-dark)",
  Escuta: "var(--wine)",
  Fala: "var(--coral)",
  Escrita: "var(--sage)",
};

// "forte"/"adequado"/"a desenvolver" viram uma barra de progresso e uma cor
// — não temos uma fração real (tipo "4/5"), então a barra é uma leitura
// visual da categoria, não uma contagem exata de acertos.
function scoreBarPct(score?: string) {
  return score === "forte" ? 100 : score === "a desenvolver" ? 35 : 65;
}
function scoreBarColor(score?: string) {
  return score === "forte" ? "#1a7a44" : score === "a desenvolver" ? "var(--wine)" : "var(--mustard-dark)";
}

function ReportView({ loading, report, topic, level, onRestart, log }: any) {
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", padding: "24px 16px 100px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Card style={{ textAlign: "center", padding: "40px 24px" }}>
            <ProcessingAnimation
              title="Gerando relatório da aula…"
              messages={[
                "Revendo cada resposta com carinho…",
                "Good job! Separando o que já está redondo…",
                "Encontrando o que vale destravar amanhã…",
                "Erro é semente, não falha — contando os seus pontos fortes de hoje…",
                "Deixando tudo prontinho pra você ver…",
              ]}
            />
          </Card>
        </div>
      </div>
    );
  }
  if (!report) return null;

  if (report._saveFailed) {
    return (
      <div style={{ minHeight: "100vh", padding: "24px 16px 100px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Card style={{ padding: "28px 24px" }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 17, marginBottom: 8 }}>
              Não foi possível salvar o relatório desta aula
            </div>
            <p style={{ fontSize: 13.5, color: "var(--wine)", marginBottom: 16 }}>{report._errorMessage}</p>
            <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 16 }}>
              Essa aula não vai aparecer em "Minha área" porque o relatório não foi gravado no banco. Verifique sua
              conexão/configuração do Supabase e tente de novo.
            </p>
            <Button onClick={onRestart} style={{ width: "100%", padding: "12px 0" }}>
              Voltar ao início
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const overall = typeof report.scores?.overall === "number" ? report.scores.overall : null;
  const streak = report.streak;
  const unlockedAchievements = report.unlockedAchievements || [];
  // Aula pode ter sido um formato parcial — só existe nota de quem entrou
  // na aula (ver presentSkills em report/generate/route.ts).
  const presentSkills = ALL_SKILLS.filter((k) => report.bySkill && k in report.bySkill);

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ background: "#283758", padding: "44px 22px 30px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
          <Lockup size={18} />
          <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mustard-bright)" }}>
            Aula de hoje · concluída
          </span>
          {overall !== null && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
              <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 58, lineHeight: 1, fontWeight: 700, color: "var(--ink-on-dark)", letterSpacing: "-0.03em" }}>
                {overall.toFixed(1)}
              </span>
              <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 15, lineHeight: 1.3, color: "var(--muted-on-dark)", paddingBottom: 9 }}>
                nota geral da aula
                <br />
                {presentSkills.length > 1 ? `nas ${presentSkills.length} habilidades` : "na habilidade praticada"}
              </span>
            </div>
          )}
          <p style={{ margin: 0, fontFamily: "'Work Sans', sans-serif", fontSize: 14, lineHeight: 1.6, color: "var(--muted-on-dark)" }}>{report.summary}</p>
          {(streak?.currentStreak > 0 || unlockedAchievements.length > 0) && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", paddingTop: 2 }}>
              {streak?.currentStreak > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, background: "rgba(246,160,23,.18)", border: "1px solid rgba(246,160,23,.45)", fontFamily: "'Work Sans', sans-serif", fontSize: 12.5, fontWeight: 600, color: "var(--teal)" }}>
                  <span>{streak.currentStreak} {streak.currentStreak === 1 ? "dia seguido" : "dias seguidos"}</span>
                  <img src="/spark.png" alt="" style={{ width: 16, height: 16, flexShrink: 0 }} />
                </span>
              )}
              {unlockedAchievements.length > 0 && (
                <span style={{ padding: "7px 12px", borderRadius: 999, background: "rgba(37,211,102,.16)", border: "1px solid rgba(37,211,102,.4)", fontFamily: "'Work Sans', sans-serif", fontSize: 12.5, fontWeight: 600, color: "var(--success)" }}>
                  {unlockedAchievements.length} nova{unlockedAchievements.length > 1 ? "s" : ""} conquista{unlockedAchievements.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ background: "#f7f5ef", padding: "22px 22px 100px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", color: "var(--ink)" }}>
          {unlockedAchievements.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
              {unlockedAchievements.map((a: any) => (
                <div key={a.code} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", minWidth: 120, maxWidth: 160 }}>
                  <div style={{ fontSize: 22, marginBottom: 2 }}>{a.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{a.title}</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{a.description}</div>
                </div>
              ))}
            </div>
          )}

          {topic?.title && (
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>Tema de hoje</SectionLabel>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 17 }}>{topic.title}</div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
            <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
              Por habilidade
            </span>
            {presentSkills.map((key) => {
              const meta = SKILL_META[key];
              const s = report.bySkill?.[key];
              return (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15, fontWeight: 600 }}>
                      {meta.icon} {meta.label}
                    </span>
                    <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13, fontWeight: 600, color: s ? scoreBarColor(s.score) : "var(--muted)", textTransform: "capitalize" }}>
                      {s ? s.score : "Sem dados"}
                    </span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: "#e6e1d4", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 999, background: s ? scoreBarColor(s.score) : "#e6e1d4", width: `${s ? scoreBarPct(s.score) : 0}%` }} />
                  </div>
                  {s?.note && <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.4 }}>{s.note}</span>}
                </div>
              );
            })}
          </div>

          {log.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted)" }}>
                Para praticar amanhã
              </span>
              {log.map((l: any, i: number) => (
                <div key={i} style={{ borderRadius: 16, background: "#fffdf7", border: "1px solid rgba(16,20,58,.09)", padding: "15px 16px", display: "flex", flexDirection: "column", gap: 7 }}>
                  <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: "0.03em", color: SKILL_TAG_COLOR[l.skill] || "var(--mustard-dark)", textTransform: "uppercase" }}>
                    {l.skill} · {l.area}
                  </span>
                  <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 13.5, lineHeight: 1.45, color: "#4a4636" }}>{l.note}</span>
                </div>
              ))}
            </div>
          )}

          {report.recurringDifficulties?.length > 0 && (
            <Card style={{ marginBottom: 20 }}>
              <SectionLabel>Dificuldades recorrentes</SectionLabel>
              <ul style={{ fontSize: 13.5, margin: 0, paddingLeft: 18 }}>
                {report.recurringDifficulties.map((d: string, i: number) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {d}
                  </li>
                ))}
              </ul>
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: "var(--sage)", marginTop: 10 }}>
                Cada erro aqui é semente, não falha, porque mostra exatamente onde focar amanhã.
              </div>
            </Card>
          )}

          {report.recommendations?.length > 0 && (
            <Card style={{ marginBottom: 20 }}>
              <SectionLabel>Recomendações para a próxima aula</SectionLabel>
              <ul style={{ fontSize: 13.5, margin: 0, paddingLeft: 18 }}>
                {report.recommendations.map((r: string, i: number) => (
                  <li key={i} style={{ marginBottom: 4 }}>
                    {r}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ShareResultButton
              topicTitle={topic?.title || "Aula de inglês"}
              topicKind={topic?.kind}
              level={level || ""}
              overall={overall}
              bySkill={report.bySkill || {}}
            />
            <PhysicalButton onClick={onRestart} background="var(--card)" color="#283758" shadowColor="rgba(16,20,58,.16)" style={{ border: "1.5px solid rgba(16,20,58,.16)", boxShadow: "none" }}>
              Nova aula
            </PhysicalButton>
          </div>
        </div>
      </div>
    </div>
  );
}
