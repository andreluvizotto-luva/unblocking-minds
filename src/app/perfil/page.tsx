"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, Button, SectionLabel, Spark } from "@/components/ui";
import { EvolutionChart } from "@/components/EvolutionChart";
import { BottomNav } from "@/components/BottomNav";
import { checkAccessOrRedirect } from "@/lib/access-check";
import { AchievementStrip, type AchievementItem } from "@/components/Gamification";

type AdminOverview = {
  totalStudents: number;
  activeLast7Days: number;
  activeLast30Days: number;
  totalSessions: number;
  completedSessions: number;
  inProgressSessions: number;
  signupsWithoutFirstSession: number;
  levelDistribution: Record<string, number>;
  topicKindDistribution: Record<string, number>;
  avgScoreBySkill: Record<string, number | null>;
  topDifficultyAreas: { area: string; count: number }[];
};

type SessionRow = {
  id: string;
  created_at: string;
  level: string;
  topic_kind: string;
  topic_title: string;
  status: string;
  reports: { summary: string; scores: any; created_at: string }[] | null;
};

const SKILL_LABELS: Record<string, string> = {
  reading: "Leitura",
  grammar: "Gramática",
  listening: "Escuta",
  speaking: "Fala",
  writing: "Escrita",
};

function AdminStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: "var(--muted)" }}>{label}</div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function PerfilPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [tab, setTab] = useState<"evolucao" | "historico">("evolucao");
  const [editing, setEditing] = useState(false);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminOverview, setAdminOverview] = useState<AdminOverview | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [nextAchievement, setNextAchievement] = useState<AchievementItem | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      const ok = await checkAccessOrRedirect(supabase, data.user.id, router);
      if (!ok) return;
      setCheckingAuth(false);
      await loadAll(data.user.id);
    });
  }, []);

  async function loadAdminOverview() {
    setAdminLoading(true);
    setAdminError("");
    try {
      const res = await fetch("/api/admin/overview");
      if (!res.ok) throw new Error("Falha ao carregar o painel de admin");
      setAdminOverview(await res.json());
    } catch (e: any) {
      setAdminError(e.message || "Erro ao carregar o painel de admin");
    } finally {
      setAdminLoading(false);
    }
  }

  async function loadAll(userId: string) {
    setLoadingData(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, bio, location, website, avatar_url, is_admin")
      .eq("id", userId)
      .single();

    if (profile) {
      setName(profile.name || "");
      setBio(profile.bio || "");
      setLocation(profile.location || "");
      setWebsite(profile.website || "");
      setAvatarUrl(profile.avatar_url || "");
      setIsAdmin(!!profile.is_admin);
      if (profile.is_admin) loadAdminOverview();
    }

    try {
      const gamRes = await fetch("/api/profile/gamification");
      if (gamRes.ok) {
        const gam = await gamRes.json();
        setCurrentStreak(gam.currentStreak || 0);
        setLongestStreak(gam.longestStreak || 0);
        setAchievements(gam.achievements || []);
        setNextAchievement(gam.nextAchievement || null);
      }
    } catch {
      // sequência e conquistas são um bônus visual — se falhar, o resto do perfil segue normal
    }

    const { data: sessionsData, error: sessionsErr } = await supabase
      .from("sessions")
      .select("id, created_at, level, topic_kind, topic_title, status")
      .order("created_at", { ascending: true });

    if (sessionsErr) {
      console.error("Erro ao buscar sessões:", sessionsErr);
    }

    const sessionIds = (sessionsData || []).map((s) => s.id);
    let reportsBySessionId: Record<string, any> = {};

    if (sessionIds.length > 0) {
      const { data: reportsData, error: reportsErr } = await supabase
        .from("reports")
        .select("session_id, summary, scores, created_at")
        .in("session_id", sessionIds);

      if (reportsErr) {
        console.error("Erro ao buscar relatórios:", reportsErr);
      }
      (reportsData || []).forEach((r: any) => {
        reportsBySessionId[r.session_id] = r;
      });
    }

    const merged = (sessionsData || []).map((s: any) => ({
      ...s,
      reports: reportsBySessionId[s.id] ? [reportsBySessionId[s.id]] : [],
    }));

    setSessions(merged);
    setLoadingData(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function saveProfile() {
    setSavingProfile(true);
    setSavedMsg("");
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase
        .from("profiles")
        .update({ name, bio, location, website, avatar_url: avatarUrl })
        .eq("id", data.user.id);
      setSavedMsg("Perfil salvo.");
      setTimeout(() => setSavedMsg(""), 2500);
      setEditing(false);
    }
    setSavingProfile(false);
  }

  if (checkingAuth) return null;

  const completed = sessions.filter((s) => s.reports && s.reports.length > 0);

  const chartPoints = completed.map((s) => {
    const scores = s.reports?.[0]?.scores || {};
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

  const lastScores = completed.length > 0 ? completed[completed.length - 1].reports?.[0]?.scores : null;
  const initial = (name || "?").trim().charAt(0).toUpperCase();

  return (
    <div style={{ minHeight: "100vh", padding: "24px 16px 100px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", color: "var(--ink-on-dark)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 800 }}>Perfil</div>
            <Spark size={13} style={{ marginTop: -12 }} />
          </div>
          <img src="/unblocking-minds-logo-light.png" alt="Unblocking Minds" style={{ height: 26, width: "auto" }} />
        </div>

        {isAdmin && (
          <Card style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <SectionLabel>Painel de admin</SectionLabel>
              <Button
                variant="subtle"
                style={{ padding: "5px 12px", fontSize: 12 }}
                onClick={() => router.push("/admin")}
              >
                Gerenciar alunos →
              </Button>
            </div>

            {adminLoading && <div style={{ fontSize: 13, color: "var(--muted)" }}>Carregando…</div>}
            {adminError && <div style={{ fontSize: 12.5, color: "var(--wine)" }}>{adminError}</div>}

            {adminOverview && (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginBottom: 14 }}>
                  <AdminStat label="Alunos" value={adminOverview.totalStudents} />
                  <AdminStat label="Ativos (7d)" value={adminOverview.activeLast7Days} />
                  <AdminStat label="Ativos (30d)" value={adminOverview.activeLast30Days} />
                  <AdminStat label="Aulas concluídas" value={adminOverview.completedSessions} />
                  <AdminStat label="Em andamento" value={adminOverview.inProgressSessions} />
                  <AdminStat label="Sem 1ª aula" value={adminOverview.signupsWithoutFirstSession} />
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                  <div style={{ flex: "1 1 220px" }}>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Nota média por habilidade</div>
                    {Object.entries(adminOverview.avgScoreBySkill).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0" }}>
                        <span style={{ color: "var(--muted)", textTransform: "capitalize" }}>{k}</span>
                        <span style={{ fontWeight: 700 }}>{v ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ flex: "1 1 220px" }}>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Distribuição por nível</div>
                    {Object.entries(adminOverview.levelDistribution).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "2px 0" }}>
                        <span style={{ color: "var(--muted)" }}>{k}</span>
                        <span style={{ fontWeight: 700 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {adminOverview.topDifficultyAreas.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>Dificuldades mais recorrentes</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {adminOverview.topDifficultyAreas.slice(0, 6).map((d) => (
                        <span
                          key={d.area}
                          style={{
                            fontSize: 11.5,
                            padding: "4px 10px",
                            borderRadius: 20,
                            background: "#f5efe0",
                            color: "var(--ink)",
                          }}
                        >
                          {d.area} · {d.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        {(currentStreak > 0 || achievements.some((a) => a.unlocked) || achievements.length > 0) && (
          <Card style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <SectionLabel>Sequência e conquistas</SectionLabel>
              {currentStreak > 0 && (
                <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14, fontWeight: 700 }}>
                  🔥 {currentStreak} {currentStreak === 1 ? "dia seguido" : "dias seguidos"}
                </div>
              )}
            </div>
            {longestStreak > 0 && (
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 12 }}>
                Recorde pessoal: {longestStreak} {longestStreak === 1 ? "dia" : "dias"} seguidos
              </div>
            )}
            <AchievementStrip achievements={achievements} nextAchievement={nextAchievement} onDark={false} />
          </Card>
        )}

        {/* Cabeçalho estilo rede social: avatar + estatísticas */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 14 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: "50%",
              flexShrink: 0,
              background: avatarUrl ? `url(${avatarUrl}) center/cover no-repeat` : "#f5efe0",
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Poppins', sans-serif",
              fontSize: 26,
              fontWeight: 600,
              color: "var(--muted)",
            }}
          >
            {!avatarUrl && initial}
          </div>
          <div style={{ display: "flex", flex: 1, justifyContent: "space-around", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{completed.length}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted-on-dark)" }}>Aulas</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--teal)" }}>
                {typeof lastScores?.overall === "number" ? lastScores.overall.toFixed(1) : "—"}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted-on-dark)" }}>última nota</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{sessions[sessions.length - 1]?.level || "—"}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted-on-dark)" }}>nível</div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          {name && <div style={{ fontSize: 14.5, fontWeight: 600 }}>{name}</div>}
          {bio && <div style={{ fontSize: 13, marginTop: 3, lineHeight: 1.5 }}>{bio}</div>}
          {location && (
            <div style={{ fontSize: 12, color: "var(--muted-on-dark)", marginTop: 3 }}>📍 {location}</div>
          )}
          {website && (
            <a
              href={website.startsWith("http") ? website : `https://${website}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: "var(--teal)", marginTop: 3, display: "block" }}
            >
              🔗 {website}
            </a>
          )}
          {!name && !bio && !location && !website && (
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: "var(--mustard-bright)" }}>
              Nada por aqui ainda. Preencher o perfil é opcional.
            </div>
          )}
        </div>

        <Button
          variant="subtle"
          onClick={() => setEditing((v) => !v)}
          style={{ width: "100%", padding: "9px 0", marginBottom: 20 }}
        >
          {editing ? "Fechar edição" : "Editar perfil"}
        </Button>

        {editing && (
          <Card style={{ marginBottom: 20 }}>
            <SectionLabel>Meu perfil</SectionLabel>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
              Nada aqui é obrigatório, preencha só o que quiser.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <input
                placeholder="Nome de exibição"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="Localização (ex: São Paulo, BR)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="Site ou rede social (URL)"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                style={inputStyle}
              />
              <input
                placeholder="URL da foto de perfil"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                style={inputStyle}
              />
            </div>
            <textarea
              placeholder="Bio curta: conte um pouco sobre por que está aprendendo inglês"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              style={{ ...inputStyle, width: "100%", resize: "vertical", marginTop: 10 }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
              <Button onClick={saveProfile} disabled={savingProfile} style={{ padding: "9px 18px" }}>
                {savingProfile ? "Salvando…" : "Salvar perfil"}
              </Button>
              {savedMsg && <span style={{ fontSize: 12.5, color: "var(--teal)" }}>{savedMsg}</span>}
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 12 }}>
              <a
                href="https://wa.me/c/5515974065619"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--muted)" }}
              >
                💬 Fale com a gente no WhatsApp
              </a>
              <a
                href="https://www.instagram.com/missgasparandrea/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--muted)" }}
              >
                📷 Siga @missgasparandrea
              </a>
            </div>
          </Card>
        )}

        {/* Abas estilo rede social */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--line-on-dark)", marginBottom: 18 }}>
          {[
            { key: "evolucao", label: "📈 Evolução" },
            { key: "historico", label: "🗂️ Histórico" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "10px 0",
                fontSize: 13,
                fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? "var(--ink-on-dark)" : "var(--muted-on-dark)",
                borderBottom: tab === t.key ? "2px solid var(--teal)" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "evolucao" && (
          <Card>
            <SectionLabel>Evolução por habilidade</SectionLabel>
            {loadingData ? (
              <div style={{ fontSize: 13, color: "var(--muted)", padding: "20px 0" }}>Carregando…</div>
            ) : (
              <EvolutionChart points={chartPoints} />
            )}
          </Card>
        )}

        {tab === "historico" && (
          <Card>
            <SectionLabel>Histórico de aulas</SectionLabel>
            {loadingData ? (
              <div style={{ fontSize: 13, color: "var(--muted)", padding: "10px 0" }}>Carregando…</div>
            ) : sessions.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)", padding: "10px 0" }}>
                Você ainda não completou nenhuma aula.
              </div>
            ) : (
              <div>
                {[...sessions].reverse().map((s) => {
                  const report = s.reports?.[0];
                  const scores = report?.scores;
                  return (
                    <div key={s.id} style={{ borderTop: "1px solid var(--line)", padding: "12px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{s.topic_title}</div>
                          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                            {formatDate(s.created_at)} · nível {s.level} ·{" "}
                            {s.status === "completed" ? "concluída" : "em andamento"}
                          </div>
                        </div>
                        {typeof scores?.overall === "number" && (
                          <div style={{ textAlign: "center", flexShrink: 0 }}>
                            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--teal)" }}>
                              {scores.overall.toFixed(1)}
                            </div>
                            <div style={{ fontSize: 9.5, color: "var(--muted)" }}>geral</div>
                          </div>
                        )}
                      </div>
                      {scores && (
                        <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                          {Object.entries(SKILL_LABELS).map(([key, label]) => {
                            const v = scores[key];
                            if (typeof v !== "number") return null;
                            return (
                              <div key={key} style={{ fontSize: 11.5, color: "var(--muted)" }}>
                                {label}: <strong style={{ color: "var(--ink)" }}>{v.toFixed(1)}</strong>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {report?.summary && (
                        <div style={{ fontSize: 12.5, color: "#4a4636", marginTop: 8, lineHeight: 1.5 }}>
                          {report.summary}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>
      <BottomNav onSignOut={signOut} />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 3,
  padding: "9px 12px",
  fontSize: 13.5,
  background: "#fbf8f1",
};
