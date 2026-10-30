// Tema sazonal do app (hoje só Halloween). A decisão é feita no NAVEGADOR,
// nunca no servidor: as páginas são pré-renderizadas estaticamente, então uma
// data lida no servidor ficaria congelada no dia do build.
//
// O tema liga e desliga sozinho pela data (fuso de São Paulo), sem novo deploy.
// Para testar fora da janela: abra qualquer tela com ?tema=halloween (liga) ou
// ?tema=normal (desliga).
export type TemaSazonal = "halloween" | null;

// Janela do Halloween de 2026: liga em 30/10 e volta ao layout original
// sozinho em 02/11 (a data de volta é exclusiva: 01/11 ainda é Halloween).
const HALLOWEEN_INICIO = "2026-10-30";
const HALLOWEEN_VOLTA_AO_NORMAL = "2026-11-02";

// Assunto pré-preenchido pelo atalho "Halloween" da tela inicial. Usa o fluxo
// de tema livre que já existe (até CUSTOM_TOPIC_MAX = 140 caracteres), então a
// geração da aula não muda.
export const ASSUNTO_HALLOWEEN = "Halloween: traditions, costumes and spooky stories";

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
  if (forcado === "halloween") return "halloween";
  if (forcado === "normal") return null;
  const hoje = dataEmSaoPaulo(d);
  return hoje >= HALLOWEEN_INICIO && hoje < HALLOWEEN_VOLTA_AO_NORMAL ? "halloween" : null;
}
