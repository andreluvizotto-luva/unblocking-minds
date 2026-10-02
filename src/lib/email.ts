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

function layout(name: string | null | undefined, title: string, body: string, cta: { label: string; href: string } | null, extra = "", raw = false) {
  const first = name ? esc(name.split(" ")[0]) : "";
  return `<!doctype html><html><body style="margin:0;background:#f4efe3;font-family:Arial,Helvetica,sans-serif;color:#10143a">
<div style="max-width:520px;margin:0 auto;padding:28px 18px">
  <div style="font-size:20px;font-weight:700;margin-bottom:18px">+Unblocking</div>
  <div style="background:#ffffff;border-radius:16px;padding:24px">
    <h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
    ${raw ? body : `<p style="font-size:15px;line-height:1.55;margin:0 0 16px">${first ? `Oi, ${first}! ` : ""}${body}</p>`}
    ${extra}
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

export type AchievementsStats = {
  lessons: number;
  daysPracticed: number;
  streak: number;
  unlocked: { icon: string | null; title: string }[];
};

const P = "font-size:15px;line-height:1.55;margin:0 0 16px";

function tile(value: number, label: string) {
  return `<td style="background:#f4efe3;border-radius:12px;padding:12px 6px;text-align:center;width:33%"><div style="font-size:24px;font-weight:700;line-height:1.1">${value}</div><div style="font-size:12px;color:#5d5a50;margin-top:2px">${label}</div></td>`;
}

// Convite para continuar: primeiro os resultados (ou a importância do
// primeiro passo), depois o argumento e, por último, a cobrança como forma
// de seguir evoluindo.
function inviteEmail(kind: Exclude<ReminderKind, "expired">, name: string | null | undefined, accessUntil: string, priceLabel: string, stats?: AchievementsStats | null) {
  const first = name ? esc(name.split(" ")[0]) : "";
  const hi = first ? `Oi, ${first}! ` : "";
  const date = fmtDate(accessUntil);
  const trial = kind === "trial_ending";
  const practiced = (stats?.lessons ?? 0) > 0;
  const href = `${site()}/assinatura`;

  const title = !practiced
    ? "O primeiro passo está esperando por você"
    : kind === "trial_ending"
      ? "Você começou bem. Vamos continuar?"
      : kind === "renewal_soon"
        ? "Seu inglês está ganhando ritmo. Vamos continuar?"
        : "Não pare agora: seu inglês está evoluindo";

  let top: string;
  if (practiced && stats) {
    const tiles = [tile(stats.lessons, stats.lessons === 1 ? "aula" : "aulas"), tile(stats.daysPracticed, stats.daysPracticed === 1 ? "dia de prática" : "dias de prática")];
    if (stats.streak >= 2) tiles.push(tile(stats.streak, "dias seguidos"));
    const chips = stats.unlocked
      .map(
        (a) =>
          `<span style="display:inline-block;background:#fdf0d6;border:1px solid #f1c775;border-radius:999px;padding:6px 12px;font-size:13.5px;font-weight:700;margin:0 6px 8px 0">${esc(`${a.icon ? `${a.icon} ` : ""}${a.title}`)}</span>`
      )
      .join("");
    top = `<p style="${P}">${hi}Olha o que você construiu ${trial ? "no teste" : "nos últimos 30 dias"}:</p>
    <table role="presentation" width="100%" cellspacing="8" style="margin:0 -8px 8px;width:calc(100% + 16px);border-collapse:separate"><tr>${tiles.join("")}</tr></table>
    ${chips ? `<div style="margin:0 0 8px">${chips}</div>` : ""}
    <p style="${P}">Esse resultado não aconteceu por acaso: veio de constância. Idioma se aprende por repetição, e é quando a prática para que o que você construiu começa a esfriar. Continuar é o que transforma esse começo em fluência de verdade, e os desafios seguem subindo no ritmo do seu desempenho.</p>`;
  } else {
    top = `<p style="${P}">${hi}O primeiro passo é o mais importante, e ele ainda está ao seu alcance. Poucos minutos por dia, de forma constante, fazem mais pelo seu inglês do que longas maratonas de vez em quando. Cada aula já vem no seu nível e acompanha o seu ritmo, então começar (ou recomeçar) é simples.</p>`;
  }

  const pay = trial
    ? `${practiced ? "Para seguir nesse caminho" : "Para dar esse passo com acesso completo"}, assine o plano mensal por <b>${priceLabel}</b> (30 dias, com Pix ou cartão). Seu teste grátis vai até ${date}.`
    : `${practiced ? "Para seguir nesse caminho" : "Para dar esse passo com acesso completo"}, renove seu acesso por <b>${priceLabel}</b> (30 dias, com Pix ou cartão). Seu acesso atual vai até ${date} e os dias novos são somados ao que ainda falta.`;

  const subject =
    kind === "trial_ending"
      ? "Seu teste grátis do +Unblocking termina amanhã. Vamos continuar?"
      : kind === "renewal_soon"
        ? "Sua assinatura do +Unblocking vence em 3 dias. Vamos continuar?"
        : "Sua assinatura do +Unblocking vence amanhã. Vamos continuar?";

  const html = layout(
    null,
    title,
    top,
    { label: trial ? "Assinar e continuar" : "Continuar minha evolução", href },
    `<p style="background:#f4efe3;border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.55;margin:0 0 16px">${pay}</p>`,
    true
  );
  return { subject, html };
}

export function reminderEmail(
  kind: ReminderKind,
  name: string | null | undefined,
  accessUntil: string,
  priceLabel: string,
  stats?: AchievementsStats | null
) {
  const cta = { label: "Renovar assinatura", href: `${site()}/assinatura` };
  const date = fmtDate(accessUntil);
  switch (kind) {
    case "trial_ending":
    case "renewal_soon":
    case "renewal_tomorrow":
      return inviteEmail(kind, name, accessUntil, priceLabel, stats);
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
