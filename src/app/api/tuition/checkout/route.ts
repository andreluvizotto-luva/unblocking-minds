import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { INVOICE_COLUMNS, hasGuardian, loadPlan, openTuitionCheckout, type TuitionInvoice } from "@/lib/tuition";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// O aluno paga a própria mensalidade pelo app (só quando não há responsável
// financeiro e a forma de pagamento é o link do mês).
export async function POST(req: Request) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const invoiceId = typeof body?.invoiceId === "string" && UUID.test(body.invoiceId) ? body.invoiceId : null;
  if (!invoiceId) return NextResponse.json({ error: "Mensalidade não encontrada." }, { status: 400 });

  const admin = supabaseAdmin();
  const plan = await loadPlan(admin, user.id);
  if (!plan || !plan.active || hasGuardian(plan) || plan.method !== "link") {
    return NextResponse.json({ error: "Esta mensalidade não é paga pelo app." }, { status: 400 });
  }

  const { data: inv } = await admin.from("tuition_invoices").select(INVOICE_COLUMNS).eq("id", invoiceId).eq("user_id", user.id).maybeSingle();
  if (!inv) return NextResponse.json({ error: "Mensalidade não encontrada." }, { status: 404 });
  if (inv.status !== "open") return NextResponse.json({ error: "Esta mensalidade já está paga." }, { status: 400 });

  try {
    const { data: prof } = await admin.from("profiles").select("name").eq("id", user.id).single();
    const url = await openTuitionCheckout(admin, plan, inv as TuitionInvoice, { name: prof?.name, email: user.email }, null);
    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Não foi possível abrir o pagamento agora." }, { status: 502 });
  }
}
