import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { requireActiveUser } from "@/lib/require-active-user";
import { LEVEL_INDEX, TED_TALKS, SONGS, FEEDS_FACEIS, FEEDS_AVANCADOS, elegiveis } from "@/lib/sugestoes";

// Sugestões de conteúdo em inglês: vídeo (TED) e música vêm do catálogo
// curado; a matéria vem de um feed RSS público, lido no servidor (cache de 1h)
// para o link sempre apontar para uma matéria real e recente.
type Materia = { title: string; url: string; source: string; summary: string };

const entidades = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");

// Alguns feeds (Guardian) entregam o HTML do resumo escapado; por isso as
// entidades são resolvidas antes de tirar as tags.
const decodificar = (s: string) =>
  entidades(entidades(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

async function lerFeed(url: string, source: string): Promise<Materia[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 }, headers: { "User-Agent": "Mozilla/5.0 (+maisunblocking.com.br)" } });
    if (!res.ok) return [];
    const xml = await res.text();
    const out: Materia[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const item = m[1];
      const title = decodificar(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
      const link = decodificar(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").replace(/\?at_medium=.*$/, "");
      const summary = decodificar(item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "");
      if (title && /^https:\/\//.test(link)) out.push({ title, url: link, source, summary: summary.slice(0, 160) });
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const supabase = supabaseServer();
  const check = await requireActiveUser(supabase);
  if (check.ok === false) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const params = new URL(req.url).searchParams;
  const nivel = LEVEL_INDEX[params.get("level") || ""] ?? 2;
  const n = Math.max(0, Math.min(1000, parseInt(params.get("n") || "0", 10) || 0));
  const dia = Math.floor(Date.now() / 86_400_000);
  const pick = <T,>(lista: T[], salto: number) => lista[(dia + n * salto) % lista.length];

  const video = pick(elegiveis(TED_TALKS, nivel), 1);
  const song = pick(elegiveis(SONGS, nivel), 1);

  const feeds = nivel <= 2 ? FEEDS_FACEIS : FEEDS_AVANCADOS;
  const feed = pick(feeds, 1);
  let materias = await lerFeed(feed.url, feed.source);
  if (!materias.length) {
    for (const f of feeds) {
      materias = await lerFeed(f.url, f.source);
      if (materias.length) break;
    }
  }
  const article = materias.length ? pick(materias, 3) : null;

  return NextResponse.json({ video, song, article });
}
