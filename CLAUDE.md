# +Unblocking — contexto do projeto

App de prática diária de inglês (Next.js 14 App Router + Supabase + Claude + OpenAI).
Produção: https://www.maisunblocking.com.br (Vercel, deploy automático a cada push na `main`).
Público real: alunas e alunos da Andréa, hoje ~9 pessoas. **Não é um projeto de brinquedo — tem
usuário de verdade em produção.** Uma regressão em produção custa aula perdida de aluno.

O `README.md` explica como rodar, a arquitetura de pastas e o débito técnico conhecido.
Este arquivo é o complemento: **como trabalhar neste repositório.**

---

## Comandos

```bash
npm run dev                          # desenvolvimento
npx --no-install tsc --noEmit -p tsconfig.json   # verificação obrigatória após qualquer edição
npm run build                        # só isto pega erros que o dev esconde (ver "Armadilhas")
```

Não há testes automatizados. O `tsc --noEmit` é a única rede de segurança automática —
rode sempre, e espere `EXIT:0`.

---

## Idioma

- **Toda a interface, mensagens de erro e textos visíveis ao aluno são em português do Brasil.**
  O inglês aparece apenas dentro do conteúdo da aula (textos, perguntas, exercícios).
- **Comentários de código e mensagens de commit também em português.** Os comentários
  existentes explicam *por quê*, não *o quê* — mantenha esse padrão. Vários deles registram
  decisões e armadilhas que custaram caro para descobrir; não os apague ao editar.
- Tom dos textos ao aluno: acolhedor, direto, sem jargão técnico. O aluno nunca deve ver
  "erro 502", "JSON inválido" ou nome de tabela.

---

## Regras de segurança (inegociáveis)

1. **Chaves de API só no servidor.** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` e
   `SUPABASE_SERVICE_ROLE_KEY` nunca recebem o prefixo `NEXT_PUBLIC_` e nunca são lidas em
   componente de cliente. `.env.local` está no `.gitignore` e nunca deve ser commitado.
2. **Escrita no banco passa pelo backend.** As rotas usam `supabaseAdmin()` (service_role,
   ignora RLS) **com verificação explícita de dono** antes de gravar. O navegador só lê.
   A única exceção é a tabela `difficulties` — débito conhecido, documentado no README.
3. **Rota de admin verifica no servidor.** Use `requireAdmin()` de `src/lib/admin-auth.ts`,
   que valida via `supabase.auth.getUser()` (verificado no servidor). Nunca confie em
   `getSession()` para decidir permissão: ele apenas decodifica o token local.
4. **RLS ligado em todas as tabelas.** Tabela sem policy nenhuma = negado por padrão, que é o
   que protege `token_usage`, `skill_progress` e `user_achievements` (só o backend acessa).
5. Nada de `dangerouslySetInnerHTML` nem `innerHTML`. É a ausência deles que mantém a lacuna
   do CSP (ver README) inofensiva.

---

## Fluxo de mudanças no banco

O schema vive em **dois lugares que precisam andar juntos**:

1. `supabase/schema.sql` — fonte da verdade versionada. Sempre atualize.
2. O banco de produção no Supabase — atualizado à mão pelo André, colando SQL no SQL Editor.

Portanto, **toda mudança de banco vira um arquivo `.sql` separado, idempotente**
(`create table if not exists`, `add column if not exists`, `drop policy if exists`), com
comentário no topo explicando o que muda e por quê. Entregue o arquivo ao André para ele rodar.
Os SQLs já rodados ficam em `Claude outputs/` (pasta ignorada pelo git).

**Ordem importa:** se o SQL restringe algo que o código antigo ainda usa, avise que ele só
pode ser rodado *depois* do deploy. O `travar-escrita-sessions-reports.sql` tem um exemplo
desse aviso no cabeçalho.

---

## Fluxo de trabalho com o André

- **O André faz o push.** Commits locais, sim; `git push`, não — é ele quem sobe.
- **Sem branches penduradas.** Se um caminho for abandonado, apague a branch e registre a
  decisão no README (seção "Débito técnico conhecido"), com o que foi tentado, por que falhou
  e o que seria preciso para retomar. Já existem dois exemplos escritos assim.
- Commits pequenos, mensagem em português explicando a mudança pelo efeito, não pelo arquivo.
- Ele testa em produção com alunos reais. Mudança que possa quebrar uma aula em andamento
  merece aviso explícito antes do deploy.

---

## Arquitetura — o que é preciso saber antes de mexer

**A aula.** `POST /api/session/generate` pede à Claude um único JSON com a aula inteira
(tema + leitura + gramática + escuta + fala + escrita) e grava em `sessions.content`.
`src/app/page.tsx` orquestra as cinco habilidades em ordem (`SKILL_ORDER`), renderizando um
bloco de `src/components/SkillBlocks.tsx` por vez. Ao fim, `/api/report/generate` produz o
relatório e marca a aula como `completed`.

**Aula retomável.** `sessions.current_skill_index` guarda onde o aluno parou (0=leitura …
4=escrita). "Terminar depois" salva; "Sair" descarta a aula inteira. Rotas:
`/api/session/pending`, `/progress`, `/discard`.

**Áudio.** A escuta usa OpenAI TTS via `/api/tts/generate` (mp3 → blob → `<audio>`), não o
`speechSynthesis` do navegador. A fala grava com `MediaRecorder` e transcreve com Whisper.
Motivo: o iOS nunca teve `SpeechRecognition`, e as vozes do `speechSynthesis` variam demais
entre dispositivos. **O áudio é regenerado a cada montagem do bloco** (`Cache-Control:
no-store`) — desperdício conhecido, resolvê-lo exige Supabase Storage.

**Custo.** `src/lib/claude.ts` centraliza as chamadas à Claude e registra cada uma em
`token_usage` (entrada/saída reais vindos de `usage`), visível só no painel admin. Toda nova
chamada à Claude deve passar `meta` para o consumo ser contabilizado. `MAX_TOKENS = 8000` e há
uma tentativa de retry — o retry é o que de fato resolveu as falhas de JSON truncado,
não o teto maior.

**Admin.** `/admin` (painel), `/admin/[id]` (aluno). O botão "Alunos" da `BottomNav` só
aparece para admin. Apagar aluno é hard delete, com guardas: não apaga a si mesmo nem outro admin.

---

## Armadilhas já pagas (não repita)

- **`next dev` mente.** O CSP com nonce funcionou perfeitamente em dev e quebrou a produção
  inteira (páginas pré-renderizadas estaticamente → React nunca hidratava). Mudança em
  `next.config.js`, `middleware.ts` ou em qualquer coisa de renderização **só é validada com
  `npm run build && npm start`**.
- **`img-src 'self' data: blob:`** quebrou os avatares externos dos alunos. O `https:` no
  `img-src` do CSP é proposital.
- **Bloco de escuta não mostra nada até o áudio tocar** (por design). Logo, qualquer falha de
  TTS aparece ao aluno como tela vazia. Esse é o sintoma a suspeitar quando alguém disser
  "não aparece nada na escuta". Já há tratamento defensivo, mas a causa raiz da última
  ocorrência **ainda não foi confirmada** — falta ver o status de `/api/tts/generate` no
  navegador de um aluno.
- **Regras de senha duplicadas** entre cliente e servidor divergiram uma vez (10 vs 8
  caracteres). Agora vivem só em `src/lib/password-rules.ts` — importe de lá, não reescreva.
- **Recuperação de senha é PKCE**: o link só funciona no mesmo navegador que pediu a troca.
  Isso é limitação do fluxo, não bug. Os e-mails já avisam o aluno.

---

## Trabalho pendente

- **Bug aberto:** "nenhuma informação aparecendo na sala de escuta". Tratamento defensivo já
  aplicado em `SkillBlocks.tsx` (aula não trava mais); causa raiz por confirmar.
- **Cache do áudio de TTS** — desperdício confirmado, exige Supabase Storage.
- **Login com Google** — avaliado como viável no plano gratuito do Supabase, não implementado.
- **RLS da tabela `difficulties`** — prioridade baixa, ver README.
- Adiado por falta de dado real: geração da aula em duas fases (economia de tokens) e reúso de
  aula entre alunos do mesmo nível (prematuro com 9 alunos).
