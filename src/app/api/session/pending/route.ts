import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

// Devolve a aula em aberto do aluno, se houver, para que a tela inicial
// possa oferecer "continuar de onde parou". A leitura usa a sessão do
// próprio aluno de propósito: a RLS já garante que ele só enxerga as
// próprias aulas.
export async function GET() {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, level, topic_kind, topic_title, content, current_skill_index, created_at")
    .eq("user_id", user.id)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) return NextResponse.json({ pending: null });

  // As dificuldades já registradas voltam junto para que o relatório final
  // considere também o que o aluno respondeu antes da pausa.
  const { data: difficulties } = await supabase
    .from("difficulties")
    .select("skill, area, note")
    .eq("session_id", session.id);

  return NextResponse.json({
    pending: {
      sessionId: session.id,
      level: session.level,
      topicKind: session.topic_kind,
      topicTitle: session.topic_title,
      content: session.content,
      skillIndex: session.current_skill_index ?? 0,
      createdAt: session.created_at,
      log: difficulties || [],
    },
  });
}
