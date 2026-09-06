// Citações reais e verificáveis (com autor) para o topo da tela inicial —
// pensadas para reforçar, num tom motivador, a ideia de prática diária e
// coragem de se comunicar em outro idioma. Uma por dia, sempre a mesma
// para todo mundo (troca à meia-noite), pra parecer uma curadoria e não
// um sorteio aleatório a cada visita.
export type Quote = { text: string; author: string; context?: string };

export const QUOTES: Quote[] = [
  { text: "If you talk to a man in a language he understands, that goes to his head. If you talk to him in his language, that goes to his heart.", author: "Nelson Mandela" },
  { text: "One language sets you in a corridor for life. Two languages open every door along the way.", author: "Frank Smith", context: "linguista" },
  { text: "Language is the road map of a culture. It tells you where its people come from and where they are going.", author: "Rita Mae Brown", context: "escritora" },
  { text: "The limits of my language mean the limits of my world.", author: "Ludwig Wittgenstein", context: "filósofo" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "You are never too old to set another goal or to dream a new dream.", author: "C. S. Lewis" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Do the best you can until you know better. Then when you know better, do better.", author: "Maya Angelou" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confúcio" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "What we learn with pleasure we never forget.", author: "Alfred Mercier", context: "escritor" },
  { text: "A different language is a different vision of life.", author: "Federico Fellini", context: "cineasta" },
  { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes", context: "atriz" },
  { text: "Small daily improvements are the key to staggering long-term results.", author: "Confúcio" },
  { text: "Courage is the first of human qualities because it guarantees the others.", author: "Winston Churchill" },
  { text: "Practice isn't the thing you do once you're good. It's the thing you do that makes you good.", author: "Malcolm Gladwell", context: "escritor" },
  { text: "Fall seven times, stand up eight.", author: "Provérbio japonês" },
];

function todayISODate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// Índice determinístico a partir da data — mesma citação o dia inteiro,
// pra todo mundo, sem precisar guardar nada no banco.
export function getQuoteOfDay(d: Date = new Date()): Quote {
  const iso = todayISODate(d);
  let hash = 0;
  for (let i = 0; i < iso.length; i++) {
    hash = (hash * 31 + iso.charCodeAt(i)) >>> 0;
  }
  return QUOTES[hash % QUOTES.length];
}
