// E-mails transacionais via Resend (POST https://api.resend.com/emails).
// Sem RESEND_API_KEY o envio é ignorado com um aviso no log, para não
// quebrar o fluxo de pagamento em ambientes sem e-mail configurado.

function site() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://maisunblocking.com.br").replace(/\/$/, "");
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY não configurada — e-mail não enviado:", subject);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "+Unblocking <assinatura@maisunblocking.com.br>",
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    console.error("[email] Resend recusou:", res.status, (await res.text()).slice(0, 300));
    return false;
  }
  return true;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });

function layout(name: string | null | undefined, title: string, body: string, cta: { label: string; href: string } | null) {
  const first = name ? esc(name.split(" ")[0]) : "";
  return `<!doctype html><html><body style="margin:0;background:#f4efe3;font-family:Arial,Helvetica,sans-serif;color:#10143a">
<div style="max-width:520px;margin:0 auto;padding:28px 18px">
  <div style="font-size:20px;font-weight:700;margin-bottom:18px">+Unblocking</div>
  <div style="background:#ffffff;border-radius:16px;padding:24px">
    <h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
    <p style="font-size:15px;line-height:1.55;margin:0 0 16px">${first ? `Oi, ${first}! ` : ""}${body}</p>
    ${
      cta
        ? `<a href="${cta.href}" style="display:inline-block;background:#f6a017;color:#10143a;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${esc(cta.label)}</a>`
        : ""
    }
  </div>
  <p style="font-size:12px;color:#6b6b6b;margin-top:16px">Você recebeu este e-mail porque tem uma conta no +Unblocking.</p>
</div></body></html>`;
}

export type ReminderKind = "trial_ending" | "renewal_soon" | "renewal_tomorrow" | "expired";

export function reminderEmail(kind: ReminderKind, name: string | null | undefined, accessUntil: string, priceLabel: string) {
  const cta = { label: kind === "trial_ending" ? "Assinar agora" : "Renovar assinatura", href: `${site()}/assinatura` };
  const date = fmtDate(accessUntil);
  switch (kind) {
    case "trial_ending":
      return {
        subject: "Seu teste grátis do +Unblocking termina amanhã",
        html: layout(name, "Seu teste grátis termina amanhã", `Para continuar praticando depois de ${date}, assine o plano mensal por ${priceLabel}, com Pix ou cartão.`, cta),
      };
    case "renewal_soon":
      return {
        subject: "Sua assinatura do +Unblocking vence em 3 dias",
        html: layout(name, "Sua assinatura vence em 3 dias", `Seu acesso vai até ${date}. Renove por ${priceLabel} e os 30 dias novos são somados ao que ainda falta.`, cta),
      };
    case "renewal_tomorrow":
      return {
        subject: "Sua assinatura do +Unblocking vence amanhã",
        html: layout(name, "Sua assinatura vence amanhã", `Seu acesso vai até ${date}. Renove por ${priceLabel} para não perder a sequência de prática.`, cta),
      };
    case "expired":
      return {
        subject: "Seu acesso ao +Unblocking venceu",
        html: layout(name, "Seu acesso venceu", `Seu acesso terminou em ${date}. Renove por ${priceLabel}, com Pix ou cartão, e volte a praticar na hora.`, cta),
      };
  }
}

// Lembrete enviado à mão pelo admin, em qualquer momento do ciclo.
export function manualReminderEmail(
  name: string | null | undefined,
  category: string,
  accessUntil: string | null,
  priceLabel: string
) {
  const vencido = !accessUntil || new Date(accessUntil).getTime() <= Date.now();
  const cta = { label: category === "app" ? "Renovar assinatura" : "Assinar agora", href: `${site()}/assinatura` };
  const quando = accessUntil ? fmtDate(accessUntil) : "";
  const body =
    category === "demo"
      ? vencido
        ? `Seu teste grátis terminou${quando ? ` em ${quando}` : ""}. Assine o plano mensal por ${priceLabel}, com Pix ou cartão, e continue de onde parou.`
        : `Seu teste grátis vai até ${quando}. Aproveite para praticar e, quando quiser continuar, assine o plano mensal por ${priceLabel}.`
      : vencido
        ? `Seu acesso terminou${quando ? ` em ${quando}` : ""}. Renove por ${priceLabel}, com Pix ou cartão, e volte a praticar na hora.`
        : `Sua assinatura vai até ${quando}. Renove por ${priceLabel} quando quiser: os 30 dias novos são somados ao que ainda falta.`;
  return {
    subject: category === "demo" ? "Continue praticando no +Unblocking" : "Sua assinatura do +Unblocking",
    html: layout(name, category === "demo" ? "Continue praticando" : "Sua assinatura", body, cta),
  };
}

export function paymentConfirmedEmail(name: string | null | undefined, accessUntil: string, receiptUrl?: string | null) {
  const receipt = receiptUrl && /^https:\/\//.test(receiptUrl) ? ` <a href="${esc(receiptUrl)}" style="color:#10143a">Ver comprovante</a>.` : "";
  return {
    subject: "Pagamento confirmado no +Unblocking",
    html: layout(
      name,
      "Pagamento confirmado",
      `Recebemos seu pagamento. Seu acesso está garantido até ${fmtDate(accessUntil)}.${receipt}`,
      { label: "Praticar agora", href: site() }
    ),
  };
}
