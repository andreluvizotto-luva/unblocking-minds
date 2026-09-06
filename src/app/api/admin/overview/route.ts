import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const SKILLS = ["reading", "grammar", "listening", "speaking", "writing", "overall"];

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = supabaseAdmin();

  const { data: usersPage, error: usersErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 });
  const totalStudents = usersPage.users.length;

  const { data: sessions, error: sessionsErr } = await admin
    .from("sessions")
    .select("id, user_id, level, topic_kind, status, created_at");
  if (sessionsErr) return NextResponse.json({ error: sessionsErr.message }, { status: 500 });

  const { data: reports, error: reportsErr } = await admin
    .from("reports")
    .select("session_id, scores, created_at");
  if (reportsErr) return NextResponse.json({ error: reportsErr.message }, { status: 500 });

  const { data: difficulties, error: diffErr } = await admin
    .from("difficulties")
    .select("area");
  if (diffErr) return NextResponse.json({ error: diffErr.message }, { status: 500 });

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const activeUserIds7 = new Set<string>();
  const activeUserIds30 = new Set<string>();
  const levelDistribution: Record<string, number> = Object.fromEntries(LEVELS.map((l) => [l, 0]));
  const topicKindDistribution: Record<string, number> = {};
  let completedSessions = 0;
  let inProgressSessions = 0;

  const usersWithSessions = new Set<string>();
  for (const s of sessions || []) {
    usersWithSessions.add(s.user_id);
    const age = now - new Date(s.created_at).getTime();
    if (age <= 7 * day) activeUserIds7.add(s.user_id);
    if (age <= 30 * day) activeUserIds30.add(s.user_id);
    if (levelDistribution[s.level] !== undefined) levelDistribution[s.level]++;
    topicKindDistribution[s.topic_kind] = (topicKindDistribution[s.topic_kind] || 0) + 1;
    if (s.status === "completed") completedSessions++;
    else inProgressSessions++;
  }

  const scoreSums: Record<string, number> = Object.fromEntries(SKILLS.map((k) => [k, 0]));
  const scoreCounts: Record<string, number> = Object.fromEntries(SKILLS.map((k) => [k, 0]));
  for (const r of reports || []) {
    const scores = (r.scores || {}) as Record<string, number>;
    for (const k of SKILLS) {
      if (typeof scores[k] === "number") {
        scoreSums[k] += scores[k];
        scoreCounts[k]++;
      }
    }
  }
  const avgScoreBySkill: Record<string, number | null> = {};
  for (const k of SKILLS) {
    avgScoreBySkill[k] = scoreCounts[k] > 0 ? Math.round((scoreSums[k] / scoreCounts[k]) * 10) / 10 : null;
  }

  const difficultyCounts: Record<string, number> = {};
  for (const d of difficulties || []) {
    const area = d.area || "outro";
    difficultyCounts[area] = (difficultyCounts[area] || 0) + 1;
  }
  const topDifficultyAreas = Object.entries(difficultyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([area, count]) => ({ area, count }));

  const signupsWithoutFirstSession = totalStudents - usersWithSessions.size;

  return NextResponse.json({
    totalStudents,
    activeLast7Days: activeUserIds7.size,
    activeLast30Days: activeUserIds30.size,
    totalSessions: (sessions || []).length,
    completedSessions,
    inProgressSessions,
    signupsWithoutFirstSession,
    levelDistribution,
    topicKindDistribution,
    avgScoreBySkill,
    topDifficultyAreas,
  });
}
