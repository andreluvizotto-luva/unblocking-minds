# Estúdio Diário de Inglês

App de prática diária de inglês (leitura, escuta, fala e escrita) calibrado por nível CEFR, com correção automática e relatório de dificuldades ao fim de cada sessão.

## Estrutura

```
src/
  app/
    page.tsx                 → tela principal (orquestra a sessão)
    login/page.tsx           → login / cadastro (Supabase Auth)
    api/
      session/generate/      → gera tema + exercícios do dia (Claude) e salva no banco
      speaking/evaluate/     → avalia a transcrição de fala (Claude) e registra dificuldades
      speaking/transcribe/   → transcreve o áudio gravado (OpenAI Whisper) — PC, iOS e Android
      writing/evaluate/      → avalia o texto escrito (Claude) e registra dificuldades
      report/generate/       → monta o relatório final da sessão e marca como concluída
      tts/generate/           → gera o áudio do listening (OpenAI TTS) — PC, iOS e Android
  components/
    ui.tsx                   → Card, Button, hooks de voz (useCloudSpeech / useAudioRecorder)
    SkillBlocks.tsx           → os 4 blocos de exercício (leitura/escuta/fala/escrita)
  lib/
    claude.ts                 → chamada à API da Claude (só roda no servidor)
    supabase.ts                → clientes Supabase (browser e servidor)
supabase/
  schema.sql                  → esquema do banco (tabelas + RLS) — rode no SQL Editor do Supabase
```

## Por que precisa de backend

A chave da API da Claude (`ANTHROPIC_API_KEY`) só existe no servidor (rotas `/api/*`), nunca no navegador. O frontend chama suas próprias rotas, que por sua vez chamam a Claude — assim a chave nunca fica exposta no código que roda no navegador do estudante.

## Passo a passo para rodar

1. **Instalar dependências**
   ```bash
   npm install
   ```

2. **Criar um projeto no Supabase** (grátis): https://supabase.com
   - No SQL Editor do projeto, cole e rode o conteúdo de `supabase/schema.sql`
   - Em Project Settings → API, copie a `URL` e a `anon public key`
   - Em Authentication → Providers, deixe "Email" habilitado (já vem por padrão)

3. **Configurar variáveis de ambiente**
   ```bash
   cp .env.example .env.local
   ```
   Preencha:
   - `ANTHROPIC_API_KEY` — sua chave da API da Anthropic (https://console.anthropic.com)
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` — do passo 2
   - `OPENAI_API_KEY` — sua chave da OpenAI (https://platform.openai.com/api-keys), usada para gerar o áudio do
     listening (TTS) e transcrever a fala do aluno (Whisper) — funciona igual em PC, iOS e Android

4. **Rodar localmente**
   ```bash
   npm run dev
   ```
   Abra http://localhost:3000 — você será redirecionado para `/login` para criar uma conta.

5. **Deploy**
   - Suba o repositório no GitHub e importe no [Vercel](https://vercel.com)
   - Configure as mesmas 3 variáveis de ambiente no painel do Vercel (Settings → Environment Variables)
   - Deploy automático a cada push

## Listening e Fala — solução multiplataforma (PC, iOS, Android)

O listening toca um áudio gerado no servidor pela OpenAI (TTS) via `<audio>` — a mesma voz e qualidade em qualquer
navegador, sem depender do `speechSynthesis` do dispositivo. A fala grava o áudio do aluno com `MediaRecorder`
(suportado em PC, iOS 14.3+ e Android) e envia para transcrição via OpenAI Whisper — não depende mais do
`SpeechRecognition` do navegador, que nunca existiu em nenhum navegador no iOS. Se o microfone não estiver
disponível (permissão negada, ou acesso fora de HTTPS/localhost), o aluno pode digitar a resposta como alternativa.

Isso tem custo por uso na OpenAI (poucos centavos por aula) e exige a variável `OPENAI_API_KEY` configurada.

## O que falta para produção completa (não incluído neste esqueleto)

- **Avaliação real de pronúncia** (não só do texto transcrito): seria necessário um serviço de pronunciation
  assessment (ex: Azure AI Speech) além da transcrição — hoje a "pronúncia" é estimada pela Claude a partir do texto.
- **Histórico/dashboard**: já implementado em `/perfil` (evolução e histórico) e `/admin` (painel administrativo).
- **Recuperação de senha, verificação de e-mail**: o Supabase Auth já suporta, só falta configurar os templates de e-mail no painel.
- **Testes automatizados.**

## Débito técnico conhecido

Coisas que sabemos que ficaram por fazer, com o porquê — para não serem
redescobertas do zero mais tarde.

### CSP: `'unsafe-inline'` no `script-src`

O cabeçalho de segurança em `next.config.js` precisa de `'unsafe-inline'` na
diretiva `script-src`, o que enfraquece a proteção contra XSS: um script
injetado na página executaria.

**O que já foi tentado.** A correção correta é usar nonce — um número
aleatório por requisição, que só os scripts legítimos carregam. Isso foi
implementado (CSP movido para o `middleware.ts`, nonce nos cabeçalhos da
requisição, `'strict-dynamic'`) e **funcionou em `next dev`**: todos os
scripts recebiam nonce e nenhuma violação aparecia no console.

**Por que não foi adiante.** No build de produção, falha: as páginas do app
são pré-renderizadas estaticamente (`○ Static` na saída do `next build`), e
um HTML gerado no momento do build não tem como conter um nonce que só
existe no momento da requisição. O resultado é a página renderizando como
casca estática e o React nunca hidratando — a interface aparece, mas nada
funciona. Só é detectável com `npm run build && npm start`; em modo dev
passa despercebido.

**O que seria preciso para retomar.** Tornar as páginas dinâmicas
(`export const dynamic = "force-dynamic"`, ou ler `headers()` no layout
raiz). Custo: cada acesso passa a invocar uma função na Vercel em vez de
servir HTML pronto, consumindo mais da cota do plano.

**Por que a espera é aceitável.** A superfície real de XSS aqui é mínima: não
há `dangerouslySetInnerHTML` nem `innerHTML` em lugar nenhum do código, e o
React escapa todo o conteúdo por padrão. O CSP atual ainda protege contra
exfiltração de dados (`connect-src` restrito ao app e ao Supabase) e contra
clickjacking (`frame-ancestors 'none'`). O que de fato mantém essa lacuna
fechada é **não introduzir** essas construções no código.

### RLS: a tabela `difficulties` aceita escrita do navegador

Todas as outras tabelas tiveram a escrita movida para o backend com a chave
`service_role` (ver os comentários em `supabase/schema.sql`). A `difficulties`
ficou de fora porque é inserida direto do cliente, em `SkillBlocks.tsx`.
Travá-la exige mover essas chamadas para rotas de API.

Prioridade baixa: o pior caso é o aluno registrar dificuldades falsas nas
próprias aulas, o que só piora o relatório dele mesmo. Não expõe dado de
ninguém nem permite escalar privilégio.
