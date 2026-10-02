import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createCheckoutLink, findPlan } from "@/lib/infinitepay";

// Abre um link de pagamento da InfinitePay para o próximo período. Não usa
// requireActiveUser de propósito: quem está com o acesso vencido precisa
// justamente conseguir pagar. Só a conta desabilitada pelo admin é barrada.
export async function POST(req: Request) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("name, is_active, category").eq("id", user.id).single();
  if (profile?.is_active === false) {
    return NextResponse.json({ error: "Sua conta foi desabilitada. Fale com a administração do +Unblocking." }, { status: 403 });
  }
  if (profile?.category === "unblocking") {
    return NextResponse.json({ error: "Seu acesso já está incluso como aluno Unblocking." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const plan = findPlan(body?.plan ?? "monthly");
  if (!plan) return NextResponse.json({ error: "Plano inválido." }, { status: 400 });

  const admin = supabaseAdmin();
  const priceCents = plan.priceCents;
  const { data: payment, error } = await admin
    .from("payments")
    .insert({ user_id: user.id, amount_cents: priceCents, period_days: plan.days })
    .select("id")
    .single();
  if (error || !payment) {
    console.error("[billing/checkout] falha ao criar pagamento:", error?.message);
    return NextResponse.json({ error: "Não foi possível abrir o pagamento agora. Tente de novo." }, { status: 500 });
  }

  try {
    const url = await createCheckoutLink({
      paymentId: payment.id,
      priceCents,
      description: `+Unblocking · Plano ${plan.label.toLowerCase()} (${plan.days} dias)`,
      customer: { name: profile?.name, email: user.email },
    });
    await admin.from("payments").update({ checkout_url: url }).eq("id", payment.id);
    return NextResponse.json({ url });
  } catch (e: any) {
    await admin.from("payments").delete().eq("id", payment.id).eq("status", "pending");
    return NextResponse.json({ error: e?.message || "Não foi possível abrir o pagamento agora." }, { status: 502 });
  }
}
