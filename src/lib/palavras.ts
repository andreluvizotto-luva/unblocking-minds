import { VALID_WORDS, COMMON_WORDS } from "@/lib/palavras-dicionario";
import { WORDS_LETTERS, WORDS_VOWELS, WORDS_MIN_COMMON } from "@/lib/games";

// Letras sorteadas com peso parecido ao da frequência no inglês, para as
// rodadas terem palavras de verdade. Y conta como consoante.
const VOGAIS: Record<string, number> = { a: 8, e: 12, i: 7, o: 7, u: 3 };
const CONSOANTES: Record<string, number> = {
  b: 2, c: 4, d: 4, f: 2, g: 3, h: 4, j: 0.5, k: 1, l: 6, m: 3, n: 7, p: 3, q: 0.2, r: 7, s: 7, t: 9, v: 1, w: 2, x: 0.3, y: 2, z: 0.3,
};

const validas = VALID_WORDS.split(" ");
const comuns = COMMON_WORDS.split(" ");

function sortear(pesos: Record<string, number>, excluir: string[]): string {
  const itens = Object.entries(pesos).filter(([l]) => excluir.indexOf(l) < 0);
  let r = Math.random() * itens.reduce((a, [, p]) => a + p, 0);
  for (const [l, p] of itens) {
    r -= p;
    if (r <= 0) return l;
  }
  return itens[itens.length - 1][0];
}

// No máximo duas cópias da mesma letra, para a mão não ficar repetitiva.
function sortearLetras(): string[] {
  const letras: string[] = [];
  const usadas = (l: string) => letras.filter((x) => x === l).length;
  const bloqueadas = () => Array.from(new Set(letras)).filter((l) => usadas(l) >= 2);
  for (let i = 0; i < WORDS_VOWELS; i++) letras.push(sortear(VOGAIS, bloqueadas()));
  for (let i = 0; i < WORDS_LETTERS - WORDS_VOWELS; i++) letras.push(sortear(CONSOANTES, bloqueadas()));
  return letras;
}

function formavel(palavra: string, contagem: Record<string, number>): boolean {
  const usadas: Record<string, number> = {};
  for (const c of palavra) {
    usadas[c] = (usadas[c] || 0) + 1;
    if (usadas[c] > (contagem[c] || 0)) return false;
  }
  return true;
}

function contar(letras: string[]) {
  const c: Record<string, number> = {};
  for (const l of letras) c[l] = (c[l] || 0) + 1;
  return c;
}

// A rodada só vale se der para formar pelo menos WORDS_MIN_COMMON palavras
// comuns — a regra é checada nas comuns, não no dicionário inteiro, para o
// mínimo não depender de palavras que ninguém conhece. Quem joga pode usar
// qualquer palavra válida do dicionário.
export function montarRodada() {
  for (let tentativa = 0; tentativa < 500; tentativa++) {
    const letras = sortearLetras();
    const contagem = contar(letras);
    const comunsPossiveis = comuns.filter((w) => formavel(w, contagem));
    if (comunsPossiveis.length < WORDS_MIN_COMMON) continue;
    const todas = validas.filter((w) => formavel(w, contagem)).sort((a, b) => b.length - a.length || a.localeCompare(b));
    return { letters: letras, words: todas, common: comunsPossiveis };
  }
  return null;
}
