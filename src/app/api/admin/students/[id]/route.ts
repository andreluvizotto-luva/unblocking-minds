import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = supabaseAdmin();
  const userId = params.id;

  const { data: userData, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !userData?.user) {
    return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select(
      "name, bio, location, website, default_level, is_admin, is_active, approved_at, password_expires_at, created_at, current_streak, longest_streak, last_practice_date"
    )
    .eq("id", userId)
    .single();
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

  const { data: sessions, error: sessionsErr } = await admin
    .from("sessions")
    .select("id, level, topic_kind, topic_title, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (sessionsErr) return NextResponse.json({ error: sessionsErr.message }, { status: 500 });

  const sessionIds = (sessions || []).map((s) => s.id);

  let reports: any[] = [];
  let difficulties: any[] = [];
  if (sessionIds.length > 0) {
    const { data: reportsData, error: reportsErr } = await admin
      .from("reports")
      .select("session_id, summary, scores, recurring_difficulties, created_at")
      .in("session_id", sessionIds);
    if (reportsErr) return NextResponse.json({ error: reportsErr.message }, { status: 500 });
    reports = reportsData || [];

    const { data: diffData, error: diffErr } = await admin
      .from("difficulties")
      .select("session_id, skill, area, note, created_at")
      .in("session_id", sessionIds);
    if (diffErr) return NextResponse.json({ error: diffErr.message }, { status: 500 });
    difficulties = diffData || [];
  }

  const reportsBySession = new Map(reports.map((r) => [r.session_id, r]));
  const sessionsWithData = (sessions || []).map((s) => ({
    ...s,
    report: reportsBySession.get(s.id) || null,
    difficulties: difficulties.filter((d) => d.session_id === s.id),
  }));

  const { data: skillProgress } = await admin
    .from("skill_progress")
    .select("skill, difficulty_percent, consecutive_strong")
    .eq("user_id", userId);

  return NextResponse.json({
    id: userId,
    email: userData.user.email,
    profile,
    sessions: sessionsWithData,
    skillProgress: skillProgress || [],
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userId = params.id;
  const body = await req.json();
  const update: Record<string, any> = {};

  if (typeof body.isActive === "boolean") {
    update.is_active = body.isActive;
    // Marca o momento da aprovação — permite diferenciar, na tela de
    // bloqueio do aluno, "cadastro novo aguardando aprovação" de "conta
    // que já foi aprovada e foi desabilitada depois".
    if (body.isActive) update.approved_at = new Date().toISOString();
  }
  if ("passwordExpiresAt" in body) update.password_expires_at = body.passwordExpiresAt || null;
  if (typeof body.isAdmin === "boolean") {
    // Impede que um admin remova o próprio acesso de admin por engano
    // (o que poderia deixar ninguém com acesso ao painel).
    if (userId === auth.user.id && body.isAdmin === false) {
      return NextResponse.json({ error: "Você não pode remover seu próprio acesso de admin." }, { status: 400 });
    }
    update.is_admin = body.isAdmin;
  }
  if ("defaultLevel" in body) {
    if (body.defaultLevel !== null && !CEFR_LEVELS.includes(body.defaultLevel)) {
      return NextResponse.json({ error: "Nível inválido" }, { status: 400 });
    }
    update.default_level = body.defaultLevel;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin.from("profiles").update(update).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// Apaga o aluno de forma definitiva. Remover o usuário do Auth dispara o
// "on delete cascade" em todas as tabelas que referenciam auth.users, então
// perfil, aulas, relatórios, dificuldades, progresso por habilidade e
// conquistas somem junto. Não há como desfazer.
//
// Duas travas de segurança, além da checagem de admin:
//  1. um admin nunca apaga a própria conta;
//  2. não é possível apagar outro admin sem antes remover o status de
//     administrador dele — evita perder acesso ao painel por engano.
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const userId = params.id;

  if (userId === auth.user.id) {
    return NextResponse.json({ error: "Você não pode apagar a sua própria conta." }, { status: 400 });
  }

  const admin = supabaseAdmin();

  const { data: target, error: targetErr } = await admin
    .from("profiles")
    .select("name, is_admin")
    .eq("id", userId)
    .single();

  if (targetErr || !target) {
    return NextResponse.json({ error: "Aluno não encontrado" }, { status: 404 });
  }

  if (target.is_admin) {
    return NextResponse.json(
      { error: "Este aluno é administrador. Remova o acesso de admin antes de apagar a conta." },
      { status: 400 }
    );
  }

  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, deletedName: target.name });
}
