// Regras de pontuação dos Games num lugar só: as telas usam para mostrar os
// pontos, e a rota que salva a pontuação usa para limitar o placar ao
// máximo possível — o mesmo motivo de password-rules.ts existir (regra
// duplicada entre cliente e servidor já divergiu antes neste projeto).

export const QUIZ_QUESTIONS = 8;
export const QUIZ_POINTS_PER_QUESTION = 10;
export const QUIZ_MAX_SCORE = QUIZ_QUESTIONS * QUIZ_POINTS_PER_QUESTION;

// "Quem é?": começa valendo o máximo, e cada dica extra pedida tira pontos.
// A primeira dica é de graça; acertar só com ela vale os 100.
export const GUESS_CLUES = 5;
export const GUESS_MAX_SCORE = 100;
export const GUESS_COST_PER_CLUE = 20;

export function guessPointsFor(cluesShown: number): number {
  return Math.max(0, GUESS_MAX_SCORE - GUESS_COST_PER_CLUE * Math.max(0, cluesShown - 1));
}

export const GAME_MAX_SCORE: Record<string, number> = {
  quiz: QUIZ_MAX_SCORE,
  guess: GUESS_MAX_SCORE,
};

// Normalização de nomes do "Quem é?", usada nos dois lados: no servidor,
// para achar dica que entrega o nome; no navegador, para conferir o
// palpite. Ignora maiúsculas, acentos e pontuação. Letras como "ł" e "ø"
// não perdem o acento no NFD (são letras próprias, não letra + acento),
// por isso a troca explícita — sem ela, "Skłodowska" nunca casaria com
// "Sklodowska".
const LETRAS_ESPECIAIS: Record<string, string> = { ł: "l", đ: "d", ø: "o", ß: "ss", æ: "ae", œ: "oe", ı: "i" };

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[łđøßæœı]/g, (c) => LETRAS_ESPECIAIS[c] || c)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Partes do nome que, se aparecerem numa dica, entregam a resposta: cada
// palavra com 4 letras ou mais do nome e dos apelidos ("marie", "curie").
// Palavras curtas ficam de fora para não barrar dicas por coincidência
// ("da", "van").
export function nameParts(name: string, aliases: string[]): string[] {
  const parts = new Set<string>();
  for (const n of [name, ...aliases]) {
    for (const w of normalizeName(n).split(" ")) {
      if (w.length >= 4) parts.add(w);
    }
  }
  return Array.from(parts);
}

export function clueRevealsName(clue: string, parts: string[]): boolean {
  const words = new Set(normalizeName(clue).split(" "));
  return parts.some((p) => words.has(p));
}
