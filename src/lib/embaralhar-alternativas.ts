// Embaralha as alternativas de múltipla escolha depois que a aula é gerada.
//
// Por que não confiar no prompt: modelos de linguagem escrevem a alternativa
// correta primeiro e só depois inventam as distratoras. Pedir "varie a posição
// da correta" ameniza, mas não resolve — e o aluno percebe o padrão muito antes
// de a estatística fechar. Embaralhando aqui, a posição passa a ser
// genuinamente aleatória, independente do que o modelo fizer.
//
// O embaralhamento acontece uma única vez, antes de a aula ser gravada no
// banco, então a ordem é estável: o aluno que sai da aula e volta depois
// encontra as alternativas exatamente onde estavam.

type ItemComAlternativas = {
  options?: unknown;
  answerIndex?: unknown;
  [key: string]: unknown;
};

function embaralharItem<T extends ItemComAlternativas>(item: T): T {
  if (!item || typeof item !== "object") return item;

  const options = item.options;
  const answerIndex = item.answerIndex;

  // Item malformado (veio sem alternativas, ou com um gabarito fora do
  // intervalo) passa intacto: quem trata conteúdo incompleto é o componente,
  // não é papel desta função decidir o que fazer com aula quebrada.
  if (!Array.isArray(options) || options.length < 2) return item;
  if (typeof answerIndex !== "number" || answerIndex < 0 || answerIndex >= options.length) {
    return item;
  }

  // Fisher-Yates sobre os ÍNDICES, não sobre os valores. Isso importa: se duas
  // alternativas tiverem texto idêntico, procurar a correta pelo valor depois
  // do embaralhamento acharia a errada. Pelo índice, o gabarito é exato.
  const ordem = options.map((_, i) => i);
  for (let i = ordem.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ordem[i], ordem[j]] = [ordem[j], ordem[i]];
  }

  return {
    ...item,
    options: ordem.map((i) => options[i]),
    answerIndex: ordem.indexOf(answerIndex),
  };
}

function embaralharLista(lista: unknown): unknown {
  return Array.isArray(lista) ? lista.map(embaralharItem) : lista;
}

// Percorre os quatro lugares da aula que têm múltipla escolha. A fala usa
// resposta aberta ("answer", texto livre) e a escrita é avaliada pela Claude —
// nenhuma das duas tem alternativa para embaralhar.
export function embaralharAlternativas(content: any): any {
  if (!content || typeof content !== "object") return content;

  const novo = { ...content };

  if (novo.reading && typeof novo.reading === "object") {
    novo.reading = { ...novo.reading, questions: embaralharLista(novo.reading.questions) };
  }

  if (novo.grammar && typeof novo.grammar === "object") {
    novo.grammar = { ...novo.grammar, items: embaralharLista(novo.grammar.items) };
  }

  if (novo.listening && typeof novo.listening === "object") {
    novo.listening = {
      ...novo.listening,
      questions: embaralharLista(novo.listening.questions),
      gapFill: embaralharLista(novo.listening.gapFill),
    };
  }

  return novo;
}
