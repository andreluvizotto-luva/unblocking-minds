import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { billingPriceCents } from "@/lib/infinitepay";
import { INVOICE_COLUMNS, PLAN_COLUMNS, ensureInvoices, invoiceView, monthKey, monthLabel, spToday, type TuitionInvoice, type TuitionPlan } from "@/lib/tuition";

// Aba Financeiro do admin. Junta duas fontes de receita:
//  * Mensalidades da escola: "esperado" é o valor cheio das mensalidades do
//    mês (sem as isentas); "realizado" é o que entrou, com desconto, multa e juros.
//  * Assinantes do app (+Unblocking): "esperado" é o que foi pago no mês mais
//    o plano mensal de quem tinha renovação vencendo no mês e não renovou;
//    "realizado" é o que foi pago no mês.

type Tone = "green" | "amber" | "red" | "gray";
type Row = {
  id: string;
  userId: string;
  name: string | null;
  source: "tuition" | "app";
  typeLabel: string;
  expectedCents: number;
  receivedCents: number;
  statusLabel: string;
  tone: Tone;
  late: boolean;
  open: boolean;
  exempt: boolean;
  discountCents: number;
  extraCents: number;
  contact: { label: string; phone: string | null } | null;
};

const ddmm = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
const planLabel = (days: number) => (days >= 180 ? "Semestral" : days >= 90 ? "Trimestral" : "Mensal");

// Limites do mês em horário de Brasília (UTC-3).
function monthBounds(key: string) {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  return { start: Date.UTC(y, m - 1, 1, 3), end: Date.UTC(y, m, 1, 3) };
}

export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const t = spToday();
  const q = new URL(req.url).searchParams;
  const mParam = q.get("month");
  const month = mParam && /^\d{4}-\d{2}$/.test(mParam) ? `${mParam}-01` : monthKey(t.y, t.m);
  const kindParam = q.get("kind");
  const kind = kindParam === "private_class" || kindParam === "student_leadership" || kindParam === "app" ? kindParam : null;
  const withTuition = kind !== "app";
  const withApp = kind === null || kind === "app";
  const tuitionKind = kind === "private_class" || kind === "student_leadership" ? kind : null;

  const admin = supabaseAdmin();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 - i, 1));
    months.push(monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1));
  }
  const history = months.map((m) => ({ month: m, monthLabel: monthLabel(m), expectedCents: 0, receivedCents: 0 }));
  const histBy = new Map(history.map((h) => [h.month, h]));
  const rows: Row[] = [];

  // --- Mensalidades da escola ---
  if (withTuition) {
    const { data: plansData } = await admin.from("tuition_plans").select(PLAN_COLUMNS);
    const plans = (plansData || []) as TuitionPlan[];
    await Promise.all(plans.filter((p) => p.active).map((p) => ensureInvoices(admin, p, t)));
    const planBy = new Map(plans.map((p) => [p.user_id, p]));

    const { data: invData } = await admin.from("tuition_invoices").select(INVOICE_COLUMNS).in("month", months);
    const invoices = ((invData || []) as TuitionInvoice[]).filter((i) => {
      const p = planBy.get(i.user_id);
      return p && (!tuitionKind || p.kind === tuitionKind);
    });
    for (const i of invoices) {
      const h = histBy.get(i.month)!;
      if (i.status !== "exempt") h.expectedCents += i.amount_cents;
      if (i.status === "paid") h.receivedCents += i.paid_amount ?? 0;
    }

    for (const i of invoices.filter((x) => x.month === month)) {
      const p = planBy.get(i.user_id)!;
      const v = invoiceView(p, i, t);
      const paid = v.paidAmount ?? v.fullCents;
      let statusLabel: string;
      let tone: Tone;
      if (v.status === "paid") {
        statusLabel = `Pago ${v.paidAt ? ddmm(v.paidAt) : ""} · ${v.paidHow === "auto" ? "débito" : v.paidHow === "manual" ? "por fora" : "link"}`;
        tone = "green";
      } else if (v.status === "exempt") {
        statusLabel = "Isento";
        tone = "gray";
      } else if (v.late) {
        statusLabel = "Em atraso";
        tone = "red";
      } else {
        statusLabel = v.graceToday ? "Último dia sem multa" : "Em aberto";
        tone = "amber";
      }
      rows.push({
        id: `t-${i.id}`,
        userId: i.user_id,
        name: null,
        source: "tuition",
        typeLabel: `${p.kind === "private_class" ? "Private Class" : "Student Leadership"}${p.method === "auto" ? " · débito automático" : ""}`,
        expectedCents: v.status === "exempt" ? 0 : v.fullCents,
        receivedCents: v.status === "paid" ? paid : 0,
        statusLabel,
        tone,
        late: v.status === "open" && v.late,
        open: v.status === "open",
        exempt: v.status === "exempt",
        discountCents: v.status === "paid" ? Math.max(0, v.fullCents - paid) : 0,
        extraCents: v.status === "paid" ? Math.max(0, paid - v.fullCents) : 0,
        contact: p.guardian_name || p.guardian_phone ? { label: p.guardian_name ? p.guardian_name.split(" ")[0] : "Responsável", phone: p.guardian_phone } : null,
      });
    }
  }

  // --- Assinantes do app (+Unblocking) ---
  if (withApp) {
    const first = monthBounds(months[0]).start;
    const { data: pays } = await admin
      .from("payments")
      .select("user_id, amount_cents, paid_amount, period_days, paid_at")
      .eq("status", "paid")
      .is("invoice_id", null)
      .gte("paid_at", new Date(first).toISOString())
      .lt("paid_at", new Date(monthBounds(month).end).toISOString());
    const payments = pays || [];
    for (const p of payments) {
      const ts = new Date(p.paid_at).getTime();
      const h = history.find((x) => {
        const b = monthBounds(x.month);
        return ts >= b.start && ts < b.end;
      });
      if (h) {
        h.expectedCents += p.paid_amount ?? p.amount_cents;
        h.receivedCents += p.paid_amount ?? p.amount_cents;
      }
    }

    const { start, end } = monthBounds(month);
    const inMonth = payments.filter((p) => {
      const ts = new Date(p.paid_at).getTime();
      return ts >= start && ts < end;
    });
    const paidBy = new Map<string, { cents: number; lastAt: string; days: number }>();
    for (const p of inMonth) {
      const cur = paidBy.get(p.user_id);
      const cents = (cur?.cents ?? 0) + (p.paid_amount ?? p.amount_cents);
      const last = !cur || p.paid_at > cur.lastAt ? { lastAt: p.paid_at, days: p.period_days } : { lastAt: cur.lastAt, days: cur.days };
      paidBy.set(p.user_id, { cents, ...last });
    }

    // Renovação vencendo no mês sem pagamento no mês: entra como esperado.
    const { data: dueProfiles } = await admin
      .from("profiles")
      .select("id, access_until")
      .eq("category", "app")
      .eq("is_admin", false)
      .gte("access_until", new Date(start).toISOString())
      .lt("access_until", new Date(end).toISOString());
    const monthly = billingPriceCents();
    const dueUnpaid = (dueProfiles || []).filter((p) => !paidBy.has(p.id));
    const h = histBy.get(month)!;
    h.expectedCents += dueUnpaid.length * monthly;

    for (const [userId, p] of paidBy) {
      rows.push({
        id: `a-${userId}`,
        userId,
        name: null,
        source: "app",
        typeLabel: `App +Unblocking · ${planLabel(p.days)}`,
        expectedCents: p.cents,
        receivedCents: p.cents,
        statusLabel: `Pago ${ddmm(p.lastAt)}`,
        tone: "green",
        late: false,
        open: false,
        exempt: false,
        discountCents: 0,
        extraCents: 0,
        contact: null,
      });
    }
    for (const p of dueUnpaid) {
      const expired = new Date(p.access_until).getTime() <= Date.now();
      rows.push({
        id: `a-${p.id}`,
        userId: p.id,
        name: null,
        source: "app",
        typeLabel: "App +Unblocking · renovação",
        expectedCents: monthly,
        receivedCents: 0,
        statusLabel: expired ? `Vencido ${ddmm(p.access_until)}` : `Renova até ${ddmm(p.access_until)}`,
        tone: expired ? "red" : "amber",
        late: expired,
        open: true,
        exempt: false,
        discountCents: 0,
        extraCents: 0,
        contact: null,
      });
    }
  }

  const ids = [...new Set(rows.map((r) => r.userId))];
  const { data: profs } = ids.length ? await admin.from("profiles").select("id, name").in("id", ids) : { data: [] as any[] };
  const name = new Map((profs || []).map((p: any) => [p.id, p.name]));
  for (const r of rows) r.name = name.get(r.userId) ?? null;
  const rank = (r: Row) => (r.late ? 0 : r.open ? 1 : r.exempt ? 3 : 2);
  rows.sort((a, b) => rank(a) - rank(b) || (a.name || "").localeCompare(b.name || ""));

  const billable = rows.filter((r) => !r.exempt);
  const paid = rows.filter((r) => r.receivedCents > 0);
  const open = rows.filter((r) => r.open);
  const totals = {
    expectedCents: billable.reduce((a, r) => a + r.expectedCents, 0),
    receivedCents: rows.reduce((a, r) => a + r.receivedCents, 0),
    pendingCents: open.reduce((a, r) => a + r.expectedCents, 0),
    lateCents: open.filter((r) => r.late).reduce((a, r) => a + r.expectedCents, 0),
    discountCents: rows.reduce((a, r) => a + r.discountCents, 0),
    extraCents: rows.reduce((a, r) => a + r.extraCents, 0),
    billable: billable.length,
    paidCount: paid.length,
    openCount: open.length,
    lateCount: open.filter((r) => r.late).length,
    exemptCount: rows.length - billable.length,
    withDiscount: rows.filter((r) => r.discountCents > 0).length,
    tuitionReceivedCents: rows.filter((r) => r.source === "tuition").reduce((a, r) => a + r.receivedCents, 0),
    appReceivedCents: rows.filter((r) => r.source === "app").reduce((a, r) => a + r.receivedCents, 0),
  };

  return NextResponse.json({ month, monthLabel: monthLabel(month), kind, totals, history, rows });
}
