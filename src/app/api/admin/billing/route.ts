import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const DAY = 86_400_000;

// Visão do negócio para o painel: quem está em dia, em teste, vencendo ou
// vencido, receita do mês, conversão de teste em assinatura e pagamentos que
// foram abertos e não concluídos.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = supabaseAdmin();
  const now = Date.now();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, name, category, access_until, is_active, is_admin");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: payments, error: payErr } = await admin
    .from("payments")
    .select("id, user_id, status, amount_cents, paid_amount, created_at, paid_at")
    .gte("created_at", new Date(now - 90 * DAY).toISOString());
  if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 });

  const alunos = (profiles || []).filter((p) => !p.is_admin && p.is_active !== false);
  const until = (p: any) => (p.access_until ? new Date(p.access_until).getTime() : 0);

  const assinantesEmDia = alunos.filter((p) => p.category === "app" && until(p) > now).length;
  const demosAtivas = alunos.filter((p) => p.category === "demo" && until(p) > now).length;
  const vencendo7 = alunos.filter((p) => p.category !== "unblocking" && until(p) > now && until(p) <= now + 7 * DAY).length;
  const vencidos = alunos.filter((p) => p.category !== "unblocking" && until(p) <= now).length;
  const unblocking = alunos.filter((p) => p.category === "unblocking").length;

  // Mês corrente no fuso de Brasília (UTC-3, sem horário de verão).
  const brt = new Date(now - 3 * 3600_000);
  const inicioMes = Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), 1) + 3 * 3600_000;
  const pagos = (payments || []).filter((p) => p.status === "paid");
  const receitaMesCents = pagos
    .filter((p) => p.paid_at && new Date(p.paid_at).getTime() >= inicioMes)
    .reduce((a, p) => a + (p.paid_amount ?? p.amount_cents), 0);
  const pagamentosMes = pagos.filter((p) => p.paid_at && new Date(p.paid_at).getTime() >= inicioMes).length;

  // Conversão: quem já pagou ao menos uma vez, sobre esses mais quem ainda
  // está (ou terminou) como demo sem nunca ter pago.
  const pagantes = new Set(pagos.map((p) => p.user_id));
  const demosSemPagar = (profiles || []).filter((p) => !p.is_admin && p.category === "demo" && !pagantes.has(p.id)).length;
  const conversao = pagantes.size + demosSemPagar > 0 ? Math.round((pagantes.size / (pagantes.size + demosSemPagar)) * 100) : null;

  // Pagamentos abertos há mais de 30 min sem pagamento confirmado depois
  // deles, do mesmo aluno — um por aluno, o mais recente.
  const nome = new Map((profiles || []).map((p) => [p.id, p.name]));
  const abandonadosPorAluno = new Map<string, { userId: string; name: string | null; createdAt: string; amountCents: number }>();
  for (const p of payments || []) {
    if (p.status !== "pending" || new Date(p.created_at).getTime() > now - 30 * 60_000) continue;
    const pagouDepois = pagos.some((x) => x.user_id === p.user_id && x.paid_at && new Date(x.paid_at) >= new Date(p.created_at));
    if (pagouDepois) continue;
    const atual = abandonadosPorAluno.get(p.user_id);
    if (!atual || new Date(p.created_at) > new Date(atual.createdAt)) {
      abandonadosPorAluno.set(p.user_id, { userId: p.user_id, name: nome.get(p.user_id) ?? null, createdAt: p.created_at, amountCents: p.amount_cents });
    }
  }
  const { data: users } = abandonadosPorAluno.size ? await admin.auth.admin.listUsers({ perPage: 1000 }) : { data: null };
  const emailPorId = new Map((users?.users || []).map((u) => [u.id, u.email]));
  const abandonados = [...abandonadosPorAluno.values()]
    .map((a) => ({ ...a, email: emailPorId.get(a.userId) || null }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    assinantesEmDia,
    demosAtivas,
    vencendo7,
    vencidos,
    unblocking,
    receitaMesCents,
    pagamentosMes,
    conversao,
    pagantes: pagantes.size,
    abandonados,
  });
}
