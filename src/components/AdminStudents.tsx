"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, Button, SectionLabel } from "./ui";
import { daysLeft } from "@/lib/access";

export type AdminStudent = {
  id: string;
  email: string;
  name: string | null;
  defaultLevel: string | null;
  isAdmin: boolean;
  isActive: boolean;
  passwordExpiresAt: string | null;
  category: string;
  accessUntil: string | null;
  createdAt: string;
  totalSessions: number;
  completedSessions: number;
  lastSessionAt: string | null;
};

type Billing = {
  assinantesEmDia: number;
  demosAtivas: number;
  vencendo7: number;
  vencidos: number;
  unblocking: number;
  receitaMesCents: number;
  pagamentosMes: number;
  conversao: number | null;
  pagantes: number;
  abandonados: { userId: string; name: string | null; email: string | null; createdAt: string; amountCents: number }[];
};

const DAY = 86_400_000;
const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const CATEGORY_BG: Record<string, string> = { demo: "#fff2d6", unblocking: "#e4ecdf", app: "#e3e8f7" };
const CATEGORY_LABEL: Record<string, string> = { demo: "Demo", unblocking: "Unblocking", app: "Assinante" };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—");

type Tone = "green" | "amber" | "red" | "gray";
const TONE: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: "#e4ecdf", fg: "#2f4a2a" },
  amber: { bg: "#fff2d6", fg: "#8a5a00" },
  red: { bg: "#f5e1e4", fg: "#8d2438" },
  gray: { bg: "#ece9e1", fg: "#5b5b5b" },
};

// Uma frase só para a situação do aluno, com cor — junta categoria, prazo,
// conta desativada e senha expirada, que antes ficavam em colunas separadas.
function situacao(s: AdminStudent, now: number): { label: string; tone: Tone; key: string } {
  if (s.isAdmin) return { label: "Admin", tone: "gray", key: "admin" };
  if (!s.isActive) return { label: "Desativado", tone: "gray", key: "disabled" };
  if (s.passwordExpiresAt && new Date(s.passwordExpiresAt).getTime() < now) return { label: "Senha expirada", tone: "gray", key: "disabled" };
  if (s.category === "unblocking") return { label: "Unblocking · incluso", tone: "green", key: "ok" };
  const until = s.accessUntil ? new Date(s.accessUntil).getTime() : 0;
  if (until > now) {
    const d = daysLeft(s.accessUntil, now);
    if (s.category === "demo") return { label: `Demo · ${d} ${d === 1 ? "dia" : "dias"}`, tone: "amber", key: d <= 3 ? "soon" : "ok" };
    if (d <= 3) return { label: `Vence em ${d} ${d === 1 ? "dia" : "dias"}`, tone: "amber", key: "soon" };
    return { label: `Assinante · até ${fmtDate(s.accessUntil)}`, tone: "green", key: "ok" };
  }
  const ha = until ? Math.max(1, Math.floor((now - until) / DAY)) : null;
  const quando = ha ? ` há ${ha} ${ha === 1 ? "dia" : "dias"}` : "";
  return { label: s.category === "demo" ? `Demo encerrada${quando}` : `Vencido${quando}`, tone: "red", key: "expired" };
}

const FILTERS: { id: string; label: string; test: (s: AdminStudent, sit: ReturnType<typeof situacao>, now: number) => boolean }[] = [
  { id: "all", label: "Todos", test: () => true },
  { id: "demo", label: "Demo", test: (s) => s.category === "demo" && !s.isAdmin },
  { id: "app", label: "Assinantes", test: (s) => s.category === "app" && !s.isAdmin },
  { id: "unblocking", label: "Unblocking", test: (s) => s.category === "unblocking" && !s.isAdmin },
  { id: "soon", label: "Vence em até 3 dias", test: (_s, sit) => sit.key === "soon" },
  { id: "expired", label: "Vencidos", test: (_s, sit) => sit.key === "expired" },
  { id: "noclass", label: "Sem aula ainda", test: (s) => !s.isAdmin && s.totalSessions === 0 },
  { id: "disabled", label: "Desativados", test: (_s, sit) => sit.key === "disabled" },
];

// Demo há mais de 1 dia sem nenhuma aula: maior risco de não converter.
const demoParada = (s: AdminStudent, now: number) =>
  !s.isAdmin && s.category === "demo" && s.totalSessions === 0 && now - new Date(s.createdAt).getTime() > DAY;

function useNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const on = () => setNarrow(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return narrow;
}

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, background: TONE[tone].bg, color: TONE[tone].fg, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: string; tone?: Tone }) {
  return (
    <div style={{ flex: "1 1 130px", minWidth: 120, padding: "10px 12px", borderRadius: 10, background: tone ? TONE[tone].bg : "#fbf8f1" }}>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 22, fontWeight: 700, color: tone ? TONE[tone].fg : "var(--ink)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const smallBtn: React.CSSProperties = { padding: "4px 10px", fontSize: 12, whiteSpace: "nowrap" };

export function AdminStudents({
  students,
  savingId,
  patchStudent,
  onOpen,
}: {
  students: AdminStudent[];
  savingId: string | null;
  patchStudent: (id: string, body: any) => Promise<void>;
  onOpen: (id: string) => void;
}) {
  const narrow = useNarrow();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"last" | "due" | "signup">("last");
  const [notice, setNotice] = useState<{ text: string; ok: boolean } | null>(null);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const now = Date.now();

  async function loadBilling() {
    try {
      const r = await fetch("/api/admin/billing");
      if (r.ok) setBilling(await r.json());
    } catch {}
  }
  useEffect(() => {
    loadBilling();
  }, []);

  async function patch(id: string, body: any) {
    await patchStudent(id, body);
    loadBilling();
  }

  async function remind(s: AdminStudent) {
    if (!window.confirm(`Enviar um lembrete de assinatura por e-mail para ${s.name || s.email}?`)) return;
    setRemindingId(s.id);
    setNotice(null);
    try {
      const r = await fetch(`/api/admin/students/${s.id}/remind`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error);
      setNotice({ text: `Lembrete enviado para ${s.email}.`, ok: true });
    } catch (e: any) {
      setNotice({ text: e?.message || "Não foi possível enviar o lembrete.", ok: false });
    }
    setRemindingId(null);
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const f = FILTERS.find((x) => x.id === filter) || FILTERS[0];
    const list = students
      .map((s) => ({ s, sit: situacao(s, now) }))
      .filter(({ s, sit }) => f.test(s, sit, now))
      .filter(({ s }) => !q || (s.name || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q));
    const t = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);
    list.sort((a, b) => {
      if (sort === "due") {
        const da = a.s.category === "unblocking" || a.s.isAdmin ? Infinity : t(a.s.accessUntil);
        const db = b.s.category === "unblocking" || b.s.isAdmin ? Infinity : t(b.s.accessUntil);
        return da - db;
      }
      if (sort === "signup") return t(b.s.createdAt) - t(a.s.createdAt);
      return t(b.s.lastSessionAt) - t(a.s.lastSessionAt);
    });
    return list;
  }, [students, search, filter, sort, now]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of FILTERS) c[f.id] = students.filter((s) => f.test(s, situacao(s, now), now)).length;
    return c;
  }, [students, now]);

  function Actions({ s }: { s: AdminStudent }) {
    const busy = savingId === s.id;
    const paga = !s.isAdmin && s.category !== "unblocking";
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: narrow ? "wrap" : "nowrap" }}>
        {paga && (
          <Button variant="ghost" style={smallBtn} disabled={busy} onClick={() => patch(s.id, { addDays: 30 })}>
            +30 dias
          </Button>
        )}
        {paga && (
          <Button
            variant="ghost"
            style={smallBtn}
            disabled={busy}
            onClick={() => window.confirm(`Tornar ${s.name || s.email} aluno Unblocking (acesso incluso, sem cobrança)?`) && patch(s.id, { category: "unblocking" })}
          >
            → Unblocking
          </Button>
        )}
        {paga && (
          <Button variant="ghost" style={smallBtn} disabled={remindingId === s.id} onClick={() => remind(s)}>
            {remindingId === s.id ? "Enviando…" : "Lembrete"}
          </Button>
        )}
        <Button variant="subtle" style={smallBtn} onClick={() => onOpen(s.id)}>
          Ver
        </Button>
      </div>
    );
  }

  function CategorySelect({ s }: { s: AdminStudent }) {
    if (s.isAdmin) return null;
    return (
      <select
        value={s.category}
        disabled={savingId === s.id}
        onChange={(e) => patch(s.id, { category: e.target.value })}
        style={{ padding: "2px 6px", borderRadius: 20, border: "1px solid var(--line)", fontSize: 11, fontWeight: 700, background: CATEGORY_BG[s.category] || "#fff" }}
      >
        {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
    );
  }

  function LevelSelect({ s }: { s: AdminStudent }) {
    return (
      <select
        value={s.defaultLevel || ""}
        disabled={savingId === s.id}
        onChange={(e) => patch(s.id, { defaultLevel: e.target.value || null })}
        style={{ padding: "4px 6px", borderRadius: 3, border: "1px solid var(--line)", fontSize: 12.5, background: s.defaultLevel ? "#fff" : "#fff2d6" }}
      >
        <option value="">—</option>
        {CEFR_LEVELS.map((lv) => (
          <option key={lv} value={lv}>
            {lv}
          </option>
        ))}
      </select>
    );
  }

  const Parada = () => (
    <span title="Em teste há mais de 1 dia e ainda não fez nenhuma aula" style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, color: "#8d2438" }}>
      ⚠ sem aula
    </span>
  );

  return (
    <>
      {billing && (
        <Card style={{ marginBottom: 16 }}>
          <SectionLabel>Assinaturas</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <Tile label="Receita do mês" value={brl(billing.receitaMesCents)} sub={`${billing.pagamentosMes} ${billing.pagamentosMes === 1 ? "pagamento" : "pagamentos"}`} />
            <Tile label="Assinantes em dia" value={billing.assinantesEmDia} tone="green" />
            <Tile label="Demos em andamento" value={billing.demosAtivas} tone="amber" />
            <Tile label="Vencem em 7 dias" value={billing.vencendo7} tone={billing.vencendo7 ? "amber" : undefined} />
            <Tile label="Vencidos" value={billing.vencidos} tone={billing.vencidos ? "red" : undefined} />
            <Tile
              label="Conversão demo → assinante"
              value={billing.conversao === null ? "—" : `${billing.conversao}%`}
              sub={`${billing.pagantes} ${billing.pagantes === 1 ? "já pagou" : "já pagaram"} · ${billing.unblocking} Unblocking`}
            />
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
          <SectionLabel>Alunos ({rows.length})</SectionLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: narrow ? "1 1 100%" : undefined }}>
            <input
              placeholder="Buscar por nome ou e-mail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: "7px 10px", borderRadius: 3, border: "1px solid var(--line)", fontSize: 13, flex: 1, minWidth: 180 }}
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              style={{ padding: "7px 8px", borderRadius: 3, border: "1px solid var(--line)", fontSize: 13, background: "#fff" }}
            >
              <option value="last">Última aula</option>
              <option value="due">Vencimento</option>
              <option value="signup">Cadastro mais recente</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {FILTERS.map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: "5px 11px",
                  borderRadius: 20,
                  border: on ? "1px solid var(--ink)" : "1px solid var(--line)",
                  background: on ? "var(--ink)" : "#fbf8f1",
                  color: on ? "#fff" : "var(--ink)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {f.label} · {counts[f.id]}
              </button>
            );
          })}
        </div>

        {notice && <div style={{ fontSize: 12.5, marginBottom: 10, color: notice.ok ? "#2f4a2a" : "#8d2438", fontWeight: 600 }}>{notice.text}</div>}

        {rows.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)", padding: "10px 0" }}>Nenhum aluno neste filtro.</div>
        ) : narrow ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map(({ s, sit }) => (
              <div key={s.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12, background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>
                      {s.name || "(sem nome)"}
                      {demoParada(s, now) && <Parada />}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 11.5, wordBreak: "break-all" }}>{s.email}</div>
                  </div>
                  <Badge tone={sit.tone}>{sit.label}</Badge>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "10px 0", fontSize: 12.5, color: "var(--ink)" }}>
                  <CategorySelect s={s} />
                  <LevelSelect s={s} />
                  <span style={{ color: "var(--muted)" }}>
                    {s.completedSessions}/{s.totalSessions} aulas · última {fmtDate(s.lastSessionAt)}
                  </span>
                </div>
                <Actions s={s} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                  <th style={{ padding: "6px 8px" }}>Aluno</th>
                  <th style={{ padding: "6px 8px" }}>Situação</th>
                  <th style={{ padding: "6px 8px" }}>Nível</th>
                  <th style={{ padding: "6px 8px" }}>Aulas</th>
                  <th style={{ padding: "6px 8px" }}>Última</th>
                  <th style={{ padding: "6px 8px" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ s, sit }) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "8px" }}>
                      <div style={{ fontWeight: 600 }}>
                        {s.name || "(sem nome)"}
                        {demoParada(s, now) && <Parada />}
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 11.5 }}>{s.email}</div>
                    </td>
                    <td style={{ padding: "8px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                        <Badge tone={sit.tone}>{sit.label}</Badge>
                        <CategorySelect s={s} />
                      </div>
                    </td>
                    <td style={{ padding: "8px" }}>
                      <LevelSelect s={s} />
                    </td>
                    <td style={{ padding: "8px" }}>
                      {s.completedSessions}/{s.totalSessions}
                    </td>
                    <td style={{ padding: "8px" }}>{fmtDate(s.lastSessionAt)}</td>
                    <td style={{ padding: "8px" }}>
                      <Actions s={s} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>
          Ativar ou desativar conta, papel de admin e validade de senha ficam em “Ver”.
        </div>
      </Card>

      {billing && billing.abandonados.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <SectionLabel>Pagamentos não concluídos (últimos 90 dias)</SectionLabel>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Abriram o pagamento e não pagaram. Vale um contato.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {billing.abandonados.map((a) => {
              const s = students.find((x) => x.id === a.userId);
              return (
                <div key={a.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 13, color: "var(--ink)" }}>
                  <span>
                    <strong>{a.name || "(sem nome)"}</strong> <span style={{ color: "var(--muted)" }}>· {a.email || "—"}</span>
                    <span style={{ color: "var(--muted)" }}>
                      {" "}
                      · {brl(a.amountCents)} em {fmtDate(a.createdAt)}
                    </span>
                  </span>
                  <span style={{ display: "flex", gap: 6 }}>
                    {s && s.category !== "unblocking" && (
                      <Button variant="ghost" style={smallBtn} disabled={remindingId === s.id} onClick={() => remind(s)}>
                        {remindingId === s.id ? "Enviando…" : "Lembrete"}
                      </Button>
                    )}
                    <Button variant="subtle" style={smallBtn} onClick={() => onOpen(a.userId)}>
                      Ver
                    </Button>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>
  );
}
