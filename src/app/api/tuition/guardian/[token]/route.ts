import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { INVOICE_COLUMNS, PLAN_COLUMNS, openTuitionCheckout, tuitionState, type TuitionInvoice, type TuitionPlan } from "@/lib/tuition";

const TOKEN = /^[0-9a-f]{48}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Página do responsável financeiro, aberta pelo link do e-mail, sem login.
// O token longo e aleatório é a credencial; a resposta traz só o necessário
// para pagar (primeiro nome do aluno, cobranças), nada da prática do aluno
// nem dados do próprio responsável além do primeiro nome.
async function planByToken(token: string) {
  if (!TOKEN.test(token)) return null;
  const admin = supabaseAdmin();
  const { data } = await admin.from("tuition_plans").select(PLAN_COLUMNS).eq("guardian_token", token).maybeSingle();
  const plan = data as TuitionPlan | null;
  if (!plan || !plan.active || !plan.guardian_email) return null;
  return plan;
}

const firstName = (n: string | null | undefined) => (n ? n.trim().split(/\s+/)[0] : null);

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const plan = await planByToken(params.token);
  if (!plan) return NextResponse.json({ error: "Link inválido ou desativado." }, { status: 404 });
  const admin = supabaseAdmin();
  const { data: prof } = await admin.from("profiles").select("name").eq("id", plan.user_id).single();
  const state = await tuitionState(admin, plan);
  return NextResponse.json({ studentName: firstName(prof?.name), guardianName: firstName(plan.guardian_name), ...state });
}

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const plan = await planByToken(params.token);
  if (!plan) return NextResponse.json({ error: "Link inválido ou desativado." }, { status: 404 });
  if (plan.method !== "link") return NextResponse.json({ error: "Esta mensalidade está no débito automático." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const invoiceId = typeof body?.invoiceId === "string" && UUID.test(body.invoiceId) ? body.invoiceId : null;
  if (!invoiceId) return NextResponse.json({ error: "Mensalidade não encontrada." }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: inv } = await admin.from("tuition_invoices").select(INVOICE_COLUMNS).eq("id", invoiceId).eq("user_id", plan.user_id).maybeSingle();
  if (!inv) return NextResponse.json({ error: "Mensalidade não encontrada." }, { status: 404 });
  if (inv.status !== "open") return NextResponse.json({ error: "Esta mensalidade já está paga." }, { status: 400 });

  try {
    const { data: prof } = await admin.from("profiles").select("name").eq("id", plan.user_id).single();
    const url = await openTuitionCheckout(
      admin,
      plan,
      inv as TuitionInvoice,
      { name: plan.guardian_name, email: plan.guardian_email, phone: plan.guardian_phone },
      firstName(prof?.name)
    );
    return NextResponse.json({ url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Não foi possível abrir o pagamento agora." }, { status: 502 });
  }
}
