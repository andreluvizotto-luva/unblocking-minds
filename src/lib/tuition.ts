import { randomBytes } from "crypto";
import { supabaseAdmin } from "./supabase-admin";
import { createCheckoutLink } from "./infinitepay";

// Mensalidade da escola Unblocking Minds. É separada da assinatura do app:
// pagar (ou atrasar) a mensalidade não muda o acesso ao +Unblocking.
//
// Regras:
//  * Private Class: vencimento oficial dia 10, 7% de desconto pagando até o dia 7.
//  * Student Leadership: valor único, vencimento dia 10 ou 21.
//  * A cobrança do mês abre no dia 25 do mês anterior.
//  * O valor é decidido no servidor, pela data de Brasília, no momento em que o
//    link é gerado; o link mantém esse valor mesmo se pago depois.

export const DISCOUNT_PCT = 7;
export const DISCOUNT_DAY = 7;
export const OPEN_DAY = 25;

export type TuitionKind = "private_class" | "student_leadership";
export type TuitionPlan = {
  user_id: string;
  active: boolean;
  kind: TuitionKind;
  amount_cents: number;
  due_day: number;
  method: "link" | "auto";
  auto_link: string | null;
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_phone: string | null;
  guardian_cpf: string | null;
  guardian_token: string | null;
};
export type TuitionInvoice = {
  id: string;
  user_id: string;
  month: string;
  amount_cents: number;
  status: "open" | "paid" | "exempt";
  paid_at: string | null;
  paid_amount: number | null;
  paid_how: "link" | "auto" | "manual" | null;
  receipt_url: string | null;
};

export const PLAN_COLUMNS =
  "user_id, active, kind, amount_cents, due_day, method, auto_link, guardian_name, guardian_email, guardian_phone, guardian_cpf, guardian_token";
export const INVOICE_COLUMNS = "id, user_id, month, amount_cents, status, paid_at, paid_amount, paid_how, receipt_url";

export type Ymd = { y: number; m: number; d: number };

export function spToday(now = new Date()): Ymd {
  const [y, m, d] = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).split("-").map(Number);
  return { y, m, d };
}

export const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-01`;
const parseMonth = (key: string) => ({ y: Number(key.slice(0, 4)), m: Number(key.slice(5, 7)) });
const nextMonth = (y: number, m: number) => (m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 });
const cmpMonth = (a: { y: number; m: number }, b: { y: number; m: number }) => a.y * 12 + a.m - (b.y * 12 + b.m);

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const monthName = (key: string) => MONTHS[parseMonth(key).m - 1];
export const monthLabel = (key: string) => `${monthName(key)}/${parseMonth(key).y}`;
const ddmm = (d: number, key: string) => `${String(d).padStart(2, "0")}/${key.slice(5, 7)}`;

export const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function dueDay(plan: Pick<TuitionPlan, "kind" | "due_day">) {
  return plan.kind === "private_class" ? 10 : plan.due_day;
}

export const discounted = (cents: number) => Math.round((cents * (100 - DISCOUNT_PCT)) / 100);

// Situação de uma cobrança em aberto hoje.
export function invoiceView(plan: TuitionPlan, inv: TuitionInvoice, today = spToday()) {
  const mon = parseMonth(inv.month);
  const rel = cmpMonth(mon, today); // >0: cobrança de um mês futuro (aberta desde o dia 25)
  const due = dueDay(plan);
  const discountActive = plan.kind === "private_class" && (rel > 0 || (rel === 0 && today.d <= DISCOUNT_DAY));
  const late = rel < 0 || (rel === 0 && today.d > due);
  return {
    id: inv.id,
    month: inv.month,
    monthLabel: monthLabel(inv.month),
    status: inv.status,
    fullCents: inv.amount_cents,
    priceNowCents: discountActive ? discounted(inv.amount_cents) : inv.amount_cents,
    discountCents: plan.kind === "private_class" ? discounted(inv.amount_cents) : null,
    discountActive,
    discountUntil: plan.kind === "private_class" ? ddmm(DISCOUNT_DAY, inv.month) : null,
    dueDate: ddmm(due, inv.month),
    late,
    daysToDiscountEnd: discountActive && rel === 0 ? DISCOUNT_DAY - today.d : null,
    paidAt: inv.paid_at,
    paidAmount: inv.paid_amount,
    paidHow: inv.paid_how,
    receiptUrl: inv.receipt_url && /^https:\/\//.test(inv.receipt_url) ? inv.receipt_url : null,
  };
}
export type InvoiceView = ReturnType<typeof invoiceView>;

// Garante a cobrança do mês corrente e, a partir do dia 25, a do próximo.
export async function ensureInvoices(admin: ReturnType<typeof supabaseAdmin>, plan: TuitionPlan, today = spToday()) {
  if (!plan.active) return;
  const months = [monthKey(today.y, today.m)];
  if (today.d >= OPEN_DAY) {
    const n = nextMonth(today.y, today.m);
    months.push(monthKey(n.y, n.m));
  }
  const rows = months.map((month) => ({ user_id: plan.user_id, month, amount_cents: plan.amount_cents }));
  const { error } = await admin.from("tuition_invoices").upsert(rows, { onConflict: "user_id,month", ignoreDuplicates: true });
  if (error) console.error("[tuition] falha ao criar cobranças:", error.message);
}

// Meses pagos no prazo em sequência, do mais recente para trás, e quanto o
// aluno economizou com desconto no ano corrente.
export function paymentHabit(plan: TuitionPlan, invoices: TuitionInvoice[], today = spToday()) {
  const paid = invoices.filter((i) => i.status !== "open").sort((a, b) => b.month.localeCompare(a.month));
  let streak = 0;
  for (const inv of paid) {
    if (inv.status === "exempt") continue;
    const { y, m } = parseMonth(inv.month);
    const dueIso = `${y}-${String(m).padStart(2, "0")}-${String(dueDay(plan)).padStart(2, "0")}T23:59:59-03:00`;
    if (inv.paid_at && new Date(inv.paid_at) <= new Date(dueIso)) streak++;
    else break;
  }
  const saved = paid
    .filter((i) => i.status === "paid" && parseMonth(i.month).y === today.y && i.paid_amount != null && i.paid_amount < i.amount_cents)
    .reduce((a, i) => a + (i.amount_cents - (i.paid_amount as number)), 0);
  return { streak, savedThisYearCents: saved };
}

export function hasGuardian(plan: Pick<TuitionPlan, "guardian_email">) {
  return !!plan.guardian_email;
}

export function newGuardianToken() {
  return randomBytes(24).toString("hex");
}

export function isValidCpf(raw: string) {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function formatCpf(raw: string) {
  const c = raw.replace(/\D/g, "");
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9, 11)}`;
}

// A InfinitePay espera o telefone com DDI.
function phoneE164(raw: string | null | undefined) {
  const d = (raw || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return `+${d}`;
  return null;
}

// Abre o link de pagamento da cobrança no valor de hoje.
export async function openTuitionCheckout(
  admin: ReturnType<typeof supabaseAdmin>,
  plan: TuitionPlan,
  inv: TuitionInvoice,
  payer: { name?: string | null; email?: string | null; phone?: string | null },
  studentName: string | null
) {
  const view = invoiceView(plan, inv);
  const { data: payment, error } = await admin
    .from("payments")
    .insert({ user_id: inv.user_id, amount_cents: view.priceNowCents, period_days: 0, invoice_id: inv.id })
    .select("id")
    .single();
  if (error || !payment) {
    console.error("[tuition] falha ao criar pagamento:", error?.message);
    throw new Error("Não foi possível abrir o pagamento agora. Tente de novo.");
  }
  try {
    const url = await createCheckoutLink({
      paymentId: payment.id,
      priceCents: view.priceNowCents,
      description: `Unblocking Minds · Mensalidade ${view.monthLabel}${studentName ? ` · ${studentName}` : ""}`,
      customer: { name: payer.name, email: payer.email, phone: phoneE164(payer.phone) },
      redirectPath: "/mensalidade/retorno",
    });
    await admin.from("payments").update({ checkout_url: url }).eq("id", payment.id);
    return url;
  } catch (e) {
    await admin.from("payments").delete().eq("id", payment.id).eq("status", "pending");
    throw e;
  }
}

// E-mail de quem paga: o responsável financeiro, se houver; senão o aluno.
export async function payerContact(admin: ReturnType<typeof supabaseAdmin>, plan: TuitionPlan) {
  const { data: prof } = await admin.from("profiles").select("name").eq("id", plan.user_id).single();
  const studentName: string | null = prof?.name ?? null;
  if (hasGuardian(plan)) {
    return { email: plan.guardian_email, name: plan.guardian_name, phone: plan.guardian_phone, studentName, guardian: true };
  }
  const { data: u } = await admin.auth.admin.getUserById(plan.user_id);
  return { email: u.user?.email ?? null, name: studentName, phone: null, studentName, guardian: false };
}

// Qual lembrete cabe hoje para uma cobrança em aberto (um por janela; o
// controle de envio único fica em billing_emails).
export function reminderKindFor(plan: TuitionPlan, inv: TuitionInvoice, today = spToday()): TuitionEmailKind | null {
  const rel = cmpMonth(parseMonth(inv.month), today);
  if (rel > 0) return today.d >= OPEN_DAY ? "t_open" : null;
  if (rel < 0) return "t_late";
  const d = today.d;
  const due = dueDay(plan);
  if (plan.kind === "private_class") {
    if (d <= 4) return "t_d1";
    if (d <= 6) return "t_d5";
    if (d === 7) return "t_d7";
    if (d <= 9) return "t_d8";
    if (d === 10) return "t_due";
    return d >= 15 ? "t_late" : null;
  }
  if (d <= due - 3) return "t_d1";
  if (d < due) return "t_pre";
  if (d === due) return "t_due";
  return d >= due + 5 ? "t_late" : null;
}

// O que o aluno (ou o responsável) vê: cobranças em aberto no valor de hoje,
// histórico e hábito de pagamento. Cria as cobranças do período se faltarem.
export async function tuitionState(admin: ReturnType<typeof supabaseAdmin>, plan: TuitionPlan) {
  const today = spToday();
  await ensureInvoices(admin, plan, today);
  const { data } = await admin
    .from("tuition_invoices")
    .select(INVOICE_COLUMNS)
    .eq("user_id", plan.user_id)
    .order("month", { ascending: false })
    .limit(24);
  const invoices = (data || []) as TuitionInvoice[];
  const open = invoices
    .filter((i) => i.status === "open")
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((i) => invoiceView(plan, i, today));
  const history = invoices
    .filter((i) => i.status !== "open")
    .slice(0, 12)
    .map((i) => invoiceView(plan, i, today));
  const habit = paymentHabit(plan, invoices, today);
  return {
    kind: plan.kind,
    method: plan.method,
    autoLink: plan.method === "link" && plan.auto_link && /^https:\/\//.test(plan.auto_link) ? plan.auto_link : null,
    dueDay: dueDay(plan),
    amountCents: plan.amount_cents,
    open,
    history,
    ...habit,
  };
}
export type TuitionState = Awaited<ReturnType<typeof tuitionState>>;

export async function loadPlan(admin: ReturnType<typeof supabaseAdmin>, userId: string) {
  const { data } = await admin.from("tuition_plans").select(PLAN_COLUMNS).eq("user_id", userId).maybeSingle();
  return (data as TuitionPlan | null) ?? null;
}

export type TuitionEmailKind = "t_open" | "t_d1" | "t_d5" | "t_d7" | "t_d8" | "t_pre" | "t_due" | "t_late";
