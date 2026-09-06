import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = supabaseAdmin();

  const { data: usersPage, error: usersErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 });

  const { data: profiles, error: profilesErr } = await admin
    .from("profiles")
    .select("id, name, default_level, is_admin, is_active, approved_at, password_expires_at, created_at");
  if (profilesErr) return NextResponse.json({ error: profilesErr.message }, { status: 500 });
  const profileById = new Map((profiles || []).map((p) => [p.id, p]));

  const { data: sessions, error: sessionsErr } = await admin
    .from("sessions")
    .select("id, user_id, level, status, created_at");
  if (sessionsErr) return NextResponse.json({ error: sessionsErr.message }, { status: 500 });

  const { data: reports, error: reportsErr } = await admin
    .from("reports")
    .select("session_id, scores, created_at");
  if (reportsErr) return NextResponse.json({ error: reportsErr.message }, { status: 500 });

  const sessionById = new Map((sessions || []).map((s) => [s.id, s]));
  const reportsBySession = new Map((reports || []).map((r) => [r.session_id, r]));

  const byUser: Record<string, { total: number; completed: number; lastAt: string | null; lastLevel: string | null; lastOverall: number | null }> = {};
  for (const s of sessions || []) {
    const entry = (byUser[s.user_id] ||= { total: 0, completed: 0, lastAt: null, lastLevel: null, lastOverall: null });
    entry.total++;
    if (s.status === "completed") entry.completed++;
    if (!entry.lastAt || new Date(s.created_at) > new Date(entry.lastAt)) {
      entry.lastAt = s.created_at;
      entry.lastLevel = s.level;
      const report = reportsBySession.get(s.id);
      const overall = report?.scores?.overall;
      entry.lastOverall = typeof overall === "number" ? overall : entry.lastOverall;
    }
  }

  const students = usersPage.users.map((u) => {
    const profile = profileById.get(u.id);
    const stats = byUser[u.id];
    return {
      id: u.id,
      email: u.email,
      name: profile?.name || null,
      defaultLevel: profile?.default_level || null,
      isAdmin: !!profile?.is_admin,
      isActive: profile?.is_active !== false,
      approvedAt: profile?.approved_at || null,
      passwordExpiresAt: profile?.password_expires_at || null,
      createdAt: u.created_at,
      totalSessions: stats?.total || 0,
      completedSessions: stats?.completed || 0,
      lastSessionAt: stats?.lastAt || null,
      lastLevel: stats?.lastLevel || null,
      lastOverallScore: stats?.lastOverall ?? null,
    };
  });

  students.sort((a, b) => {
    if (!a.lastSessionAt && !b.lastSessionAt) return 0;
    if (!a.lastSessionAt) return 1;
    if (!b.lastSessionAt) return -1;
    return new Date(b.lastSessionAt).getTime() - new Date(a.lastSessionAt).getTime();
  });

  return NextResponse.json({ students });
}
