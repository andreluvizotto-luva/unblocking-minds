// Temas sazonais do app. A decisão é feita no NAVEGADOR, nunca no servidor: as
// páginas são pré-renderizadas estaticamente, então uma data lida no servidor
// ficaria congelada no dia do build.
//
// Cada tema liga e desliga sozinho pela data (fuso de São Paulo), sem novo
// deploy. Para testar fora da janela: abra qualquer tela com ?tema=<id> (liga)
// ou ?tema=normal (desliga).
export type TemaSazonal = "halloween" | "thanksgiving" | null;

type TemaConfig = {
  inicio: string; // "AAAA-MM-DD", inclusivo, a partir de 00:00
  volta: string; // "AAAA-MM-DD", exclusivo: neste dia o layout original volta
  // Assunto pré-preenchido pelo atalho da tela inicial. Usa o fluxo de tema
  // livre que já existe (até 140 caracteres), então a geração da aula não muda.
  assunto: string;
  saudacao: string;
  rotulo: string;
  titulo: string;
  descricao: string;
};

export const TEMAS: Record<Exclude<TemaSazonal, null>, TemaConfig> = {
  halloween: {
    inicio: "2026-10-30",
    volta: "2026-11-02",
    assunto: "Halloween: traditions, costumes and spooky stories",
    saudacao: "Happy Halloween",
    rotulo: "Halloween",
    titulo: "Aula especial de Halloween",
    descricao: "Tradições e histórias de arrepiar, no seu nível.",
  },
  // Thanksgiving 2026 cai na quinta, 26/11. Liga à meia-noite de 24/11 e
  // fica até domingo, 29/11.
  thanksgiving: {
    inicio: "2026-11-24",
    volta: "2026-11-30",
    assunto: "Thanksgiving: traditions, family dinner and gratitude",
    saudacao: "Happy Thanksgiving",
    rotulo: "Thanksgiving",
    titulo: "Aula especial de Thanksgiving",
    descricao: "Tradições, a ceia em família e o vocabulário da gratidão, no seu nível.",
  },
};

// "AAAA-MM-DD" no fuso de São Paulo. O formato en-CA já sai nesse padrão e
// permite comparar as datas como texto.
function dataEmSaoPaulo(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function temaDoDia(d: Date = new Date(), forcado?: string | null): TemaSazonal {
  if (forcado === "normal") return null;
  if (forcado && forcado in TEMAS) return forcado as TemaSazonal;
  const hoje = dataEmSaoPaulo(d);
  for (const [id, t] of Object.entries(TEMAS)) {
    if (hoje >= t.inicio && hoje < t.volta) return id as TemaSazonal;
  }
  return null;
}
