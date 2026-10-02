import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { billingPriceCents } from "@/lib/infinitepay";
import { reminderEmail, sendEmail, type AchievementsStats, type ReminderKind } from "@/lib/email";

const DAY = 86_400_000;

// Janelas de cada lembrete, relativas a access_until. A Vercel Cron chama
// uma vez por dia (vercel.json); billing_emails garante um único envio por
// tipo e período, mesmo que a janela pegue o mesmo aluno dois dias seguidos.
const WINDOWS: { kind: ReminderKind; categories: string[]; from: number; to: number }[] = [
  { kind: "trial_ending", categories: ["demo"], from: 0, to: 1 },
  { kind: "renewal_tomorrow", categories: ["app"], from: 0, to: 1 },
  { kind: "renewal_soon", categories: ["app"], from: 1, to: 3 },
  { kind: "expired", categories: ["demo", "app"], from: -3, to: 0 },
];

// Conquistas dos últimos 30 dias, para o texto de incentivo dos lembretes
// de antes do vencimento.
async function recentStats(admin: ReturnType<typeof supabaseAdmin>, userId: string, now: number): Promise<AchievementsStats | null> {
  const since = new Date(now - 30 * DAY).toISOString();
  const [{ data: sessions }, { data: profile }, { data: unlocked }] = await Promise.all([
    admin.from("sessions").select("created_at").eq("user_id", userId).eq("status", "completed").gte("created_at", since),
    admin.from("profiles").select("current_streak").eq("id", userId).single(),
    admin.from("user_achievements").select("achievement_code").eq("user_id", userId).gte("unlocked_at", since),
  ]);

  const days = new Set((sessions || []).map((s: any) => new Date(s.created_at).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })));
  const codes = (unlocked || []).map((u: any) => u.achievement_code);
  let titles: { icon: string | null; title: string }[] = [];
  if (codes.length) {
    const { data } = await admin.from("achievements").select("icon, title, sort_order").in("code", codes).order("sort_order");
    titles = (data || []).map((a: any) => ({ icon: a.icon, title: a.title }));
  }
  return { lessons: sessions?.length ?? 0, daysPracticed: days.size, streak: profile?.current_streak ?? 0, unlocked: titles };
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const now = Date.now();
  const price = (billingPriceCents() / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const sent: Record<string, number> = {};

  for (const w of WINDOWS) {
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, name, access_until")
      .in("category", w.categories)
      .eq("is_active", true)
      .eq("is_admin", false)
      .gt("access_until", new Date(now + w.from * DAY).toISOString())
      .lte("access_until", new Date(now + w.to * DAY).toISOString());
    if (error) {
      console.error("[cron/billing-reminders]", w.kind, error.message);
      continue;
    }

    for (const p of profiles || []) {
      const { data: mark, error: dup } = await admin
        .from("billing_emails")
        .insert({ user_id: p.id, kind: w.kind, access_until: p.access_until })
        .select("id")
        .single();
      if (dup || !mark) continue; // já enviado neste período

      const { data: u } = await admin.auth.admin.getUserById(p.id);
      const email = u.user?.email;
      const stats = email && w.kind !== "expired" ? await recentStats(admin, p.id, now) : null;
      const ok = email ? await sendEmail({ to: email, ...reminderEmail(w.kind, p.name, p.access_until, price, stats) }) : false;
      if (ok) sent[w.kind] = (sent[w.kind] || 0) + 1;
      else await admin.from("billing_emails").delete().eq("id", mark.id); // tenta de novo amanhã
    }
  }

  return NextResponse.json({ ok: true, sent });
}
