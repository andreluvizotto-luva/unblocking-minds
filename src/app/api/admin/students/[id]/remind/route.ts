import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { billingPriceCents } from "@/lib/infinitepay";
import { manualReminderEmail, sendEmail } from "@/lib/email";

// "Enviar lembrete agora" do painel: e-mail de assinatura para um aluno
// demo ou assinante, fora do ciclo automático do cron.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from("profiles").select("name, category, access_until").eq("id", params.id).single();
  if (!profile) return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
  if (profile.category === "unblocking") {
    return NextResponse.json({ error: "Aluno Unblocking tem acesso incluso, não precisa de lembrete." }, { status: 400 });
  }

  const { data: u } = await admin.auth.admin.getUserById(params.id);
  if (!u.user?.email) return NextResponse.json({ error: "Aluno sem e-mail cadastrado" }, { status: 400 });

  const price = (billingPriceCents() / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const ok = await sendEmail({ to: u.user.email, ...manualReminderEmail(profile.name, profile.category, profile.access_until, price) });
  if (!ok) return NextResponse.json({ error: "Não foi possível enviar o e-mail agora." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
