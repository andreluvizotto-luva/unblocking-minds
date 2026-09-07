"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, Button, SectionLabel, Spark, Switch } from "@/components/ui";
import { EvolutionChart } from "@/components/EvolutionChart";

type Difficulty = { session_id: string; skill: string; area: string; note: string; created_at: string };
type Report = { session_id: string; summary: string; scores: Record<string, number>; recurring_difficulties: string[] | null; created_at: string };
type SessionRow = {
  id: string;
  level: string;
  topic_kind: string;
  topic_title: string;
  status: string;
  created_at: string;
  report: Report | null;
  difficulties: Difficulty[];
};

type Detail = {
  id: string;
  email: string;
  profile: {
    name: string | null;
    bio: string | null;
    location: string | null;
    website: string | null;
    default_level: string | null;
    is_admin: boolean;
    is_active: boolean;
    approved_at: string | null;
    password_expires_at: string | null;
    created_at: string;
    current_streak: number | null;
    longest_streak: number | null;
    last_practice_date: string | null;
  };
  sessions: SessionRow[];
  skillProgress: { skill: string; difficulty_percent: number; consecutive_strong: number }[];
};

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const SKILL_LABELS: Record<string, string> = {
  reading: "Leitura",
  grammar: "Gramática",
  listening: "Escuta",
  speaking: "Fala",
  writing: "Escrita",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function daysSince(iso: string | null) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export default function AdminStudentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const supabase = supabaseBrowser();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single();
      if (!profile?.is_admin) {
        router.push("/");
        return;
      }
      setCurrentUserId(data.user.id);
      setAllowed(true);
      setCheckingAuth(false);
      await load();
    });
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/students/${id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao carregar aluno");
      }
      setDetail(await res.json());
    } catch (e: any) {
      setError(e.message || "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  // Exclusão definitiva. O servidor é quem realmente valida (não é admin
  // próprio, não é outro admin); aqui a confirmação por digitação existe
  // só para evitar o clique acidental numa ação que não tem volta.
  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/students/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao apagar");
      router.push("/admin");
    } catch (e: any) {
      setError(e.message || "Erro ao apagar");
      setDeleting(false);
    }
  }

  async function patch(body: any) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/students/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao salvar");
      }
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              profile: {
                ...prev.profile,
                ...("isActive" in body ? { is_active: body.isActive } : {}),
                ...("passwordExpiresAt" in body ? { password_expires_at: body.passwordExpiresAt } : {}),
                ...("isAdmin" in body ? { is_admin: body.isAdmin } : {}),
                ...("defaultLevel" in body ? { default_level: body.defaultLevel } : {}),
                ...("isActive" in body && body.isActive ? { approved_at: new Date().toISOString() } : {}),
              },
            }
          : prev
      );
    } catch (e: any) {
      setError(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (checkingAuth || !allowed) return null;

  const completedSessions = (detail?.sessions || []).filter((s) => s.report?.scores);

  const chartPoints = completedSessions.map((s) => {
    const scores = s.report?.scores || ({} as Record<string, number>);
    return {
      date: formatDate(s.created_at),
      reading: typeof scores.reading === "number" ? scores.reading : undefined,
      grammar: typeof scores.grammar === "number" ? scores.grammar : undefined,
      listening: typeof scores.listening === "number" ? scores.listening : undefined,
      speaking: typeof scores.speaking === "number" ? scores.speaking : undefined,
      writing: typeof scores.writing === "number" ? scores.writing : undefined,
      overall: typeof scores.overall === "number" ? scores.overall : undefined,
    };
  });

  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const sessionsLast2Weeks = (detail?.sessions || []).filter((s) => new Date(s.created_at).getTime() >= twoWeeksAgo).length;

  const lastPracticeIso = detail?.profile.last_practice_date || (completedSessions.length > 0 ? completedSessions[completedSessions.length - 1].created_at : null);
  const inactiveDays = daysSince(lastPracticeIso);
  const isInactive = inactiveDays !== null && inactiveDays >= 5;

  const difficultyCounts = new Map<string, { skill: string; area: string; count: number }>();
  (detail?.sessions || []).forEach((s) => {
    s.difficulties.forEach((d) => {
      const key = `${d.skill}::${d.area}`;
      const entry = difficultyCounts.get(key);
      if (entry) entry.count += 1;
      else difficultyCounts.set(key, { skill: d.skill, area: d.area, count: 1 });
    });
  });
  const topDifficulties = [...difficultyCounts.values()].sort((a, b) => b.count - a.count).slice(0, 3);

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", color: "var(--ink-on-dark)", padding: "24px 16px 60px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 20, margin: 0 }}>
              Detalhe do aluno
            </h1>
            <Spark size={13} style={{ marginTop: -10 }} />
          </div>
          <Button variant="subtle" onClick={() => router.push("/admin")}>← Voltar</Button>
        </div>

        {error && (
          <Card style={{ marginBottom: 16, borderColor: "var(--wine)" }}>
            <span style={{ color: "var(--wine)" }}>{error}</span>
          </Card>
        )}

        {loading && <Card>Carregando…</Card>}

        {!loading && detail && (
          <>
            <Card style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17 }}>{detail.profile.name || "(sem nome)"}</div>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>{detail.email}</div>
                  {detail.profile.bio && <div style={{ fontSize: 13, marginTop: 6 }}>{detail.profile.bio}</div>}
                  <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>
                    Cadastrado em {formatDateTime(detail.profile.created_at)}
                  </div>
                  {!detail.profile.is_active && !detail.profile.approved_at && (
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "3px 10px",
                        borderRadius: 20,
                        background: "#fff2d6",
                        color: "var(--mustard)",
                      }}
                    >
                      ⏳ aguardando aprovação
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 200 }}>
                  <div>
                    <SectionLabel>Acesso do aluno</SectionLabel>
                    <Switch
                      checked={detail.profile.is_active}
                      disabled={saving}
                      labelOn="Habilitado"
                      labelOff="Desabilitado"
                      onChange={(next) => patch({ isActive: next })}
                    />
                  </div>
                  <div>
                    <SectionLabel>Nível de proficiência (CEFR)</SectionLabel>
                    <select
                      value={detail.profile.default_level || ""}
                      disabled={saving}
                      onChange={(e) => patch({ defaultLevel: e.target.value || null })}
                      style={{
                        padding: "7px 10px",
                        borderRadius: 3,
                        border: "1px solid var(--line)",
                        fontSize: 13,
                        background: detail.profile.default_level ? "#fff" : "#fff2d6",
                      }}
                    >
                      <option value="">— definir —</option>
                      {CEFR_LEVELS.map((lv) => (
                        <option key={lv} value={lv}>{lv}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <SectionLabel>Papel</SectionLabel>
                    <Switch
                      checked={detail.profile.is_admin}
                      disabled={saving || id === currentUserId}
                      labelOn="Administrador"
                      labelOff="Aluno"
                      onChange={(next) => {
                        if (!next && id === currentUserId) return;
                        const confirmMsg = next
                          ? `Tornar "${detail.profile.name || detail.email}" administrador? Essa pessoa passará a ter acesso a este painel.`
                          : `Remover o acesso de admin de "${detail.profile.name || detail.email}"?`;
                        if (window.confirm(confirmMsg)) patch({ isAdmin: next });
                      }}
                    />
                    {id === currentUserId && (
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                        Você não pode remover seu próprio acesso de admin.
                      </div>
                    )}
                  </div>
                  <div>
                    <SectionLabel>Senha expira em</SectionLabel>
                    <input
                      type="date"
                      value={detail.profile.password_expires_at ? detail.profile.password_expires_at.slice(0, 10) : ""}
                      disabled={saving}
                      onChange={(e) => {
                        const v = e.target.value;
                        patch({ passwordExpiresAt: v ? new Date(v + "T23:59:59").toISOString() : null });
                      }}
                      style={{ padding: "6px 9px", borderRadius: 3, border: "1px solid var(--line)", fontSize: 13 }}
                    />
                    {detail.profile.password_expires_at && (
                      <Button
                        variant="ghost"
                        style={{ marginLeft: 8, padding: "5px 10px", fontSize: 12 }}
                        disabled={saving}
                        onClick={() => patch({ passwordExpiresAt: null })}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            <Card style={{ marginBottom: 16 }}>
              <SectionLabel>Resumo de progresso</SectionLabel>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                <div
                  style={{
                    flex: "1 1 140px",
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "#f5efe0",
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Sequência atual</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>🔥 {detail.profile.current_streak ?? 0}</div>
                  <div style={{ fontSize: 10.5, color: "var(--muted)" }}>recorde: {detail.profile.longest_streak ?? 0} dias</div>
                </div>

                <div
                  style={{
                    flex: "1 1 140px",
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "#f5efe0",
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Aulas nas últimas 2 semanas</div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{sessionsLast2Weeks}</div>
                </div>

                <div
                  style={{
                    flex: "1 1 140px",
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: isInactive ? "#fbe3e3" : "#f5efe0",
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Última prática</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isInactive ? "var(--wine)" : "var(--ink)" }}>
                    {inactiveDays === null ? "—" : inactiveDays === 0 ? "hoje" : `há ${inactiveDays} dia${inactiveDays === 1 ? "" : "s"}`}
                  </div>
                  {isInactive && (
                    <div style={{ fontSize: 10.5, color: "var(--wine)", fontWeight: 600 }}>⚠ aluno inativo</div>
                  )}
                </div>
              </div>

              {chartPoints.length >= 2 ? (
                <EvolutionChart points={chartPoints} />
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: topDifficulties.length > 0 ? 12 : 0 }}>
                  Ainda não há aulas suficientes para mostrar a evolução por habilidade.
                </div>
              )}

              {topDifficulties.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Dificuldades mais recorrentes</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {topDifficulties.map((d, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                        <span>
                          {SKILL_LABELS[d.skill] || d.skill} · {d.area}
                        </span>
                        <span style={{ fontWeight: 700, color: "var(--muted)" }}>{d.count}x</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {detail.skillProgress.length > 0 && detail.skillProgress.some((s) => s.difficulty_percent > 0) && (
              <Card style={{ marginBottom: 16 }}>
                <SectionLabel>Dificuldade adaptativa por habilidade</SectionLabel>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 10 }}>
                  Aumenta 10% a cada 10 aulas seguidas avaliadas como "forte" naquela habilidade.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {detail.skillProgress
                    .filter((s) => s.difficulty_percent > 0)
                    .map((s) => (
                      <span
                        key={s.skill}
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          padding: "5px 12px",
                          borderRadius: 20,
                          background: "#f5efe0",
                          color: "var(--ink)",
                        }}
                      >
                        {SKILL_LABELS[s.skill] || s.skill}: +{s.difficulty_percent}%
                      </span>
                    ))}
                </div>
              </Card>
            )}

            <Card>
              <SectionLabel>Histórico de aulas ({detail.sessions.length})</SectionLabel>
              {detail.sessions.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13.5 }}>Nenhuma aula ainda.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[...detail.sessions].reverse().map((s) => (
                  <div key={s.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.topic_title}</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                          {s.level} · {formatDateTime(s.created_at)} · {s.status === "completed" ? "concluída" : "em andamento"}
                        </div>
                      </div>
                      {s.report?.scores && (
                        <div style={{ display: "flex", gap: 10, fontSize: 11.5 }}>
                          {Object.entries(s.report.scores)
                            .filter(([k]) => k !== "overall")
                            .map(([k, v]) => (
                              <span key={k}>
                                {SKILL_LABELS[k] || k}: <strong>{v as any}</strong>
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                    {s.difficulties.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {s.difficulties.map((d, i) => (
                          <span key={i} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 12, background: "#f5efe0", color: "var(--ink)" }}>
                            {SKILL_LABELS[d.skill] || d.skill}: {d.area}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ marginTop: 16, borderColor: "var(--wine)" }}>
              <SectionLabel>Apagar aluno</SectionLabel>
              {detail.profile.is_admin ? (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  Este aluno é administrador. Remova o acesso de admin acima antes de poder apagar a conta.
                </div>
              ) : currentUserId === detail.id ? (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>Você não pode apagar a sua própria conta.</div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.6, marginBottom: 12 }}>
                    Apaga a conta e <strong>todo o histórico</strong> deste aluno: {detail.sessions.length}{" "}
                    {detail.sessions.length === 1 ? "aula" : "aulas"}, relatórios, notas, dificuldades registradas e
                    conquistas. Não há como desfazer. Se a intenção for só tirar o acesso, use <em>desativar</em> acima.
                  </div>

                  {!showDelete ? (
                    <button
                      onClick={() => setShowDelete(true)}
                      style={{
                        padding: "9px 16px",
                        background: "transparent",
                        color: "var(--wine)",
                        border: "1px solid var(--wine)",
                        borderRadius: 3,
                        fontWeight: 600,
                        fontSize: 13.5,
                        cursor: "pointer",
                      }}
                    >
                      Apagar este aluno
                    </button>
                  ) : (
                    <div>
                      <div style={{ fontSize: 13, marginBottom: 8 }}>
                        Para confirmar, digite o nome do aluno:{" "}
                        <strong>{detail.profile.name || detail.email}</strong>
                      </div>
                      <input
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="Digite o nome para confirmar"
                        style={{
                          width: "100%",
                          padding: "9px 11px",
                          border: "1px solid var(--line)",
                          borderRadius: 3,
                          fontSize: 13.5,
                          marginBottom: 10,
                          fontFamily: "inherit",
                        }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={handleDelete}
                          disabled={
                            deleting ||
                            confirmText.trim() !== (detail.profile.name || detail.email).trim()
                          }
                          style={{
                            padding: "9px 16px",
                            background:
                              confirmText.trim() === (detail.profile.name || detail.email).trim()
                                ? "var(--wine)"
                                : "var(--line)",
                            color:
                              confirmText.trim() === (detail.profile.name || detail.email).trim()
                                ? "#fff"
                                : "var(--muted)",
                            border: "none",
                            borderRadius: 3,
                            fontWeight: 600,
                            fontSize: 13.5,
                            cursor:
                              confirmText.trim() === (detail.profile.name || detail.email).trim()
                                ? "pointer"
                                : "not-allowed",
                          }}
                        >
                          {deleting ? "Apagando…" : "Apagar definitivamente"}
                        </button>
                        <button
                          onClick={() => {
                            setShowDelete(false);
                            setConfirmText("");
                          }}
                          disabled={deleting}
                          style={{
                            padding: "9px 16px",
                            background: "transparent",
                            color: "var(--muted)",
                            border: "1px solid var(--line)",
                            borderRadius: 3,
                            fontWeight: 600,
                            fontSize: 13.5,
                            cursor: "pointer",
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
