import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { INVOICE_COLUMNS, PLAN_COLUMNS, ensureInvoices, invoiceView, monthKey, monthLabel, spToday, type TuitionInvoice, type TuitionPlan } from "@/lib/tuition";

// Aba Financeiro do admin. "Esperado" é a soma do valor cheio das
// mensalidades do mês (sem as isentas); "realizado" é o que entrou de fato,
// já com descontos, multa e juros.
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const t = spToday();
  const q = new URL(req.url).searchParams;
  const mParam = q.get("month");
  const month = mParam && /^\d{4}-\d{2}$/.test(mParam) ? `${mParam}-01` : monthKey(t.y, t.m);
  const kind = q.get("kind") === "private_class" || q.get("kind") === "student_leadership" ? q.get("kind") : null;

  const admin = supabaseAdmin();
  const { data: plansData } = await admin.from("tuition_plans").select(PLAN_COLUMNS);
  const plans = (plansData || []) as TuitionPlan[];
  await Promise.all(plans.filter((p) => p.active).map((p) => ensureInvoices(admin, p, t)));
  const planBy = new Map(plans.map((p) => [p.user_id, p]));

  // Seis meses até o mês escolhido, para o histórico.
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 - i, 1));
    months.push(monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1));
  }
  const { data: invData } = await admin.from("tuition_invoices").select(INVOICE_COLUMNS).in("month", months);
  const all = ((invData || []) as TuitionInvoice[]).filter((i) => {
    const p = planBy.get(i.user_id);
    return p && (!kind || p.kind === kind);
  });

  const sum = (list: TuitionInvoice[]) => {
    const billable = list.filter((i) => i.status !== "exempt");
    const paid = list.filter((i) => i.status === "paid");
    return {
      expectedCents: billable.reduce((a, i) => a + i.amount_cents, 0),
      receivedCents: paid.reduce((a, i) => a + (i.paid_amount ?? 0), 0),
    };
  };

  const history = months.map((m) => ({ month: m, monthLabel: monthLabel(m), ...sum(all.filter((i) => i.month === m)) }));

  const current = all.filter((i) => i.month === month);
  const ids = [...new Set(current.map((i) => i.user_id))];
  const { data: profs } = ids.length ? await admin.from("profiles").select("id, name").in("id", ids) : { data: [] as any[] };
  const name = new Map((profs || []).map((p: any) => [p.id, p.name]));

  const rows = current
    .map((i) => {
      const p = planBy.get(i.user_id)!;
      const v = invoiceView(p, i, t);
      return { ...v, userId: i.user_id, name: name.get(i.user_id) ?? null, kind: p.kind, method: p.method, guardianName: p.guardian_name, phone: p.guardian_phone };
    })
    .sort((a, b) => {
      const rank = (r: typeof a) => (r.status === "open" ? (r.late ? 0 : 1) : r.status === "paid" ? 2 : 3);
      return rank(a) - rank(b) || (a.name || "").localeCompare(b.name || "");
    });

  const paid = rows.filter((r) => r.status === "paid");
  const open = rows.filter((r) => r.status === "open");
  const totals = {
    ...sum(current),
    pendingCents: open.reduce((a, r) => a + r.fullCents, 0),
    lateCents: open.filter((r) => r.late).reduce((a, r) => a + r.fullCents, 0),
    discountCents: paid.reduce((a, r) => a + Math.max(0, r.fullCents - (r.paidAmount ?? r.fullCents)), 0),
    extraCents: paid.reduce((a, r) => a + Math.max(0, (r.paidAmount ?? r.fullCents) - r.fullCents), 0),
    billable: rows.filter((r) => r.status !== "exempt").length,
    paidCount: paid.length,
    openCount: open.length,
    lateCount: open.filter((r) => r.late).length,
    exemptCount: rows.filter((r) => r.status === "exempt").length,
    withDiscount: paid.filter((r) => (r.paidAmount ?? r.fullCents) < r.fullCents).length,
  };

  // Assinatura do app (+Unblocking) no mesmo mês, fora do filtro de tipo.
  const [y, mm] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))];
  const start = new Date(Date.UTC(y, mm - 1, 1, 3)).toISOString();
  const end = new Date(Date.UTC(y, mm, 1, 3)).toISOString();
  const { data: appPays } = await admin
    .from("payments")
    .select("amount_cents, paid_amount")
    .eq("status", "paid")
    .is("invoice_id", null)
    .gte("paid_at", start)
    .lt("paid_at", end);
  const app = {
    receivedCents: (appPays || []).reduce((a: number, p: any) => a + (p.paid_amount ?? p.amount_cents), 0),
    payments: (appPays || []).length,
  };

  return NextResponse.json({ month, monthLabel: monthLabel(month), kind, totals, history, rows, app });
}
