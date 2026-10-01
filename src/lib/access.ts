// Regra única de acesso, usada no navegador (access-check.ts) e no servidor
// (require-active-user.ts). "unblocking" é aluno da Unblocking Minds, com
// acesso incluso; "demo" e "app" dependem de access_until (fim do teste grátis
// ou do período pago).
export type Category = "demo" | "unblocking" | "app";

export type AccessProfile = {
  is_admin?: boolean | null;
  is_active?: boolean | null;
  password_expires_at?: string | null;
  category?: string | null;
  access_until?: string | null;
};

export type AccessStatus = "ok" | "disabled" | "expired" | "demo_ended" | "subscription_ended";

export const ACCESS_SELECT = "is_admin, is_active, password_expires_at, category, access_until";

export function accessStatus(p: AccessProfile, now = Date.now()): AccessStatus {
  if (p.is_admin) return "ok";
  if (p.is_active === false) return "disabled";
  if (p.password_expires_at && new Date(p.password_expires_at).getTime() < now) return "expired";
  if (p.category === "unblocking") return "ok";
  if (p.access_until && new Date(p.access_until).getTime() > now) return "ok";
  return p.category === "app" ? "subscription_ended" : "demo_ended";
}

export function daysLeft(accessUntil: string | null | undefined, now = Date.now()) {
  if (!accessUntil) return 0;
  return Math.max(0, Math.ceil((new Date(accessUntil).getTime() - now) / 86_400_000));
}

export const ACCESS_ERROR: Record<Exclude<AccessStatus, "ok">, string> = {
  disabled: "Sua conta foi desabilitada. Fale com a administração do +Unblocking.",
  expired: "O prazo de acesso da sua conta expirou. Fale com a administração do +Unblocking.",
  demo_ended: "Seu teste grátis acabou. Assine em Minha assinatura para continuar.",
  subscription_ended: "Sua assinatura venceu. Renove em Minha assinatura para continuar.",
};
