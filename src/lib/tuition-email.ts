import { supabaseAdmin } from "./supabase-admin";
import { sendEmail } from "./email";
import {
  INVOICE_COLUMNS,
  PLAN_COLUMNS,
  brl,
  invoiceView,
  monthLabel,
  monthName,
  payerContact,
  type InvoiceView,
  type TuitionEmailKind,
  type TuitionInvoice,
  type TuitionPlan,
} from "./tuition";

// E-mails da mensalidade da Unblocking Minds. Vão para o responsável
// financeiro, quando houver, e nesse caso o botão leva à página de pagamento
// sem login; senão vão para o aluno, que paga pelo perfil no app.

function site() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://maisunblocking.com.br").replace(/\/$/, "");
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const first = (name: string | null | undefined) => (name ? name.trim().split(/\s+/)[0] : "");

export function payHref(plan: TuitionPlan) {
  return plan.guardian_email && plan.guardian_token ? `${site()}/mensalidade/${plan.guardian_token}` : `${site()}/perfil#mensalidade`;
}

function layout(title: string, body: string, cta: { label: string; href: string } | null, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4efe3;font-family:Arial,Helvetica,sans-serif;color:#10143a">
<div style="max-width:520px;margin:0 auto;padding:28px 18px">
  <div style="font-size:20px;font-weight:700;margin-bottom:18px">Unblocking Minds</div>
  <div style="background:#ffffff;border-radius:16px;padding:24px">
    <h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
    ${body}
    ${
      cta
        ? `<a href="${cta.href}" style="display:inline-block;background:#f6a017;color:#10143a;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${esc(cta.label)}</a>`
        : ""
    }
  </div>
  <p style="font-size:12px;color:#6b6b6b;margin-top:16px">${footer}</p>
</div></body></html>`;
}

const P = "font-size:15px;line-height:1.55;margin:0 0 16px";
const BOX = "background:#f4efe3;border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.55;margin:0 0 16px";

type Ctx = { payerName: string | null; studentName: string | null; guardian: boolean; href: string };

function footer(ctx: Ctx) {
  return ctx.guardian
    ? `Você recebeu este e-mail por ser responsável financeiro de ${esc(first(ctx.studentName) || "um aluno")} na Unblocking Minds.`
    : "Você recebeu este e-mail por ser aluno da Unblocking Minds.";
}

export function tuitionReminderEmail(kind: TuitionEmailKind, v: InvoiceView, ctx: Ctx) {
  const hi = first(ctx.payerName) ? `Oi, ${esc(first(ctx.payerName))}! ` : "";
  const quem = ctx.guardian && ctx.studentName ? ` de ${esc(first(ctx.studentName))}` : "";
  const sufixo = ctx.guardian && ctx.studentName ? ` · ${first(ctx.studentName)}` : "";
  const mes = monthName(v.month);
  const pc = v.discountCents != null;
  const desconto = pc ? `Pagando até <b>${v.discountUntil}</b>, a mensalidade sai por <b>${brl(v.discountCents!)}</b> em vez de ${brl(v.fullCents)} (7% de desconto). O vencimento é ${v.dueDate}.` : "";

  let subject: string;
  let title: string;
  let body: string;
  switch (kind) {
    case "t_open":
    case "t_d1":
      subject = pc ? `Mensalidade de ${mes} disponível · 7% de desconto até ${v.discountUntil}${sufixo}` : `Mensalidade de ${mes} disponível${sufixo}`;
      title = `Mensalidade de ${mes} disponível`;
      body = pc
        ? `<p style="${P}">${hi}A mensalidade${quem} de ${mes} já pode ser paga, com Pix ou cartão.</p><p style="${BOX}">${desconto}</p>`
        : `<p style="${P}">${hi}A mensalidade${quem} de ${mes} já pode ser paga, com Pix ou cartão: <b>${brl(v.fullCents)}</b>, com vencimento em ${v.dueDate}.</p>`;
      break;
    case "t_d5":
      subject = `Faltam 2 dias para o desconto de 7%${sufixo}`;
      title = "Faltam 2 dias para o desconto";
      body = `<p style="${P}">${hi}Ainda dá tempo de pagar a mensalidade${quem} de ${mes} com desconto.</p><p style="${BOX}">${desconto}</p>`;
      break;
    case "t_d7":
      subject = `Hoje é o último dia do desconto de 7%${sufixo}`;
      title = "Último dia do desconto";
      body = `<p style="${P}">${hi}Hoje é o último dia para pagar a mensalidade${quem} de ${mes} por <b>${brl(v.discountCents ?? v.fullCents)}</b>. A partir de amanhã, o valor é ${brl(v.fullCents)}.</p>`;
      break;
    case "t_d8":
      subject = `Mensalidade de ${mes} vence dia ${v.dueDate.slice(0, 2)}${sufixo}`;
      title = `Vencimento em ${v.dueDate}`;
      body = `<p style="${P}">${hi}O desconto deste mês terminou. A mensalidade${quem} de ${mes} é de <b>${brl(v.fullCents)}</b>, com vencimento em ${v.dueDate}.</p>${pc ? `<p style="${BOX}">No mês que vem, pagando até o dia 7, você economiza ${brl(v.fullCents - v.discountCents!)}.</p>` : ""}`;
      break;
    case "t_pre":
      subject = `Mensalidade de ${mes} vence em 2 dias${sufixo}`;
      title = `Vencimento em ${v.dueDate}`;
      body = `<p style="${P}">${hi}A mensalidade${quem} de ${mes}, de <b>${brl(v.fullCents)}</b>, vence em ${v.dueDate}.</p>`;
      break;
    case "t_due":
      subject = `Mensalidade de ${mes} vence hoje${sufixo}`;
      title = "Vence hoje";
      body = `<p style="${P}">${hi}A mensalidade${quem} de ${mes}, de <b>${brl(v.fullCents)}</b>, vence hoje. Dá para pagar em poucos segundos, com Pix ou cartão. Pagando até amanhã (${v.graceUntil}), não há multa nem juros.</p>`;
      break;
    case "t_grace":
      subject = `Último dia para pagar sem multa e juros${sufixo}`;
      title = "Último dia sem multa e juros";
      body = `<p style="${P}">${hi}A mensalidade${quem} de ${mes} venceu em ${v.dueDate}. Hoje é o último dia para pagar <b>${brl(v.fullCents)}</b> sem multa e juros.</p><p style="${BOX}">A partir de amanhã, entram multa de 2% e juros de mora de 1% ao mês, proporcionais aos dias de atraso.</p>`;
      break;
    case "t_late":
      subject = `Mensalidade de ${mes} em atraso${sufixo}`;
      title = `Mensalidade de ${mes} em atraso`;
      body = `<p style="${P}">${hi}Não encontramos o pagamento da mensalidade${quem} de ${mes}, que venceu em ${v.dueDate}.</p><p style="${BOX}">Valor de hoje: <b>${brl(v.priceNowCents)}</b> (mensalidade de ${brl(v.fullCents)}, multa de 2%: ${brl(v.fineCents)}, juros de 1% ao mês: ${brl(v.interestCents)}). Os juros seguem proporcionais aos dias de atraso.</p><p style="${P}">Se já pagou por outro meio, pode desconsiderar este aviso.</p>`;
      break;
  }
  return { subject, html: layout(title, body, { label: "Pagar mensalidade", href: ctx.href }, footer(ctx)) };
}

export function tuitionPaidEmail(v: { monthLabel: string; paidAmount: number | null }, ctx: Ctx, receiptUrl: string | null) {
  const hi = first(ctx.payerName) ? `Oi, ${esc(first(ctx.payerName))}! ` : "";
  const quem = ctx.guardian && ctx.studentName ? ` de ${esc(first(ctx.studentName))}` : "";
  const receipt = receiptUrl && /^https:\/\//.test(receiptUrl) ? ` <a href="${esc(receiptUrl)}" style="color:#10143a">Ver comprovante</a>.` : "";
  return {
    subject: `Mensalidade de ${v.monthLabel} confirmada`,
    html: layout(
      "Pagamento confirmado",
      `<p style="${P}">${hi}Recebemos o pagamento da mensalidade${quem} de ${v.monthLabel}${v.paidAmount ? ` (${brl(v.paidAmount)})` : ""}. Obrigado!${receipt}</p>`,
      null,
      footer(ctx)
    ),
  };
}

export async function sendTuitionPaidEmail(invoiceId: string, receiptUrl: string | null) {
  const admin = supabaseAdmin();
  const { data: inv } = await admin.from("tuition_invoices").select(INVOICE_COLUMNS).eq("id", invoiceId).single();
  if (!inv) return;
  const { data: plan } = await admin.from("tuition_plans").select(PLAN_COLUMNS).eq("user_id", inv.user_id).single();
  if (!plan) return;
  const c = await payerContact(admin, plan as TuitionPlan);
  if (!c.email) return;
  await sendEmail({
    to: c.email,
    ...tuitionPaidEmail({ monthLabel: monthLabel(inv.month), paidAmount: inv.paid_amount }, { payerName: c.name, studentName: c.studentName, guardian: c.guardian, href: payHref(plan as TuitionPlan) }, receiptUrl),
  });
}

export async function sendTuitionReminder(kind: TuitionEmailKind, plan: TuitionPlan, inv: TuitionInvoice) {
  const admin = supabaseAdmin();
  const c = await payerContact(admin, plan);
  if (!c.email) return false;
  const v = invoiceView(plan, inv);
  return sendEmail({ to: c.email, ...tuitionReminderEmail(kind, v, { payerName: c.name, studentName: c.studentName, guardian: c.guardian, href: payHref(plan) }) });
}
