import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "./supabase-admin";
import { sendEmail, paymentConfirmedEmail } from "./email";

// Integração com o Checkout da InfinitePay (infinitepay.io/checkout-documentacao).
// A API só cria links de pagamento avulsos — não há recorrência via API —,
// então cada pagamento compra um período de acesso (BILLING_PERIOD_DAYS).
const API = "https://api.checkout.infinitepay.io";
export const BILLING_PERIOD_DAYS = 30;

export type PlanId = "monthly" | "quarterly" | "semiannual";
export type Plan = { id: PlanId; label: string; days: number; months: number; priceCents: number; perMonthCents: number; discountPct: number };

// Mensal vem do env (preço de teste); trimestral e semestral têm preço fixo
// por mês (R$ 67 e R$ 59), com desconto calculado sobre o mensal.
export function billingPlans(): Plan[] {
  const monthly = billingPriceCents();
  const mk = (id: PlanId, label: string, months: number, perMonth: number): Plan => ({
    id,
    label,
    months,
    days: months * BILLING_PERIOD_DAYS,
    priceCents: perMonth * months,
    perMonthCents: perMonth,
    discountPct: Math.max(0, Math.round((1 - perMonth / monthly) * 100)),
  });
  return [mk("monthly", "Mensal", 1, monthly), mk("quarterly", "Trimestral", 3, 6700), mk("semiannual", "Semestral", 6, 5900)];
}

export function findPlan(id: unknown): Plan | undefined {
  return billingPlans().find((p) => p.id === id);
}

export function billingPriceCents() {
  const v = parseInt(process.env.BILLING_MONTHLY_PRICE_CENTS || "7700", 10);
  return Number.isFinite(v) && v > 0 ? v : 7700;
}

export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://maisunblocking.com.br").replace(/\/$/, "");
}

function handle() {
  const h = (process.env.INFINITEPAY_HANDLE || "").replace(/^\$/, "");
  if (!h) throw new Error("INFINITEPAY_HANDLE não configurado");
  return h;
}

// O webhook da InfinitePay não é assinado. O token na URL só serve para
// descartar chamadas que não vieram de um link criado por nós; a confirmação
// de verdade é sempre a consulta ao payment_check.
export function webhookToken(paymentId: string) {
  const secret = process.env.BILLING_WEBHOOK_SECRET;
  if (!secret) throw new Error("BILLING_WEBHOOK_SECRET não configurado");
  return createHmac("sha256", secret).update(paymentId).digest("hex").slice(0, 32);
}

export function validWebhookToken(paymentId: string, token: string | null) {
  if (!token || !process.env.BILLING_WEBHOOK_SECRET) return false;
  const a = Buffer.from(webhookToken(paymentId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function createCheckoutLink(opts: {
  paymentId: string;
  priceCents: number;
  description: string;
  customer: { name?: string | null; email?: string | null };
}): Promise<string> {
  const customer: Record<string, string> = {};
  if (opts.customer.name) customer.name = opts.customer.name;
  if (opts.customer.email) customer.email = opts.customer.email;

  const res = await fetch(`${API}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: handle(),
      order_nsu: opts.paymentId,
      items: [{ quantity: 1, price: opts.priceCents, description: opts.description }],
      redirect_url: `${siteUrl()}/assinatura/retorno`,
      webhook_url: `${siteUrl()}/api/billing/webhook?t=${webhookToken(opts.paymentId)}`,
      ...(Object.keys(customer).length ? { customer } : {}),
    }),
  });
  const data: any = await res.json().catch(() => null);
  const url = data?.url || data?.link || data?.checkout_url || data?.payment_url;
  if (!res.ok || typeof url !== "string") {
    console.error("[infinitepay] falha ao criar link:", res.status, JSON.stringify(data)?.slice(0, 400));
    throw new Error("Não foi possível abrir o pagamento agora. Tente de novo em instantes.");
  }
  return url;
}

export async function checkPayment(orderNsu: string, transactionNsu: string, slug: string) {
  const res = await fetch(`${API}/payment_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle: handle(), order_nsu: orderNsu, transaction_nsu: transactionNsu, slug }),
  });
  if (!res.ok) throw new Error(`payment_check HTTP ${res.status}`);
  return (await res.json()) as {
    success?: boolean;
    paid?: boolean;
    amount?: number;
    paid_amount?: number;
    capture_method?: string;
  };
}

export type VerifyResult =
  | { state: "paid"; accessUntil: string | null }
  | { state: "already_paid"; accessUntil: string | null }
  | { state: "not_paid" }
  | { state: "not_found" };

// Caminho único de confirmação, usado pelo webhook e pela página de retorno.
// Só libera acesso depois que a própria InfinitePay confirma (payment_check)
// que o pagamento foi feito no valor esperado. apply_payment é idempotente:
// chamadas repetidas não somam o período duas vezes.
export async function verifyAndApply(input: {
  paymentId: string;
  transactionNsu: string;
  slug: string;
  receiptUrl?: string | null;
  userId?: string;
}): Promise<VerifyResult> {
  const admin = supabaseAdmin();
  const { data: payment } = await admin
    .from("payments")
    .select("id, user_id, amount_cents, status")
    .eq("id", input.paymentId)
    .maybeSingle();
  if (!payment || (input.userId && payment.user_id !== input.userId)) return { state: "not_found" };

  const accessUntil = async () =>
    (await admin.from("profiles").select("access_until").eq("id", payment.user_id).single()).data?.access_until ?? null;

  if (payment.status === "paid") return { state: "already_paid", accessUntil: await accessUntil() };

  const check = await checkPayment(payment.id, input.transactionNsu, input.slug);
  if (!check.paid || (check.amount ?? 0) < payment.amount_cents) return { state: "not_paid" };

  const { data: until, error } = await admin.rpc("apply_payment", {
    p_id: payment.id,
    p_slug: input.slug,
    p_tx: input.transactionNsu,
    p_method: check.capture_method ?? null,
    p_paid_amount: check.paid_amount ?? check.amount ?? null,
    p_receipt: input.receiptUrl ?? null,
  });
  if (error) throw new Error(`apply_payment: ${error.message}`);
  if (!until) return { state: "already_paid", accessUntil: await accessUntil() };

  try {
    const { data: u } = await admin.auth.admin.getUserById(payment.user_id);
    const { data: prof } = await admin.from("profiles").select("name").eq("id", payment.user_id).single();
    if (u.user?.email) {
      await sendEmail({ to: u.user.email, ...paymentConfirmedEmail(prof?.name, until as string, input.receiptUrl) });
    }
  } catch (e: any) {
    console.error("[infinitepay] pagamento confirmado, mas o e-mail falhou:", e?.message);
  }
  return { state: "paid", accessUntil: until as string };
}
