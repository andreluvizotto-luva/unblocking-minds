import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { INVOICE_COLUMNS, PLAN_COLUMNS, ensureInvoices, invoiceView, monthKey, monthLabel, spToday, type TuitionInvoice, type TuitionPlan } from "@/lib/tuition";

// Visão do mês das mensalidades da escola: quem pagou, quem falta e o total.
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const t = spToday();
  const param = new URL(req.url).searchParams.get("month");
  const month = param && /^\d{4}-\d{2}$/.test(param) ? `${param}-01` : monthKey(t.y, t.m);

  const admin = supabaseAdmin();
  const { data: plansData } = await admin.from("tuition_plans").select(PLAN_COLUMNS);
  const plans = (plansData || []) as TuitionPlan[];
  await Promise.all(plans.filter((p) => p.active).map((p) => ensureInvoices(admin, p, t)));

  const { data: invData } = await admin.from("tuition_invoices").select(INVOICE_COLUMNS).eq("month", month);
  const invoices = (invData || []) as TuitionInvoice[];
  const ids = [...new Set(invoices.map((i) => i.user_id))];
  const { data: profs } = ids.length ? await admin.from("profiles").select("id, name").in("id", ids) : { data: [] as any[] };
  const name = new Map((profs || []).map((p: any) => [p.id, p.name]));
  const planBy = new Map(plans.map((p) => [p.user_id, p]));

  const rows = invoices
    .filter((i) => planBy.has(i.user_id))
    .map((i) => {
      const p = planBy.get(i.user_id)!;
      const v = invoiceView(p, i, t);
      return {
        ...v,
        userId: i.user_id,
        name: name.get(i.user_id) ?? null,
        kind: p.kind,
        method: p.method,
        guardianName: p.guardian_name,
        phone: p.guardian_phone,
      };
    })
    .sort((a, b) => (a.status === b.status ? (a.name || "").localeCompare(b.name || "") : a.status === "open" ? -1 : 1));

  const paid = rows.filter((r) => r.status === "paid");
  return NextResponse.json({
    month,
    monthLabel: monthLabel(month),
    receivedCents: paid.reduce((a, r) => a + (r.paidAmount ?? 0), 0),
    paidCount: paid.length,
    billableCount: rows.filter((r) => r.status !== "exempt").length,
    withDiscount: paid.filter((r) => r.paidAmount != null && r.paidAmount < r.fullCents).length,
    rows,
  });
}
