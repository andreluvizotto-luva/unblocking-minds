"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, Button, SectionLabel, Spark, Switch } from "@/components/ui";

type Overview = {
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

type Student = {
  id: string;
  email: string;
  name: string | null;
  defaultLevel: string | null;
  isAdmin: boolean;
  isActive: boolean;
  approvedAt: string | null;
  passwordExpiresAt: string | null;
  createdAt: string;
  totalSessions: number;
  completedSessions: number;
  lastSessionAt: string | null;
  lastLevel: string | null;
  lastOverallScore: number | null;
};

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

const SKILL_LABELS: Record<string, string> = {
  reading: "Leitura",
  grammar: "Gramática",
  listening: "Escuta",
  speaking: "Fala",
  writing: "Escrita",
  overall: "Geral",
};

const TOPIC_LABELS: Record<string, string> = {
  news: "Assunto do momento",
  music: "Música",
  biography: "Biografia",
  travel: "Viagem",
  work: "Trabalho",
  health: "Saúde e Bem-Estar",
  sports: "Esportes",
  cooking: "Culinária",
  technology: "Tecnologia",
  astrology: "Astrologia",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ flex: "1 1 120px", minWidth: 120 }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

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
      await loadAll();
    });
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [ovRes, stRes] = await Promise.all([fetch("/api/admin/overview"), fetch("/api/admin/students")]);
      if (!ovRes.ok || !stRes.ok) throw new Error("Falha ao carregar dados do painel");
      const ov = await ovRes.json();
      const st = await stRes.json();
      setOverview(ov);
      setStudents(st.students);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }

  async function patchStudent(id: string, body: any) {
    setSavingId(id);
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
      setStudents((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                ...("isActive" in body ? { isActive: body.isActive } : {}),
                ...("passwordExpiresAt" in body ? { passwordExpiresAt: body.passwordExpiresAt } : {}),
                ...("isAdmin" in body ? { isAdmin: body.isAdmin } : {}),
              }
            : s
        )
      );
    } catch (e: any) {
      setError(e.message || "Erro ao salvar");
    } finally {
      setSavingId(null);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (checkingAuth || !allowed) return null;

  const filtered = students.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (s.name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q);
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        color: "var(--ink-on-dark)",
        padding: "24px 16px 60px",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1 style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 22, margin: 0 }}>
              Painel de admin
            </h1>
            <Spark size={14} style={{ marginTop: -10 }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="subtle" onClick={() => router.push("/")}>Voltar ao app</Button>
            <Button variant="ghost" onClick={signOut}>Sair</Button>
          </div>
        </div>

        {error && (
          <Card style={{ marginBottom: 16, borderColor: "var(--wine)" }}>
            <span style={{ color: "var(--wine)" }}>{error}</span>
          </Card>
        )}

        {loading && <Card>Carregando…</Card>}

        {!loading && overview && (
          <>
            <Card style={{ marginBottom: 16 }}>
              <SectionLabel>Visão geral</SectionLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                <StatTile label="Alunos" value={overview.totalStudents} />
                <StatTile label="Ativos (7 dias)" value={overview.activeLast7Days} />
                <StatTile label="Ativos (30 dias)" value={overview.activeLast30Days} />
                <StatTile label="Aulas totais" value={overview.totalSessions} />
                <StatTile label="Aulas concluídas" value={overview.completedSessions} />
                <StatTile label="Aulas em andamento" value={overview.inProgressSessions} />
                <StatTile label="Sem 1ª aula" value={overview.signupsWithoutFirstSession} />
              </div>
            </Card>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
              <Card style={{ flex: "1 1 260px" }}>
                <SectionLabel>Nota média por habilidade</SectionLabel>
                {Object.entries(overview.avgScoreBySkill).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}>
                    <span style={{ color: "var(--muted)" }}>{SKILL_LABELS[k] || k}</span>
                    <span style={{ fontWeight: 700 }}>{v ?? "—"}</span>
                  </div>
                ))}
              </Card>

              <Card style={{ flex: "1 1 260px" }}>
                <SectionLabel>Distribuição por nível</SectionLabel>
                {Object.entries(overview.levelDistribution).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}>
                    <span style={{ color: "var(--muted)" }}>{k}</span>
                    <span style={{ fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </Card>

              <Card style={{ flex: "1 1 260px" }}>
                <SectionLabel>Temas mais praticados</SectionLabel>
                {Object.entries(overview.topicKindDistribution)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, padding: "3px 0" }}>
                      <span style={{ color: "var(--muted)" }}>{TOPIC_LABELS[k] || k}</span>
                      <span style={{ fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
              </Card>
            </div>

            {overview.topDifficultyAreas.length > 0 && (
              <Card style={{ marginBottom: 16 }}>
                <SectionLabel>Dificuldades mais recorrentes</SectionLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {overview.topDifficultyAreas.map((d) => (
                    <span
                      key={d.area}
                      style={{
                        fontSize: 12.5,
                        padding: "5px 12px",
                        borderRadius: 20,
                        background: "#f5efe0",
                        color: "var(--ink)",
                      }}
                    >
                      {d.area} · {d.count}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
                <SectionLabel>Alunos ({filtered.length})</SectionLabel>
                <input
                  placeholder="Buscar por nome ou e-mail…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    padding: "7px 10px",
                    borderRadius: 3,
                    border: "1px solid var(--line)",
                    fontSize: 13,
                    minWidth: 220,
                  }}
                />
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                      <th style={{ padding: "6px 8px" }}>Aluno</th>
                      <th style={{ padding: "6px 8px" }}>Nível (CEFR)</th>
                      <th style={{ padding: "6px 8px" }}>Aulas</th>
                      <th style={{ padding: "6px 8px" }}>Última</th>
                      <th style={{ padding: "6px 8px" }}>Ativo</th>
                      <th style={{ padding: "6px 8px" }}>Admin</th>
                      <th style={{ padding: "6px 8px" }}>Senha expira em</th>
                      <th style={{ padding: "6px 8px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => (
                      <tr key={s.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: "8px" }}>
                          <div style={{ fontWeight: 600 }}>{s.name || "(sem nome)"}</div>
                          <div style={{ color: "var(--muted)", fontSize: 11.5 }}>{s.email}</div>
                          {!s.isActive && !s.approvedAt && (
                            <span
                              style={{
                                display: "inline-block",
                                marginTop: 4,
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: "2px 8px",
                                borderRadius: 20,
                                background: "#fff2d6",
                                color: "var(--mustard)",
                              }}
                            >
                              ⏳ aguardando aprovação
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px" }}>
                          <select
                            value={s.defaultLevel || ""}
                            disabled={savingId === s.id}
                            onChange={(e) => patchStudent(s.id, { defaultLevel: e.target.value || null })}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 3,
                              border: "1px solid var(--line)",
                              fontSize: 12.5,
                              background: s.defaultLevel ? "#fff" : "#fff2d6",
                            }}
                          >
                            <option value="">— definir —</option>
                            {CEFR_LEVELS.map((lv) => (
                              <option key={lv} value={lv}>{lv}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: "8px" }}>
                          {s.completedSessions}/{s.totalSessions}
                        </td>
                        <td style={{ padding: "8px" }}>{formatDate(s.lastSessionAt)}</td>
                        <td style={{ padding: "8px" }}>
                          <Switch
                            checked={s.isActive}
                            disabled={savingId === s.id}
                            onChange={(next) => patchStudent(s.id, { isActive: next })}
                          />
                        </td>
                        <td style={{ padding: "8px" }}>
                          <Switch
                            checked={s.isAdmin}
                            disabled={savingId === s.id || s.id === currentUserId}
                            labelOn="Admin"
                            labelOff="Aluno"
                            onChange={(next) => {
                              if (!next && s.id === currentUserId) return;
                              const confirmMsg = next
                                ? `Tornar "${s.name || s.email}" administrador? Essa pessoa passará a ter acesso a este painel.`
                                : `Remover o acesso de admin de "${s.name || s.email}"?`;
                              if (window.confirm(confirmMsg)) patchStudent(s.id, { isAdmin: next });
                            }}
                          />
                        </td>
                        <td style={{ padding: "8px" }}>
                          <input
                            type="date"
                            value={s.passwordExpiresAt ? s.passwordExpiresAt.slice(0, 10) : ""}
                            disabled={savingId === s.id}
                            onChange={(e) => {
                              const v = e.target.value;
                              patchStudent(s.id, { passwordExpiresAt: v ? new Date(v + "T23:59:59").toISOString() : null });
                            }}
                            style={{
                              padding: "5px 8px",
                              borderRadius: 3,
                              border: "1px solid var(--line)",
                              fontSize: 12.5,
                            }}
                          />
                        </td>
                        <td style={{ padding: "8px" }}>
                          <Button variant="subtle" style={{ padding: "5px 12px", fontSize: 12.5 }} onClick={() => router.push(`/admin/${s.id}`)}>
                            Ver
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
