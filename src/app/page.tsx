"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, Button, SectionLabel, Spark, ProcessingAnimation } from "@/components/ui";
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

  return (
    <div style={{ minHeight: "100vh", padding: "24px 16px 100px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", color: "var(--ink-on-dark)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <img src="/unblocking-minds-logo-light.png" alt="Unblocking Minds" style={{ height: 34, width: "auto" }} />
          <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 28, fontWeight: 800, lineHeight: 1.15 }}>
            +Unblocking
          </div>
          <Spark size={16} style={{ marginTop: -14 }} />
        </div>
        <div
          style={{
            fontFamily: "'Caveat', cursive",
            fontSize: 21,
            fontWeight: 600,
            color: "var(--mustard-bright)",
            marginBottom: 22,
          }}
        >
          {stage === "setup" && (studentName ? `Bem-vindo(a) de volta, ${studentName.split(" ")[0]}!` : "Respire, fale e desbloqueie, com uma aula nova a cada dia")}
          {stage === "loading" && "Montando a aula de hoje…"}
          {stage === "session" && content?.topic && `${content.topic.title} · nível ${level}`}
          {stage === "report" && "Relatório da aula"}
        </div>

        {stage === "session" && (
          <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
            {SKILL_ORDER.map((_, i) => (
              <div key={i} style={{ height: 3, flex: 1, background: i <= skillIdx ? "var(--teal)" : "var(--line)", borderRadius: 2 }} />
            ))}
          </div>
        )}

        {stage === "setup" && (
          <div>
            {achievements.length > 0 && (
              <Card className="fade-in-up" style={{ marginBottom: 16, background: "#1f2b4a", border: "1px solid var(--line-on-dark)", color: "var(--ink-on-dark)" }}>
                <SectionLabel>
                  <span style={{ color: "var(--muted-on-dark)" }}>Suas conquistas</span>
                </SectionLabel>
                <AchievementStrip achievements={achievements} nextAchievement={nextAchievement} onDark />
              </Card>
            )}

            <Card
              className="fade-in-up"
              style={{
                marginBottom: 16,
                background: "linear-gradient(155deg, #f3e354, #f6a017)",
                border: "none",
                color: "var(--ink)",
              }}
            >
              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>
                “{quote.text}”
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 8, opacity: 0.85 }}>
                — {quote.author}{quote.context ? `, ${quote.context}` : ""}
              </div>
            </Card>

            <Card style={{ marginBottom: 20 }}>
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
              <Card style={{ borderColor: "var(--teal)", background: "#fffdf7" }}>
                <SectionLabel>Aula para finalizar</SectionLabel>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{pending.topicTitle}</div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
                  Nível {pending.level} · você parou em{" "}
                  {SKILL_META[SKILL_ORDER[pending.skillIndex || 0]]?.label?.toLowerCase() || "leitura"}
                </div>
                <Button onClick={resumeSession} style={{ width: "100%", padding: "13px 0" }}>
                  Continuar de onde parei
                </Button>
                {!confirmandoDescarteInicial ? (
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 12, textAlign: "center" }}>
                    Quer começar outra?{" "}
                    <span
                      onClick={() => setConfirmandoDescarteInicial(true)}
                      style={{ color: "var(--wine)", cursor: "pointer", fontWeight: 600 }}
                    >
                      Descartar esta aula
                    </span>
                  </div>
                ) : (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                    <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12 }}>
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
                          color: "var(--muted)",
                          border: "1px solid var(--line)",
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
              </Card>
            ) : level ? (
              <Button onClick={startSession} style={{ width: "100%", padding: "13px 0" }}>
                Começar aula de hoje · nível {level}
              </Button>
            ) : (
              <Card style={{ textAlign: "center", borderColor: "var(--mustard)" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>⏳</div>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>Aguardando seu nível</div>
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  Um administrador do +Unblocking ainda vai definir seu nível de proficiência (CEFR). Assim que isso
                  acontecer, você já poderá começar a praticar.
                </div>
              </Card>
            )}
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

        {stage === "session" && content && sessionId && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 20 }}>{SKILL_META[currentSkill].icon}</span>
              <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 19, fontWeight: 600 }}>
                {SKILL_META[currentSkill].label}
              </span>
            </div>
            {currentSkill === "reading" && (
              <ReadingBlock sessionId={sessionId} data={content.reading} onDifficulty={addLog} onNext={nextSkill} isLast={skillIdx === SKILL_ORDER.length - 1} />
            )}
            {currentSkill === "grammar" && (
              <GrammarBlock sessionId={sessionId} data={content.grammar} onDifficulty={addLog} onNext={nextSkill} isLast={skillIdx === SKILL_ORDER.length - 1} />
            )}
            {currentSkill === "listening" && (
              <ListeningBlock sessionId={sessionId} data={content.listening} onDifficulty={addLog} onNext={nextSkill} isLast={skillIdx === SKILL_ORDER.length - 1} />
            )}
            {currentSkill === "speaking" && (
              <SpeakingBlock sessionId={sessionId} level={level} data={content.speaking} onDifficulty={addLog} onNext={nextSkill} isLast={skillIdx === SKILL_ORDER.length - 1} />
            )}
            {currentSkill === "writing" && (
              <WritingBlock sessionId={sessionId} level={level} data={content.writing} onDifficulty={addLog} onNext={nextSkill} isLast={skillIdx === SKILL_ORDER.length - 1} />
            )}

            {/* Sair da aula: guardando o progresso, ou descartando tudo. */}
            <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--line-on-dark)" }}>
              {!confirmandoSaida ? (
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <button
                    onClick={finishLater}
                    style={{
                      padding: "10px 18px",
                      background: "transparent",
                      color: "var(--ink-on-dark)",
                      border: "1px solid var(--line-on-dark)",
                      borderRadius: 3,
                      fontFamily: "inherit",
                      fontWeight: 600,
                      fontSize: 13.5,
                      cursor: "pointer",
                    }}
                  >
                    Terminar depois
                  </button>
                  <button
                    onClick={() => setConfirmandoSaida(true)}
                    style={{
                      padding: "10px 18px",
                      background: "transparent",
                      color: "var(--muted-on-dark)",
                      border: "1px solid var(--line-on-dark)",
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
        )}

        {stage === "report" && (
          <ReportView loading={reportLoading} report={report} topic={content?.topic} level={level} onRestart={restart} log={log} />
        )}
      </div>
      <BottomNav onSignOut={signOut} isAdmin={isAdmin} />
    </div>
  );
}

function StreakAndAchievements({ streak, unlockedAchievements }: any) {
  if (!streak && (!unlockedAchievements || unlockedAchievements.length === 0)) return null;
  return (
    <Card style={{ marginBottom: 16, textAlign: "center" }}>
      {streak && streak.currentStreak > 0 && (
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 15, fontWeight: 700, marginBottom: unlockedAchievements?.length ? 12 : 0 }}>
          🔥 {streak.currentStreak} {streak.currentStreak === 1 ? "dia seguido" : "dias seguidos"} de prática
          {streak.longestStreak > streak.currentStreak && (
            <span style={{ fontWeight: 400, fontSize: 12.5, color: "var(--muted)" }}>
              {" "}
              · seu recorde é {streak.longestStreak}
            </span>
          )}
        </div>
      )}
      {unlockedAchievements?.length > 0 && (
        <div>
          <div style={{ fontFamily: "'Caveat', cursive", fontSize: 19, color: "var(--mustard-bright)", marginBottom: 8 }}>
            Nova{unlockedAchievements.length > 1 ? "s" : ""} conquista{unlockedAchievements.length > 1 ? "s" : ""} desbloqueada{unlockedAchievements.length > 1 ? "s" : ""}!
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            {unlockedAchievements.map((a: any) => (
              <div
                key={a.code}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  minWidth: 120,
                  maxWidth: 160,
                }}
              >
                <div style={{ fontSize: 22, marginBottom: 2 }}>{a.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{a.title}</div>
                <div style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 2 }}>{a.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ReportView({ loading, report, topic, level, onRestart, log }: any) {
  if (loading) {
    return (
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
    );
  }
  if (!report) return null;

  if (report._saveFailed) {
    return (
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
    );
  }

  return (
    <div>
      <StreakAndAchievements streak={report.streak} unlockedAchievements={report.unlockedAchievements} />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <SectionLabel>Tema de hoje</SectionLabel>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 17 }}>{topic?.title}</div>
          </div>
          {typeof report.scores?.overall === "number" && (
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--teal)" }}>
                {report.scores.overall.toFixed(1)}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted)" }}>nota geral</div>
            </div>
          )}
        </div>
        <p style={{ fontSize: 14, lineHeight: 1.6, marginTop: 10 }}>{report.summary}</p>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {Object.entries(SKILL_META).map(([key, meta]: any) => {
          const s = report.bySkill?.[key];
          const color = s?.score === "forte" ? "var(--teal)" : s?.score === "a desenvolver" ? "var(--wine)" : "var(--mustard)";
          return (
            <Card key={key} style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                {meta.icon} {meta.label}
              </div>
              {s ? (
                <>
                  <div style={{ fontSize: 11.5, color, fontWeight: 600, marginBottom: 4, textTransform: "capitalize" }}>
                    {s.score}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#4a4636", lineHeight: 1.4 }}>{s.note}</div>
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>Sem dados</div>
              )}
            </Card>
          );
        })}
      </div>

      {report.recurringDifficulties?.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
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

      {log.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <SectionLabel>Registro detalhado da aula</SectionLabel>
          {log.map((l: any, i: number) => (
            <div key={i} style={{ fontSize: 12.5, marginBottom: 6, color: "#4a4636" }}>
              <strong>{l.skill}</strong> · {l.area}: {l.note}
            </div>
          ))}
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

      <ShareResultButton
        topicTitle={topic?.title || "Aula de inglês"}
        topicKind={topic?.kind}
        level={level || ""}
        overall={typeof report.scores?.overall === "number" ? report.scores.overall : null}
        bySkill={report.bySkill || {}}
      />

      <Button onClick={onRestart} style={{ width: "100%", padding: "12px 0" }}>
        Nova aula
      </Button>
    </div>
  );
}
