import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Descarta uma aula em andamento a pedido do aluno ("sair sem salvar").
// Apaga a aula e, por cascade, as dificuldades registradas nela. Só apaga
// aula do próprio aluno e só se ainda estiver em andamento — uma aula já
// concluída tem relatório e faz parte do histórico, não pode sumir por aqui.
export async function POST(req: Request) {
  const { sessionId } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId é obrigatório" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const { data: session } = await admin
    .from("sessions")
    .select("id, user_id, status")
    .eq("id", sessionId)
    .single();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "Aula não encontrada" }, { status: 404 });
  }
  if (session.status !== "in_progress") {
    return NextResponse.json({ error: "Uma aula já concluída não pode ser descartada." }, { status: 400 });
  }

  const { error } = await admin.from("sessions").delete().eq("id", sessionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
