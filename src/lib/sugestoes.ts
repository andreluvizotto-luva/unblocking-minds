// Catálogo curado de sugestões de conteúdo em inglês. Todos os links foram
// conferidos (TED: página responde 200; YouTube: oEmbed devolve o título).
// `min`/`max` são índices de nível CEFR (0 = A1 ... 5 = C2).

export const LEVEL_INDEX: Record<string, number> = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

export type Sugestao = { title: string; by: string; url: string; min: number; max: number };

export const TED_TALKS: Sugestao[] = [
  { title: "Try something new for 30 days", by: "Matt Cutts", url: "https://www.ted.com/talks/matt_cutts_try_something_new_for_30_days", min: 0, max: 3 },
  { title: "10 ways to have a better conversation", by: "Celeste Headlee", url: "https://www.ted.com/talks/celeste_headlee_10_ways_to_have_a_better_conversation", min: 1, max: 4 },
  { title: "The happy secret to better work", by: "Shawn Achor", url: "https://www.ted.com/talks/shawn_achor_the_happy_secret_to_better_work", min: 2, max: 4 },
  { title: "Inside the mind of a master procrastinator", by: "Tim Urban", url: "https://www.ted.com/talks/tim_urban_inside_the_mind_of_a_master_procrastinator", min: 2, max: 5 },
  { title: "Your body language may shape who you are", by: "Amy Cuddy", url: "https://www.ted.com/talks/amy_cuddy_your_body_language_may_shape_who_you_are", min: 2, max: 5 },
  { title: "How to speak so that people want to listen", by: "Julian Treasure", url: "https://www.ted.com/talks/julian_treasure_how_to_speak_so_that_people_want_to_listen", min: 2, max: 5 },
  { title: "The power of introverts", by: "Susan Cain", url: "https://www.ted.com/talks/susan_cain_the_power_of_introverts", min: 3, max: 5 },
  { title: "How great leaders inspire action", by: "Simon Sinek", url: "https://www.ted.com/talks/simon_sinek_how_great_leaders_inspire_action", min: 3, max: 5 },
  { title: "Grit: the power of passion and perseverance", by: "Angela Lee Duckworth", url: "https://www.ted.com/talks/angela_lee_duckworth_grit_the_power_of_passion_and_perseverance", min: 3, max: 5 },
  { title: "The power of vulnerability", by: "Brené Brown", url: "https://www.ted.com/talks/brene_brown_the_power_of_vulnerability", min: 4, max: 5 },
  { title: "Do schools kill creativity?", by: "Sir Ken Robinson", url: "https://www.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity", min: 4, max: 5 },
  { title: "The danger of a single story", by: "Chimamanda Ngozi Adichie", url: "https://www.ted.com/talks/chimamanda_ngozi_adichie_the_danger_of_a_single_story", min: 4, max: 5 },
];

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export const SONGS: Sugestao[] = [
  { title: "Count on Me", by: "Bruno Mars", url: yt("6k8cpUkKK4c"), min: 0, max: 2 },
  { title: "Stand by Me", by: "Ben E. King", url: yt("hwZNL7QVJjE"), min: 0, max: 2 },
  { title: "Let It Be", by: "The Beatles", url: yt("QDYfEBY9NM4"), min: 0, max: 3 },
  { title: "Yesterday", by: "The Beatles", url: yt("NrgmdOz227I"), min: 0, max: 3 },
  { title: "Happy", by: "Pharrell Williams", url: yt("ZbZSe6N_BXs"), min: 0, max: 3 },
  { title: "Take Me Home, Country Roads", by: "John Denver", url: yt("1vrEljMfXYo"), min: 1, max: 3 },
  { title: "Hey Jude", by: "The Beatles", url: yt("A_MjCqQoLLA"), min: 1, max: 4 },
  { title: "Perfect", by: "Ed Sheeran", url: yt("2Vv-BfVoq4g"), min: 1, max: 4 },
  { title: "A Thousand Years", by: "Christina Perri", url: yt("rtOvBOTyX00"), min: 1, max: 4 },
  { title: "Thinking Out Loud", by: "Ed Sheeran", url: yt("lp-EO5I60KA"), min: 2, max: 5 },
  { title: "Let Her Go", by: "Passenger", url: yt("RBumgq5yVrA"), min: 2, max: 5 },
  { title: "Someone Like You", by: "Adele", url: yt("hLQl3WQQoQ0"), min: 2, max: 5 },
  { title: "Shape of You", by: "Ed Sheeran", url: yt("JGwWNGJdvx8"), min: 2, max: 5 },
  { title: "Counting Stars", by: "OneRepublic", url: yt("hT_nvWreIhg"), min: 3, max: 5 },
  { title: "Yellow", by: "Coldplay", url: yt("yKNxeF4KMsY"), min: 3, max: 5 },
  { title: "Hello", by: "Adele", url: yt("YQHsXMglC9A"), min: 3, max: 5 },
  { title: "Imagine", by: "John Lennon", url: yt("YkgkThdzX-8"), min: 3, max: 5 },
  { title: "Viva La Vida", by: "Coldplay", url: yt("dvgZkm1xWPE"), min: 4, max: 5 },
  { title: "Don't Stop Believin'", by: "Journey", url: yt("1k8craCGpgs"), min: 4, max: 5 },
];

// Feeds RSS públicos e gratuitos. Níveis iniciais leem o VOA Learning English
// (inglês simplificado); níveis mais altos, seções leves de BBC e Guardian.
export const FEEDS_FACEIS = [
  { source: "VOA Learning English", url: "https://learningenglish.voanews.com/api/zkm-ql-vomx-tpej-rqi" },
  { source: "VOA Learning English", url: "https://learningenglish.voanews.com/api/zmg_pl-vomx-tpeymtm" },
  { source: "VOA Learning English", url: "https://learningenglish.voanews.com/api/zpyp_l-vomx-tpe_rym" },
  { source: "VOA Learning English", url: "https://learningenglish.voanews.com/api/zmmpql-vomx-tpey-_q" },
];

export const FEEDS_AVANCADOS = [
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml" },
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/technology/rss.xml" },
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/health/rss.xml" },
  { source: "BBC News", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml" },
  { source: "The Guardian", url: "https://www.theguardian.com/science/rss" },
  { source: "The Guardian", url: "https://www.theguardian.com/technology/rss" },
  { source: "The Guardian", url: "https://www.theguardian.com/culture/rss" },
];

export function elegiveis(lista: Sugestao[], nivel: number) {
  const ok = lista.filter((s) => nivel >= s.min && nivel <= s.max);
  return ok.length ? ok : lista;
}
