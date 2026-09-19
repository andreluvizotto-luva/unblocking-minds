"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, Button, SectionLabel, Spark, PhysicalButton, ProcessingAnimation } from "@/components/ui";
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
];

const SKILL_ORDER = ["reading", "grammar", "listening", "speaking", "writing"];

// Lockup oficial da marca: "+Unblocking" seguido da fagulha, com um
// espaço normal entre os dois (não sobrepõe o texto) — nunca a logo antiga
// em PNG. Usa gap do flex em vez de margem negativa, então o espaçamento
// acompanha o tamanho da fonte em qualquer largura de tela.
function Lockup({ size = 20, color = "var(--ink-on-dark)" }: { size?: number; color?: string }) {
  const sparkSize = Math.round(size * 1.05);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.max(3, Math.round(size * 0.12)),
        fontFamily: "'Poppins', sans-serif",
        fontWeight: 600,
        fontSize: size,
        letterSpacing: "-0.01em",
        color,
        minWidth: 0,
      }}
    >
      <span style={{ whiteSpace: "nowrap" }}>+Unblocking</span>
      <img src="/spark.png" alt="" style={{ width: sparkSize, height: sparkSize, flexShrink: 0 }} />
    </span>
  );
}

// Trilha de progresso das 5 habilidades — a habilidade atual expande e
// mostra o nome completo, as demais colapsam para a abreviação de 4 letras.
function SkillTrack({ skillIdx }: { skillIdx: number }) {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "flex-end" }}>
      {SKILL_ORDER.map((key, i) => {
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
              {current ? meta.label : meta.label.slice(0, 4)}
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
    if (!level) return;
    setError("");
    setStage("loading");
    try {
      const res = await fetch("/api/session/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicKind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSessionId(data.sessionId);
      setContent(data.content);
      setLog([]);
      setSkillIdx(0);
      setStage("session");
    } catch (e: any) {
      setError(e.message || "Não foi possível gerar a aula. Tente novamente.");
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
    if (skillIdx < SKILL_ORDER.length - 1) {
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
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

  const currentSkill = SKILL_ORDER[skillIdx];

  const nextSkillLabel = skillIdx < SKILL_ORDER.length - 1 ? SKILL_META[SKILL_ORDER[skillIdx + 1]].label : undefined;

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
                {skillIdx + 1} de {SKILL_ORDER.length} · {SKILL_META[currentSkill].label}
              </span>
            </div>
            <SkillTrack skillIdx={skillIdx} />
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
                isLast={skillIdx === SKILL_ORDER.length - 1}
              />
            )}
            {currentSkill === "grammar" && (
              <GrammarBlock sessionId={sessionId} data={content.grammar} onDifficulty={addLog} onNext={nextSkill} isLast={skillIdx === SKILL_ORDER.length - 1} />
            )}
            {currentSkill === "listening" && (
              <ListeningBlock sessionId={sessionId} data={content.listening} onDifficulty={addLog} onNext={nextSkill} isLast={skillIdx === SKILL_ORDER.length - 1} />
            )}
            {currentSkill === "speaking" && (
              <SpeakingBlock sessionId={sessionId} level={level} data={content.speaking} readingRecap={content.reading} onDifficulty={addLog} onNext={nextSkill} isLast={skillIdx === SKILL_ORDER.length - 1} />
            )}
            {currentSkill === "writing" && (
              <WritingBlock sessionId={sessionId} level={level} data={content.writing} readingRecap={content.reading} onDifficulty={addLog} onNext={nextSkill} isLast={skillIdx === SKILL_ORDER.length - 1} />
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
                <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 14, color: "var(--muted-on-dark)" }}>Boa {new Date().getHours() < 12 ? "manhã" : new Date().getHours() < 18 ? "tarde" : "noite"},</span>
                <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 24, lineHeight: 1.15, fontWeight: 600, letterSpacing: "-0.01em" }}>
                  {studentName ? studentName.split(" ")[0] : "por aqui"}
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
                {TOPIC_KINDS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTopicKind(t.id)}
                    style={{
                      cursor: "pointer",
                      borderRadius: 20,
                      padding: "8px 16px",
                      fontSize: 13.5,
                      fontWeight: 500,
                      transition: "transform 0.12s ease, background 0.12s ease",
                      transform: topicKind === t.id ? "scale(1.04)" : "none",
                      border: topicKind === t.id ? "1px solid var(--teal)" : "1px solid var(--line)",
                      background: topicKind === t.id ? "var(--teal)" : "#fbf8f1",
                      color: "var(--ink)",
                    }}
                  >
                    {t.label}
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
                        const meta = SKILL_META[SKILL_ORDER[pending.skillIndex || 0]];
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
                    Pronta quando você estiver
                  </h2>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {SKILL_ORDER.map((key) => (
                    <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <span style={{ width: "100%", height: 5, borderRadius: 999, background: "#e2ddd0" }} />
                      <span style={{ fontFamily: "'Work Sans', sans-serif", fontSize: 9.5, color: "#7d7768", letterSpacing: "0.02em" }}>
                        {SKILL_META[key].label.slice(0, 4)}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Work Sans', sans-serif", fontSize: 13, color: "#5d5849" }}>
                  <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--sage)" }} />
                  <span>5 habilidades · cerca de 15-20 minutos</span>
                </div>
                <PhysicalButton onClick={startSession} background="var(--teal)" color="var(--ink)" shadowColor="var(--mustard)" style={{ gap: 8 }}>
                  <span>Começar aula de hoje</span>
                  <img src="/spark.png" alt="" style={{ width: 22, height: 22, flexShrink: 0, filter: "brightness(0) saturate(100%)" }} />
                </PhysicalButton>
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
                "Destravando novas palavras para hoje…",
                "Montando os exercícios de cada habilidade…",
                "Calibrando a dificuldade certa pro seu nível…",
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
                "Separando o que já está redondo…",
                "Encontrando o que vale destravar amanhã…",
                "Contando seus pontos fortes de hoje…",
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
                nas cinco habilidades
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
            {Object.entries(SKILL_META).map(([key, meta]: any) => {
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
