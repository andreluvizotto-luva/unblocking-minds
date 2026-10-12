import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasGuardian, loadPlan, tuitionState } from "@/lib/tuition";

// Mensalidade da escola do aluno logado. Com responsável financeiro, o aluno
// não vê cobrança nenhuma no app (show: false); quem paga é o responsável,
// pelo link do e-mail.
export async function GET() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const admin = supabaseAdmin();
  const plan = await loadPlan(admin, user.id);
  if (!plan || !plan.active || hasGuardian(plan)) return NextResponse.json({ show: false });

  return NextResponse.json({ show: true, ...(await tuitionState(admin, plan)) });
}
