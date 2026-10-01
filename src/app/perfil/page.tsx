"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Card, Button, SectionLabel, SectionHeading, ProgressBar, Lockup, isSoundEnabled, setSoundEnabled } from "@/components/ui";
import { EvolutionChart } from "@/components/EvolutionChart";
import { BottomNav } from "@/components/BottomNav";
import { checkAccessOrRedirect } from "@/lib/access-check";
import { AchievementStrip, type AchievementItem } from "@/components/Gamification";
import { PASSWORD_RULES, mensagemDePendencias } from "@/lib/password-rules";
import { SkillCards, skillValues, skillTrend, type LessonPoint } from "@/components/SkillProgress";

type SessionRow = {
  id: string;
  created_at: string;
  level: string;
  topic_kind: string;
  topic_title: string;
  status: string;
  reports: { summary: string; scores: any; created_at: string }[] | null;
};

const SKILL_LABELS: Record<string, string> = {
  reading: "Leitura",
  grammar: "Gramática",
  listening: "Escuta",
  speaking: "Fala",
  writing: "Escrita",
};

// Habilidade → formato de aula da tela inicial que mais a treina.
const SKILL_TO_FORMAT: Record<string, string> = {
  reading: "reading",
  grammar: "writing_grammar",
  writing: "writing_grammar",
  listening: "listening_speaking",
  speaking: "listening_speaking",
};

// A tabela difficulties guarda a habilidade em português.
const DIFFICULTY_SKILL_TO_FORMAT: Record<string, string> = {
  Leitura: "reading",
  Escrita: "writing_grammar",
  Escuta: "listening_speaking",
  Fala: "listening_speaking",
};

type Difficulty = { session_id: string; skill: string; area: string };

// Agrupa os erros das últimas aulas por área. A IA escreve a mesma área com
// grafias diferentes ("Ortografia" / "ortografia"), daí a normalização.
function topDifficulties(list: Difficulty[], sessionIds: string[], limit = 3) {
  const recent = new Set(sessionIds);
  const groups = new Map<string, { area: string; skill: string; count: number }>();
  for (const d of list) {
    if (!recent.has(d.session_id) || !d.area) continue;
    const area = d.area.trim().replace(/\s+/g, " ");
    const k = `${d.skill}|${area.toLocaleLowerCase("pt-BR")}`;
    const g = groups.get(k);
    if (g) g.count++;
    else groups.set(k, { area: area.charAt(0).toLocaleUpperCase("pt-BR") + area.slice(1), skill: d.skill, count: 1 });
  }
  return Array.from(groups.values()).sort((a, b) => b.count - a.count).slice(0, limit);
}

const RANGES = [
  { key: "7", label: "7 dias", days: 7 },
  { key: "30", label: "30 dias", days: 30 },
  { key: "all", label: "Tudo", days: 0 },
];

const PAGE_SIZE = 10;
const CONTACT_WHATSAPP = "https://wa.me/c/5515974065619";
const CONTACT_INSTAGRAM = "https://www.instagram.com/missgasparandrea/";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function num(v: number, digits = 1) {
  return v.toFixed(digits).replace(".", ",");
}

function mean(values: number[]) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function startOfWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

// Reduz e recorta a foto no navegador (quadrado, 384px, JPEG): a foto de
// celular chega a vários MB e o servidor só aceita arquivos pequenos.
async function fotoParaJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("imagem ilegível"));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const out = 384;
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas indisponível");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, out, out);
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, out, out);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("conversão falhou");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Frase única sobre o momento do aluno: por habilidade, compara as 3 últimas
// aulas que a treinaram com as 3 anteriores.
function buildInsight(points: LessonPoint[]): string {
  if (points.length < 2) return "Complete mais aulas para ver aqui como você está evoluindo.";

  const deltas: { key: string; delta: number }[] = [];
  for (const key of Object.keys(SKILL_LABELS)) {
    const t = skillTrend(skillValues(points, key).map((v) => v.value));
    if (t !== null) deltas.push({ key, delta: t });
  }
  if (deltas.length === 0) return "Continue assim: com mais algumas aulas de cada habilidade você começa a ver sua evolução.";

  const best = deltas.reduce((a, b) => (b.delta > a.delta ? b : a));
  if (best.delta >= 0.3) {
    return `Sua ${SKILL_LABELS[best.key].toLowerCase()} subiu ${num(best.delta)} ${best.delta >= 1.05 ? "pontos" : "ponto"} nas últimas aulas. Bom trabalho!`;
  }
  const overall = mean(deltas.map((d) => d.delta));
  if (overall <= -0.3) {
    return "Suas notas deram uma descansada nas últimas aulas. Que tal uma aula leve hoje para retomar o ritmo?";
  }
  return "Suas notas estão estáveis. Constância é o que constrói fluência.";
}

const iconProps = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const IconChart = () => (
  <svg {...iconProps}><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></svg>
);
const IconList = () => (
  <svg {...iconProps}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></svg>
);
const IconTrophy = () => (
  <svg {...iconProps}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" /></svg>
);
const IconCamera = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
);

type Tab = "evolucao" | "historico" | "conquistas";

export default function PerfilPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const fileRef = useRef<HTMLInputElement>(null);

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [tab, setTab] = useState<Tab>("evolucao");
  const [editing, setEditing] = useState(false);
  const [moreFields, setMoreFields] = useState(false);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [passwordExpiresAt, setPasswordExpiresAt] = useState<string | null>(null);

  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [nextAchievement, setNextAchievement] = useState<AchievementItem | null>(null);

  const [range, setRange] = useState("all");
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [openSession, setOpenSession] = useState<string | null>(null);

  const [gameBest, setGameBest] = useState<{ quiz?: number; guess?: number } | null>(null);
  const [weeklyGoal, setWeeklyGoal] = useState(3);
  const [soundOn, setSoundOn] = useState(true);

  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push("/login");
        return;
      }
      const ok = await checkAccessOrRedirect(supabase, data.user.id, router);
      if (!ok) return;
      setEmail(data.user.email || "");
      setCheckingAuth(false);
      await loadAll(data.user.id);
    });
  }, []);

  async function loadAll(userId: string) {
    setLoadingData(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, bio, location, website, avatar_url, is_admin")
      .eq("id", userId)
      .single();

    if (profile) {
      setName(profile.name || "");
      setBio(profile.bio || "");
      setLocation(profile.location || "");
      setWebsite(profile.website || "");
      setAvatarUrl(profile.avatar_url || "");
      setIsAdmin(!!profile.is_admin);
    }

    // Em select à parte: se a coluna weekly_goal ainda não existir (SQL não
    // rodado), só estes dois campos somem, o perfil carrega normalmente.
    const { data: extra } = await supabase
      .from("profiles")
      .select("weekly_goal, password_expires_at")
      .eq("id", userId)
      .single();
    if (extra) {
      if (typeof extra.weekly_goal === "number") setWeeklyGoal(extra.weekly_goal);
      setPasswordExpiresAt(extra.password_expires_at || null);
    }

    try {
      const gamRes = await fetch("/api/profile/gamification");
      if (gamRes.ok) {
        const gam = await gamRes.json();
        setCurrentStreak(gam.currentStreak || 0);
        setLongestStreak(gam.longestStreak || 0);
        setAchievements(gam.achievements || []);
        setNextAchievement(gam.nextAchievement || null);
      }
    } catch {
      // sequência e conquistas são um bônus visual — se falhar, o resto do perfil segue normal
    }

    try {
      const res = await fetch("/api/games/score");
      if (res.ok) {
        const g = await res.json();
        if (g.available) setGameBest(g.best || {});
      }
    } catch {
      // recordes dos games também são opcionais
    }

    const { data: sessionsData, error: sessionsErr } = await supabase
      .from("sessions")
      .select("id, created_at, level, topic_kind, topic_title, status")
      .order("created_at", { ascending: true });

    if (sessionsErr) console.error("Erro ao buscar sessões:", sessionsErr);

    const sessionIds = (sessionsData || []).map((s) => s.id);
    const reportsBySessionId: Record<string, any> = {};

    if (sessionIds.length > 0) {
      const { data: reportsData, error: reportsErr } = await supabase
        .from("reports")
        .select("session_id, summary, scores, created_at")
        .in("session_id", sessionIds);

      if (reportsErr) console.error("Erro ao buscar relatórios:", reportsErr);
      (reportsData || []).forEach((r: any) => {
        reportsBySessionId[r.session_id] = r;
      });

      const { data: diffData } = await supabase
        .from("difficulties")
        .select("session_id, skill, area")
        .in("session_id", sessionIds);
      setDifficulties((diffData as Difficulty[]) || []);
    }

    setSessions(
      (sessionsData || []).map((s: any) => ({
        ...s,
        reports: reportsBySessionId[s.id] ? [reportsBySessionId[s.id]] : [],
      }))
    );
    setLoadingData(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function saveProfile() {
    setSavingProfile(true);
    setSavedMsg("");
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { error } = await supabase
        .from("profiles")
        .update({ name, bio, location, website })
        .eq("id", data.user.id);
      if (error) {
        setSavedMsg("Não foi possível salvar agora. Tente de novo.");
      } else {
        setSavedMsg("Perfil salvo.");
        setTimeout(() => {
          setSavedMsg("");
          setEditing(false);
        }, 1500);
      }
    }
    setSavingProfile(false);
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarBusy(true);
    setAvatarMsg("");
    try {
      const jpeg = await fotoParaJpeg(file);
      const form = new FormData();
      form.append("file", jpeg, "avatar.jpg");
      const res = await fetch("/api/profile/avatar", { method: "POST", body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Não foi possível enviar a foto.");
      setAvatarUrl(body.url);
    } catch (err: any) {
      setAvatarMsg(err?.message === "imagem ilegível" ? "Não consegui abrir essa imagem. Tente outra foto." : err?.message || "Não foi possível enviar a foto.");
    }
    setAvatarBusy(false);
  }

  async function saveGoal(goal: number) {
    setWeeklyGoal(goal);
    const { data } = await supabase.auth.getUser();
    if (data.user) await supabase.from("profiles").update({ weekly_goal: goal }).eq("id", data.user.id);
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  }

  async function changePassword() {
    const pend = mensagemDePendencias(pw);
    if (pend) return setPwMsg({ ok: false, text: pend });
    if (pw !== pw2) return setPwMsg({ ok: false, text: "As duas senhas não são iguais." });
    setPwBusy(true);
    setPwMsg(null);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setPwBusy(false);
    if (error) {
      setPwMsg({ ok: false, text: "Não foi possível trocar a senha agora. Se o problema continuar, saia e entre de novo." });
      return;
    }
    setPw("");
    setPw2("");
    setPwMsg({ ok: true, text: "Senha alterada." });
  }

  if (checkingAuth) return null;

  const completed = sessions.filter((s) => s.reports && s.reports.length > 0);
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  const lastScores = completed.length > 0 ? completed[completed.length - 1].reports?.[0]?.scores : null;

  const allPoints = completed.map((s) => {
    const scores = s.reports?.[0]?.scores || {};
    const pick = (k: string) => (typeof scores[k] === "number" ? (scores[k] as number) : undefined);
    return {
      ts: new Date(s.created_at).getTime(),
      scores,
      date: formatDate(s.created_at),
      reading: pick("reading"),
      grammar: pick("grammar"),
      listening: pick("listening"),
      speaking: pick("speaking"),
      writing: pick("writing"),
      overall: pick("overall"),
    };
  });

  const rangeDays = RANGES.find((r) => r.key === range)?.days || 0;
  const cutoff = rangeDays ? Date.now() - rangeDays * 86400000 : 0;
  const chartPoints = allPoints.filter((p) => p.ts >= cutoff);

  const insight = buildInsight(allPoints);

  // Ponto forte e a trabalhar: média das últimas 5 aulas de cada habilidade.
  const skillAvgs = Object.keys(SKILL_LABELS)
    .map((key) => {
      const vals = skillValues(allPoints, key).slice(-5).map((v) => v.value);
      return vals.length ? { key, avg: mean(vals) } : null;
    })
    .filter((x): x is { key: string; avg: number } => !!x)
    .sort((a, b) => b.avg - a.avg);
  const strongest = skillAvgs.length >= 2 ? skillAvgs[0] : null;
  const weakest = skillAvgs.length >= 2 ? skillAvgs[skillAvgs.length - 1] : null;

  const detailPoints = selectedSkill
    ? skillValues(chartPoints, selectedSkill).map((v) => ({ date: v.date, [selectedSkill]: v.value }))
    : [];
  const topErrors = topDifficulties(difficulties, completed.slice(-10).map((s) => s.id));

  const weekStart = startOfWeek();
  const doneThisWeek = completed.filter((s) => new Date(s.created_at).getTime() >= weekStart).length;
  const history = [...sessions].reverse();

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div style={{ minHeight: "100vh", padding: "24px 16px 100px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", color: "var(--ink-on-dark)" }}>
        <div style={{ marginBottom: 18 }}>
          <Lockup size={18} />
          <h1 style={{ margin: "14px 0 0", fontFamily: "'Poppins', sans-serif", fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Perfil
          </h1>
        </div>

        {/* Avatar + números */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={avatarBusy}
            aria-label="Trocar foto de perfil"
            style={{ position: "relative", width: 76, height: 76, flexShrink: 0, padding: 0, border: "none", background: "none", cursor: "pointer" }}
          >
            <span
              style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                background: avatarUrl ? `url(${avatarUrl}) center/cover no-repeat` : "#f5efe0",
                border: "1px solid var(--line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Poppins', sans-serif",
                fontSize: 26,
                fontWeight: 600,
                color: "var(--muted)",
                opacity: avatarBusy ? 0.5 : 1,
              }}
            >
              {!avatarUrl && initial}
            </span>
            <span
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "var(--teal)",
                color: "#fff",
                border: "2px solid var(--paper)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconCamera />
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPickAvatar} style={{ display: "none" }} />
          <div style={{ display: "flex", flex: 1, justifyContent: "space-around", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{completed.length}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted-on-dark)" }}>Aulas</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--teal)" }}>
                {typeof lastScores?.overall === "number" ? num(lastScores.overall) : "—"}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--muted-on-dark)" }}>última nota</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{sessions[sessions.length - 1]?.level || "—"}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted-on-dark)" }}>nível</div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{currentStreak}</div>
              <div style={{ fontSize: 10.5, color: "var(--muted-on-dark)" }}>dias seguidos</div>
            </div>
          </div>
        </div>
        {(avatarBusy || avatarMsg) && (
          <div style={{ fontSize: 12, color: avatarMsg ? "var(--coral)" : "var(--muted-on-dark)", marginBottom: 10 }}>
            {avatarBusy ? "Enviando foto…" : avatarMsg}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          {name && <div style={{ fontSize: 14.5, fontWeight: 600 }}>{name}</div>}
          {bio && <div style={{ fontSize: 13, marginTop: 3, lineHeight: 1.5 }}>{bio}</div>}
          {location && <div style={{ fontSize: 12, color: "var(--muted-on-dark)", marginTop: 3 }}>{location}</div>}
          {website && (
            <a
              href={website.startsWith("http") ? website : `https://${website}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: "var(--teal)", marginTop: 3, display: "block" }}
            >
              {website}
            </a>
          )}
          {!name && !bio && !location && !website && (
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: "var(--mustard-bright)" }}>
              Nada por aqui ainda. Preencher o perfil é opcional.
            </div>
          )}
        </div>

        <Button
          variant="subtle"
          onClick={() => setEditing((v) => !v)}
          style={{ width: "100%", padding: "9px 0", marginBottom: 20 }}
        >
          {editing ? "Fechar edição" : "Editar perfil"}
        </Button>

        {editing && (
          <Card style={{ marginBottom: 20 }}>
            <SectionHeading>Meu perfil</SectionHeading>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
              Toque na sua foto lá em cima para trocá-la. Nada aqui é obrigatório.
            </div>
            <input placeholder="Nome de exibição" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            <button
              type="button"
              onClick={() => setMoreFields((v) => !v)}
              style={{ background: "none", border: "none", padding: 0, marginTop: 10, fontSize: 12.5, color: "var(--muted)", cursor: "pointer", textDecoration: "underline" }}
            >
              {moreFields ? "Menos opções" : "Mais opções (bio, localização, site)"}
            </button>
            {moreFields && (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                <input placeholder="Localização (ex: São Paulo, BR)" value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle} />
                <input placeholder="Site ou rede social (URL)" value={website} onChange={(e) => setWebsite(e.target.value)} style={inputStyle} />
                <textarea
                  placeholder="Bio curta: conte um pouco sobre por que está aprendendo inglês"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
              <Button onClick={saveProfile} disabled={savingProfile} style={{ padding: "9px 18px" }}>
                {savingProfile ? "Salvando…" : "Salvar perfil"}
              </Button>
              {savedMsg && (
                <span style={{ fontSize: 12.5, color: savedMsg === "Perfil salvo." ? "var(--sage)" : "var(--coral)", fontWeight: 600 }}>
                  {savedMsg}
                </span>
              )}
            </div>
          </Card>
        )}

        {/* Meta da semana */}
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <SectionHeading>Meta da semana</SectionHeading>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              {Math.min(doneThisWeek, weeklyGoal)}/{weeklyGoal} {weeklyGoal === 1 ? "aula" : "aulas"}
            </div>
          </div>
          <ProgressBar value={Math.min(doneThisWeek, weeklyGoal)} max={weeklyGoal} />
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 8 }}>
            {doneThisWeek >= weeklyGoal
              ? "Meta da semana batida. Parabéns!"
              : `Faltam ${weeklyGoal - doneThisWeek} ${weeklyGoal - doneThisWeek === 1 ? "aula" : "aulas"} para fechar a semana.`}
          </div>
        </Card>

        {/* Insight + ponto forte / a trabalhar */}
        <Card style={{ marginBottom: 14 }}>
          <SectionHeading>Seu momento</SectionHeading>
          <div style={{ fontSize: 14, lineHeight: 1.5 }}>{insight}</div>
          {strongest && weakest && strongest.key !== weakest.key && (
            <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "9px 12px", border: "1px solid var(--line)", background: "#fbf8f1", borderRadius: 3 }}>
                <span>Ponto forte: <strong>{SKILL_LABELS[strongest.key]}</strong></span>
                <span style={{ color: "var(--sage)", fontWeight: 700 }}>{num(strongest.avg)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 13, padding: "9px 12px", border: "1px solid var(--line)", background: "#fbf8f1", borderRadius: 3 }}>
                <span>Para trabalhar: <strong>{SKILL_LABELS[weakest.key]}</strong> <span style={{ color: "var(--coral)", fontWeight: 700 }}>{num(weakest.avg)}</span></span>
                <Button
                  variant="subtle"
                  onClick={() => router.push(`/?format=${SKILL_TO_FORMAT[weakest.key]}`)}
                  style={{ padding: "6px 12px", fontSize: 12.5, flexShrink: 0 }}
                >
                  Treinar {SKILL_LABELS[weakest.key].toLowerCase()}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Games */}
        {gameBest && (
          <Card style={{ marginBottom: 20 }}>
            <SectionHeading>Seus recordes</SectionHeading>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {[
                { label: "Quiz", value: gameBest.quiz, max: 80 },
                { label: "Quem é?", value: gameBest.guess, max: 100 },
              ].map((g) => (
                <div key={g.label} style={{ flex: 1, padding: 12, border: "1px solid var(--line)", background: "#fbf8f1", borderRadius: 3 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{g.label}</div>
                  <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 20, fontWeight: 600, marginTop: 2 }}>
                    {typeof g.value === "number" ? `${g.value}/${g.max}` : "—"}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="subtle" onClick={() => router.push("/games")} style={{ width: "100%", padding: "9px 0", marginTop: 10 }}>
              Jogar agora
            </Button>
          </Card>
        )}

        {/* Abas */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--line-on-dark)", marginBottom: 18 }}>
          {([
            { key: "evolucao", label: "Evolução", icon: <IconChart /> },
            { key: "historico", label: "Histórico", icon: <IconList /> },
            { key: "conquistas", label: "Conquistas", icon: <IconTrophy /> },
          ] as { key: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "10px 0",
                fontSize: 13,
                fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? "var(--ink-on-dark)" : "var(--muted-on-dark)",
                borderBottom: tab === t.key ? "2px solid var(--teal)" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === "evolucao" && (
          <>
            <Card style={{ marginBottom: 14 }}>
              <SectionHeading>Evolução por habilidade</SectionHeading>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {RANGES.map((r) => (
                  <Chip key={r.key} active={range === r.key} onClick={() => setRange(r.key)}>{r.label}</Chip>
                ))}
              </div>
              {loadingData ? (
                <div style={{ fontSize: 13, color: "var(--muted)", padding: "20px 0" }}>Carregando…</div>
              ) : chartPoints.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--muted)", padding: "10px 0" }}>Nenhuma aula concluída neste período.</div>
              ) : (
                <>
                  <SkillCards points={chartPoints} selected={selectedSkill} onSelect={setSelectedSkill} />
                  {selectedSkill && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>{SKILL_LABELS[selectedSkill]} aula a aula</div>
                      <EvolutionChart points={detailPoints} only={selectedSkill} />
                    </div>
                  )}
                </>
              )}
            </Card>

            {topErrors.length > 0 && (
              <Card style={{ marginBottom: 20 }}>
                <SectionHeading>Seus tropeços mais comuns</SectionHeading>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Nas suas últimas 10 aulas</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {topErrors.map((e, i) => (
                    <div
                      key={e.skill + e.area}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", border: "1px solid var(--line)", background: "#fbf8f1", borderRadius: 3 }}
                    >
                      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 16, fontWeight: 600, color: "var(--muted)", width: 16 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{e.area}</div>
                        <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                          {e.skill} · {e.count} {e.count === 1 ? "vez" : "vezes"}
                        </div>
                      </div>
                      {DIFFICULTY_SKILL_TO_FORMAT[e.skill] && (
                        <Button
                          variant="subtle"
                          onClick={() => router.push(`/?format=${DIFFICULTY_SKILL_TO_FORMAT[e.skill]}`)}
                          style={{ padding: "6px 12px", fontSize: 12.5, flexShrink: 0 }}
                        >
                          Treinar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {tab === "historico" && (
          <Card style={{ marginBottom: 20 }}>
            <SectionHeading>Histórico de aulas</SectionHeading>
            {loadingData ? (
              <div style={{ fontSize: 13, color: "var(--muted)", padding: "10px 0" }}>Carregando…</div>
            ) : history.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)", padding: "10px 0" }}>Você ainda não completou nenhuma aula.</div>
            ) : (
              <div>
                {history.slice(0, visibleCount).map((s) => {
                  const report = s.reports?.[0];
                  const scores = report?.scores;
                  const open = openSession === s.id;
                  return (
                    <div key={s.id} style={{ borderTop: "1px solid var(--line)" }}>
                      <button
                        type="button"
                        onClick={() => setOpenSession(open ? null : s.id)}
                        aria-expanded={open}
                        style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "12px 0", color: "inherit", font: "inherit" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{s.topic_title}</div>
                            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
                              {formatDate(s.created_at)} · nível {s.level} · {s.status === "completed" ? "concluída" : "em andamento"}
                            </div>
                          </div>
                          {typeof scores?.overall === "number" && (
                            <div style={{ textAlign: "center", flexShrink: 0 }}>
                              <div style={{ fontSize: 17, fontWeight: 700, color: "var(--teal)" }}>{num(scores.overall)}</div>
                              <div style={{ fontSize: 9.5, color: "var(--muted)" }}>geral</div>
                            </div>
                          )}
                        </div>
                      </button>
                      {open && (
                        <div style={{ paddingBottom: 12 }}>
                          {scores && (
                            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                              {Object.entries(SKILL_LABELS).map(([key, label]) => {
                                const v = scores[key];
                                if (typeof v !== "number") return null;
                                return (
                                  <div key={key} style={{ fontSize: 11.5, color: "var(--muted)" }}>
                                    {label}: <strong style={{ color: "var(--ink)" }}>{num(v)}</strong>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {report?.summary ? (
                            <div style={{ fontSize: 12.5, color: "#4a4636", marginTop: 8, lineHeight: 1.5 }}>{report.summary}</div>
                          ) : (
                            <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>Esta aula ainda não tem relatório.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {history.length > visibleCount && (
                  <Button variant="subtle" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)} style={{ width: "100%", padding: "9px 0", marginTop: 8 }}>
                    Ver mais
                  </Button>
                )}
              </div>
            )}
          </Card>
        )}

        {tab === "conquistas" && (
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <SectionHeading>Conquistas</SectionHeading>
              <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                {unlockedCount}/{achievements.length}
              </div>
            </div>
            {longestStreak > 0 && (
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                Recorde pessoal: {longestStreak} {longestStreak === 1 ? "dia" : "dias"} seguidos
              </div>
            )}
            {achievements.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--muted)", padding: "10px 0" }}>Suas conquistas vão aparecer aqui.</div>
            ) : (
              <div>
                {achievements.map((a) => (
                  <div key={a.code} style={{ display: "flex", gap: 12, alignItems: "center", borderTop: "1px solid var(--line)", padding: "12px 0", opacity: a.unlocked ? 1 : 0.65 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        flexShrink: 0,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        background: a.unlocked ? "linear-gradient(155deg, #ffe3a8, var(--teal))" : "#eee9dc",
                        filter: a.unlocked ? "none" : "grayscale(1)",
                      }}
                    >
                      {a.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 1 }}>{a.description}</div>
                      {!a.unlocked && a.progress && (
                        <div style={{ marginTop: 6 }}>
                          <ProgressBar value={a.progress.current} max={a.progress.target} />
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                            {a.progress.current}/{a.progress.target}
                          </div>
                        </div>
                      )}
                      {a.unlocked && a.unlockedAt && (
                        <div style={{ fontSize: 11, color: "var(--sage)", marginTop: 3 }}>Conquistada em {formatDate(a.unlockedAt)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {nextAchievement && !nextAchievement.unlocked && achievements.length === 0 && (
              <AchievementStrip achievements={[]} nextAchievement={nextAchievement} onDark={false} />
            )}
          </Card>
        )}

        {/* Preferências */}
        <Card style={{ marginBottom: 14 }}>
          <SectionHeading>Preferências</SectionHeading>
          <div style={{ fontSize: 13, marginBottom: 8 }}>Meta de aulas por semana</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Chip key={n} active={weeklyGoal === n} onClick={() => saveGoal(n)}>{n}</Chip>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 13 }}>Sons do app</div>
            <Chip active={soundOn} onClick={toggleSound}>{soundOn ? "Ligados" : "Desligados"}</Chip>
          </div>
        </Card>

        {/* Conta */}
        <Card style={{ marginBottom: 14 }}>
          <SectionHeading>Conta</SectionHeading>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>E-mail</div>
          <div style={{ fontSize: 14, marginBottom: 8, wordBreak: "break-all" }}>{email || "—"}</div>
          {passwordExpiresAt && (
            <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 8 }}>
              Senha válida até {new Date(passwordExpiresAt).toLocaleDateString("pt-BR")}
            </div>
          )}
          <button
            type="button"
            onClick={() => setPwOpen((v) => !v)}
            style={{ background: "none", border: "none", padding: 0, fontSize: 13, color: "var(--ink)", cursor: "pointer", textDecoration: "underline" }}
          >
            {pwOpen ? "Fechar" : "Alterar senha"}
          </button>
          {pwOpen && (
            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <input type="password" placeholder="Nova senha" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} style={inputStyle} />
              <input type="password" placeholder="Repita a nova senha" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={inputStyle} />
              <div style={{ display: "grid", gap: 3 }}>
                {PASSWORD_RULES.map((r) => (
                  <div key={r.label} style={{ fontSize: 12, color: r.test(pw) ? "var(--sage)" : "var(--muted)" }}>
                    {r.test(pw) ? "✓" : "•"} {r.label}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Button onClick={changePassword} disabled={pwBusy || !pw} style={{ padding: "9px 18px" }}>
                  {pwBusy ? "Salvando…" : "Salvar senha"}
                </Button>
                {pwMsg && <span style={{ fontSize: 12.5, color: pwMsg.ok ? "var(--sage)" : "var(--coral)", fontWeight: 600 }}>{pwMsg.text}</span>}
              </div>
            </div>
          )}
        </Card>

        {/* Ajuda */}
        <Card>
          <SectionHeading>Ajuda e contato</SectionHeading>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
            <a href={CONTACT_WHATSAPP} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)" }}>
              Fale com a gente no WhatsApp
            </a>
            <a href={CONTACT_INSTAGRAM} target="_blank" rel="noopener noreferrer" style={{ color: "var(--ink)" }}>
              Siga @missgasparandrea
            </a>
          </div>
        </Card>
      </div>
      <BottomNav onSignOut={signOut} isAdmin={isAdmin} />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "5px 12px",
        fontSize: 12.5,
        fontWeight: active ? 700 : 500,
        borderRadius: 999,
        cursor: "pointer",
        border: active ? "1px solid var(--teal)" : "1px solid var(--line)",
        background: active ? "var(--teal)" : "#fbf8f1",
        color: active ? "#fff" : "var(--ink)",
      }}
    >
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--line)",
  borderRadius: 3,
  padding: "9px 12px",
  fontSize: 14.5,
  background: "#fbf8f1",
};
