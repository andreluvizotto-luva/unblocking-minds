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
