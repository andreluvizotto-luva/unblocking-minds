import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { accessStatus, ACCESS_SELECT, daysLeft } from "@/lib/access";
import { BILLING_PERIOD_DAYS, billingPriceCents } from "@/lib/infinitepay";

// Situação da assinatura do aluno logado, para a tela Minha assinatura e
// para os avisos da home.
export async function GET() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select(ACCESS_SELECT).eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  const { data: payments } = await supabaseAdmin()
    .from("payments")
    .select("id, amount_cents, paid_amount, capture_method, receipt_url, paid_at")
    .eq("user_id", user.id)
    .eq("status", "paid")
    .order("paid_at", { ascending: false })
    .limit(6);

  return NextResponse.json({
    category: profile.category,
    isAdmin: !!profile.is_admin,
    status: accessStatus(profile),
    accessUntil: profile.access_until,
    daysLeft: daysLeft(profile.access_until),
    priceCents: billingPriceCents(),
    periodDays: BILLING_PERIOD_DAYS,
    payments: payments || [],
  });
}
