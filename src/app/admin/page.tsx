"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, Button, SectionLabel, Spark } from "@/components/ui";
import { AdminStudents } from "@/components/AdminStudents";

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
  tokenUsage: {
    periodo: string;
    custoDeUmaAula: number;
    totalEntrada: number;
    totalSaida: number;
    totalChamadas: number;
    aulasConcluidas: number;
    mediaPorAula: number | null;
    porOperacao: { operacao: string; chamadas: number; entrada: number; saida: number; total: number }[];
  } | null;
};

const OPERACAO_LABELS: Record<string, string> = {
  session_generate: "Gerar aula",
  report_generate: "Gerar relatório",
  speaking_evaluate: "Avaliar fala",
  writing_evaluate: "Corrigir escrita",
  game_quiz: "Game: Quiz",
  game_guess: "Game: Who is it?",
  game_trivia: "Game: Trivia",
};

function milhares(n: number) {
  return n.toLocaleString("pt-BR");
}

type Student = {
  id: string;
  email: string;
  name: string | null;
  defaultLevel: string | null;
  isAdmin: boolean;
  isActive: boolean;
  approvedAt: string | null;
  passwordExpiresAt: string | null;
  category: string;
  accessUntil: string | null;
  createdAt: string;
  totalSessions: number;
  completedSessions: number;
  lastSessionAt: string | null;
  lastLevel: string | null;
  lastOverallScore: number | null;
};


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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Falha ao salvar");
      setStudents((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                ...("isActive" in body ? { isActive: body.isActive } : {}),
                ...("passwordExpiresAt" in body ? { passwordExpiresAt: body.passwordExpiresAt } : {}),
                ...("isAdmin" in body ? { isAdmin: body.isAdmin } : {}),
                ...("defaultLevel" in body ? { defaultLevel: body.defaultLevel } : {}),
                ...("category" in body ? { category: body.category } : {}),
                ...(data.accessUntil !== undefined ? { accessUntil: data.accessUntil } : {}),
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

            {overview.tokenUsage && overview.tokenUsage.totalChamadas > 0 && (
              <Card style={{ marginBottom: 16 }}>
                <SectionLabel>Consumo de tokens · últimos {overview.tokenUsage.periodo}</SectionLabel>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 22, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 700 }}>
                      {milhares(overview.tokenUsage.totalEntrada + overview.tokenUsage.totalSaida)}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>tokens no total</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 700 }}>
                      {milhares(overview.tokenUsage.custoDeUmaAula)}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>custo de uma aula completa</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 700 }}>
                      {overview.tokenUsage.mediaPorAula ? milhares(overview.tokenUsage.mediaPorAula) : "—"}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      gasto por aula concluída
                      {overview.tokenUsage.aulasConcluidas > 0 && ` (${overview.tokenUsage.aulasConcluidas})`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 700 }}>
                      {overview.tokenUsage.totalChamadas}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>chamadas à IA</div>
                  </div>
                </div>

                {overview.tokenUsage.mediaPorAula != null &&
                  overview.tokenUsage.mediaPorAula > overview.tokenUsage.custoDeUmaAula * 1.2 && (
                    <div
                      style={{
                        fontSize: 12,
                        lineHeight: 1.6,
                        color: "var(--muted)",
                        background: "#fbf8f1",
                        borderRadius: 8,
                        padding: "10px 12px",
                        marginBottom: 14,
                      }}
                    >
                      O gasto por aula concluída está{" "}
                      <strong style={{ color: "var(--ink)" }}>
                        {Math.round((overview.tokenUsage.mediaPorAula / overview.tokenUsage.custoDeUmaAula) * 10) / 10}x
                      </strong>{" "}
                      acima do custo de uma aula. A diferença é o que se gasta gerando aulas que o aluno abandona antes
                      de terminar.
                    </div>
                  )}

                <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 6 }}>
                  Por operação — a saída costuma custar bem mais caro que a entrada
                </div>
                {overview.tokenUsage.porOperacao.map((op) => {
                  const maior = overview.tokenUsage!.porOperacao[0]?.total || 1;
                  return (
                    <div key={op.operacao} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                        <span>
                          {OPERACAO_LABELS[op.operacao] || op.operacao}{" "}
                          <span style={{ color: "var(--muted)" }}>· {op.chamadas}x</span>
                        </span>
                        <span style={{ color: "var(--muted)" }}>
                          entrada {milhares(op.entrada)} · saída <strong style={{ color: "var(--ink)" }}>{milhares(op.saida)}</strong>
                        </span>
                      </div>
                      <div style={{ height: 5, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${(op.total / maior) * 100}%`, height: "100%", background: "var(--teal)" }} />
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}

            <AdminStudents
              students={students}
              savingId={savingId}
              patchStudent={patchStudent}
              onOpen={(id) => router.push(`/admin/${id}`)}
            />
          </>
        )}
      </div>
    </div>
  );
}
