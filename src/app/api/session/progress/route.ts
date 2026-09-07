import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const TOTAL_SKILLS = 5;

// Salva em qual habilidade o aluno parou, para ele poder voltar depois.
// A escrita usa a service_role porque o aluno não escreve mais na tabela
// sessions direto (ver supabase/schema.sql); a checagem de dono é feita
// aqui, comparando com o usuário autenticado.
export async function POST(req: Request) {
  const { sessionId, skillIndex } = await req.json();

  if (!sessionId || typeof skillIndex !== "number") {
    return NextResponse.json({ error: "sessionId e skillIndex são obrigatórios" }, { status: 400 });
  }
  if (skillIndex < 0 || skillIndex >= TOTAL_SKILLS) {
    return NextResponse.json({ error: "skillIndex fora do intervalo" }, { status: 400 });
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
    return NextResponse.json({ error: "Esta aula já foi concluída" }, { status: 400 });
  }

  const { error } = await admin
    .from("sessions")
    .update({ current_skill_index: skillIndex })
    .eq("id", sessionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
