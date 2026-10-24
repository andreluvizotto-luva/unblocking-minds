import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  INVOICE_COLUMNS,
  ensureInvoices,
  formatCpf,
  invoiceView,
  isValidCpf,
  loadPlan,
  monthKey,
  newGuardianToken,
  spToday,
  type TuitionInvoice,
} from "@/lib/tuition";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function payload(userId: string) {
  const admin = supabaseAdmin();
  const plan = await loadPlan(admin, userId);
  if (plan) await ensureInvoices(admin, plan);
  const { data } = await admin
    .from("tuition_invoices")
    .select(INVOICE_COLUMNS)
    .eq("user_id", userId)
    .order("month", { ascending: false })
    .limit(24);
  const invoices = plan ? ((data || []) as TuitionInvoice[]).map((i) => invoiceView(plan, i)) : [];
  return { plan, invoices };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Desde o Next 15 os params da rota chegam como Promise.
  const params = await ctx.params;
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!UUID.test(params.id)) return NextResponse.json({ error: "Aluno inválido" }, { status: 400 });
  return NextResponse.json(await payload(params.id));
}

// Salva a configuração de mensalidade do aluno.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Desde o Next 15 os params da rota chegam como Promise.
  const params = await ctx.params;
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!UUID.test(params.id)) return NextResponse.json({ error: "Aluno inválido" }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const kind = b.kind === "student_leadership" ? "student_leadership" : b.kind === "private_class" ? "private_class" : null;
  if (!kind) return NextResponse.json({ error: "Escolha o tipo de aluno." }, { status: 400 });
  const amount = Math.round(Number(b.amountCents));
  if (!Number.isFinite(amount) || amount < 100 || amount > 10_000_000) {
    return NextResponse.json({ error: "Informe um valor mensal válido." }, { status: 400 });
  }
  const due = kind === "private_class" ? 10 : Number(b.dueDay) === 21 ? 21 : 10;
  const method = b.method === "auto" ? "auto" : "link";
  const autoLink = typeof b.autoLink === "string" && b.autoLink.trim() ? b.autoLink.trim() : null;
  if (autoLink && !/^https:\/\/\S+$/.test(autoLink)) {
    return NextResponse.json({ error: "O link de adesão precisa começar com https://" }, { status: 400 });
  }

  let guardian: Record<string, string | null> = { guardian_name: null, guardian_email: null, guardian_phone: null, guardian_cpf: null };
  if (b.hasGuardian) {
    const name = String(b.guardianName || "").trim();
    const email = String(b.guardianEmail || "").trim().toLowerCase();
    const phone = String(b.guardianPhone || "").replace(/\D/g, "");
    const cpf = String(b.guardianCpf || "");
    if (!name) return NextResponse.json({ error: "Informe o nome do responsável financeiro." }, { status: 400 });
    if (!EMAIL.test(email)) return NextResponse.json({ error: "Informe um e-mail válido do responsável financeiro." }, { status: 400 });
    if (phone.length < 10 || phone.length > 13) return NextResponse.json({ error: "Informe o telefone do responsável com DDD." }, { status: 400 });
    if (!isValidCpf(cpf)) return NextResponse.json({ error: "CPF do responsável inválido. Confira os números." }, { status: 400 });
    guardian = { guardian_name: name, guardian_email: email, guardian_phone: phone, guardian_cpf: formatCpf(cpf) };
  }

  const admin = supabaseAdmin();
  const current = await loadPlan(admin, params.id);
  const { error } = await admin.from("tuition_plans").upsert(
    {
      user_id: params.id,
      active: b.active !== false,
      kind,
      amount_cents: amount,
      due_day: due,
      method,
      auto_link: autoLink,
      ...guardian,
      guardian_token: guardian.guardian_email ? current?.guardian_token || newGuardianToken() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mudança de valor vale para as cobranças em aberto do mês corrente em diante.
  const t = spToday();
  await admin
    .from("tuition_invoices")
    .update({ amount_cents: amount })
    .eq("user_id", params.id)
    .eq("status", "open")
    .gte("month", monthKey(t.y, t.m));

  return NextResponse.json(await payload(params.id));
}

// Ações numa cobrança: marcar paga por fora, confirmar débito automático,
// isentar ou reabrir.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Desde o Next 15 os params da rota chegam como Promise.
  const params = await ctx.params;
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!UUID.test(params.id)) return NextResponse.json({ error: "Aluno inválido" }, { status: 400 });

  const b = await req.json().catch(() => ({}));
  const admin = supabaseAdmin();

  // Liga/desliga a cobrança direto da lista de alunos. Só vale para quem já
  // tem a mensalidade configurada (sem dados preenchidos, não há cobrança).
  if (typeof b.active === "boolean" && !b.invoiceId) {
    const current = await loadPlan(admin, params.id);
    if (!current) return NextResponse.json({ error: "Configure a mensalidade do aluno antes de ativar a cobrança." }, { status: 400 });
    const { error } = await admin.from("tuition_plans").update({ active: b.active, updated_at: new Date().toISOString() }).eq("user_id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(await payload(params.id));
  }

  if (typeof b.invoiceId !== "string" || !UUID.test(b.invoiceId)) return NextResponse.json({ error: "Cobrança inválida" }, { status: 400 });
  const plan = await loadPlan(admin, params.id);
  const { data: inv } = await admin.from("tuition_invoices").select(INVOICE_COLUMNS).eq("id", b.invoiceId).eq("user_id", params.id).maybeSingle();
  if (!plan || !inv) return NextResponse.json({ error: "Cobrança não encontrada" }, { status: 404 });

  let update: Record<string, any>;
  if (b.action === "mark_paid" || b.action === "confirm_auto") {
    if (inv.status !== "open") return NextResponse.json({ error: "Esta cobrança não está em aberto." }, { status: 400 });
    const v = invoiceView(plan, inv as TuitionInvoice);
    const amount = typeof b.amountCents === "number" && b.amountCents > 0 ? Math.round(b.amountCents) : v.priceNowCents;
    update = { status: "paid", paid_at: new Date().toISOString(), paid_amount: amount, paid_how: b.action === "confirm_auto" ? "auto" : "manual" };
  } else if (b.action === "exempt") {
    if (inv.status !== "open") return NextResponse.json({ error: "Esta cobrança não está em aberto." }, { status: 400 });
    update = { status: "exempt" };
  } else if (b.action === "reopen") {
    if (inv.status === "open" || inv.paid_how === "link") {
      return NextResponse.json({ error: "Pagamentos feitos pelo link não podem ser reabertos aqui." }, { status: 400 });
    }
    update = { status: "open", paid_at: null, paid_amount: null, paid_how: null };
  } else {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  const { error } = await admin.from("tuition_invoices").update(update).eq("id", inv.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(await payload(params.id));
}
