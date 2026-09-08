// Regras de senha em um lugar só, usadas na criação de conta e na
// redefinição. Ficavam duplicadas e já se desencontraram uma vez (o
// formulário exigia 10 caracteres enquanto o servidor pedia 8, barrando
// senha válida sem motivo).
//
// A validação que de fato vale é sempre a do Supabase, configurada em
// Authentication → Email. Estas regras espelham aquela configuração para
// dar ao aluno um retorno claro em português, em vez do erro em inglês —
// quem chama a API direto passa por cima delas de qualquer forma.
export const PASSWORD_RULES: { test: (v: string) => boolean; label: string }[] = [
  { test: (v) => v.length >= 8, label: "pelo menos 8 caracteres" },
  { test: (v) => /[a-z]/.test(v), label: "uma letra minúscula" },
  { test: (v) => /[A-Z]/.test(v), label: "uma letra maiúscula" },
  { test: (v) => /[0-9]/.test(v), label: "um número" },
  { test: (v) => /[^A-Za-z0-9]/.test(v), label: "um símbolo (ex: ! @ # $)" },
];

// Devolve a lista do que ainda falta; vazia significa senha válida.
export function senhaPendencias(senha: string) {
  return PASSWORD_RULES.filter((r) => !r.test(senha));
}

export function mensagemDePendencias(senha: string) {
  const faltando = senhaPendencias(senha);
  if (faltando.length === 0) return "";
  return `Sua senha precisa ter ${faltando.map((r) => r.label).join(", ")}.`;
}
