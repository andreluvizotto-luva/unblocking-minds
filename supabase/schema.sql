-- Estúdio Diário de Inglês — esquema mínimo do banco (Supabase / Postgres)
-- Rode este arquivo no SQL Editor do seu projeto Supabase.

-- Perfil do estudante (complementa auth.users, que o Supabase Auth já cria)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  default_level text check (default_level in ('A1','A2','B1','B2','C1','C2')),
  -- Campos opcionais de perfil (estilo rede social) — nada aqui é obrigatório
  bio text,
  avatar_url text,
  location text,
  website text,
  created_at timestamptz not null default now()
);

-- Uma sessão diária completa (tema + os 4 blocos de exercício gerados)
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  topic_kind text not null check (topic_kind in ('news','music','biography','travel','work','health','sports','cooking','technology','astrology','custom')),
  topic_title text not null,
  topic_blurb text,
  content jsonb not null,          -- reading/listening/speaking/writing gerados pela IA
  status text not null default 'in_progress' check (status in ('in_progress','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Uma dificuldade registrada durante a sessão (uma linha por erro/observação)
create table if not exists public.difficulties (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  skill text not null check (skill in ('Leitura','Escuta','Fala','Escrita')),
  area text not null,
  note text,
  created_at timestamptz not null default now()
);

-- Relatório final de cada sessão (gerado uma vez, ao concluir)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade unique,
  summary text,
  by_skill jsonb,
  -- Notas numéricas 0-10 por habilidade + nota geral, usadas no gráfico de evolução
  scores jsonb,
  recurring_difficulties jsonb,
  recommendations jsonb,
  created_at timestamptz not null default now()
);

-- Row Level Security: cada estudante só enxerga os próprios dados
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.difficulties enable row level security;
alter table public.reports enable row level security;

-- IMPORTANTE: nunca use "for all" aqui. "for all" cobre insert/delete além
-- de select/update, e o trigger de baixo (protect_admin_only_profile_fields)
-- só roda em "before update" — então um "for all" permite que o aluno
-- contorne a trava inteira deletando e reinserindo a própria linha
-- (auth.uid() = id vale pra insert/delete também), setando is_admin,
-- is_active e default_level à vontade nesse insert. Por isso só select e
-- update têm policy para authenticated; insert de linha nova é feito
-- exclusivamente pelo trigger handle_new_user (security definer, dono da
-- tabela, ignora RLS) e delete só pela rota admin (service_role).
create policy "profiles: owner select" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: owner update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Trava de segurança: mesmo com a policy acima permitindo o aluno editar
-- a própria linha (necessário para nome/bio/foto e para o próprio app
-- atualizar sequência de dias), campos que só um admin pode mudar nunca
-- podem ser alterados por uma chamada autenticada comum — só por uma
-- rota /api/admin/* (que usa a service_role, e por isso passa por aqui
-- como 'service_role' em vez de 'authenticated'). Sem isso, qualquer
-- aluno logado poderia se auto-promover a admin ou se auto-aprovar
-- direto pelo cliente Supabase do navegador.
create or replace function public.protect_admin_only_profile_fields()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.role() <> 'service_role' then
    new.is_admin := old.is_admin;
    new.is_active := old.is_active;
    new.approved_at := old.approved_at;
    new.default_level := old.default_level;
    new.password_expires_at := old.password_expires_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_admin_fields on public.profiles;
create trigger profiles_protect_admin_fields
  before update on public.profiles
  for each row execute function public.protect_admin_only_profile_fields();

-- Endurecimento: o aluno LÊ as próprias aulas (a tela de perfil consulta
-- esta tabela direto do navegador), mas não escreve nelas. Antes a policy
-- "for all" permitia que ele, chamando a API do Supabase direto do console,
-- alterasse a própria aula: trocar o "level" antes de gerar o relatório
-- (recebendo avaliação de um nível diferente do que o admin definiu), editar
-- o "content" com os gabaritos, marcar status = completed sem fazer nada, ou
-- inserir aulas fabricadas para inflar as estatísticas do painel.
-- Todas as escritas passaram a ser feitas pelo backend com a service_role.
create policy "sessions: owner select" on public.sessions
  for select using (auth.uid() = user_id);

-- Leitura e criação apenas — nenhum fluxo do app precisa editar ou apagar
-- uma dificuldade já registrada pelo cliente, então update/delete ficam
-- de fora de propósito (evita que o aluno apague evidências de erro).
create policy "difficulties: owner select via session" on public.difficulties
  for select using (
    exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create policy "difficulties: owner insert via session" on public.difficulties
  for insert with check (
    exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- Mesma lógica do bloco acima: um relatório só é criado uma vez, nunca
-- editado pelo cliente — sem policy de update/delete, o aluno não
-- consegue alterar a própria nota ou apagar um relatório ruim.
create policy "reports: owner select via session" on public.reports
  for select using (
    exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- Endurecimento: o relatório só é criado pela rota /api/report/generate,
-- nunca pelo navegador. Sem esta policy de insert, o aluno não consegue
-- inserir um relatório fabricado com notas perfeitas antes de fazer a aula
-- (a restrição unique(session_id) permitiria "reservar" o relatório).

-- Cria o profile automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ---------------------------------------------------------------------
-- Migração idempotente (segura rodar de novo em bancos já existentes):
-- adiciona os campos de perfil e de notas caso ainda não existam.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists location text;
alter table public.profiles add column if not exists website text;
alter table public.reports add column if not exists scores jsonb;
-- Meta semanal de aulas (Perfil → Preferências). O bucket "avatars" da foto
-- de perfil foi criado à parte (já executado).
alter table public.profiles add column if not exists weekly_goal smallint not null default 3
  check (weekly_goal between 1 and 14);

-- ---------------------------------------------------------------------
-- Painel de admin: papel de administrador, ativação/desativação de
-- alunos e expiração de senha com data definida pelo admin.
-- Idempotente — seguro rodar de novo em bancos já existentes.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles add column if not exists password_expires_at timestamptz;

-- Depois de rodar o acima, promova sua própria conta a admin (troque o e-mail):
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'seu-email@exemplo.com');

-- ---------------------------------------------------------------------
-- Sequência de dias (streak) e conquistas.
-- Idempotente — seguro rodar de novo em bancos já existentes.
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists current_streak integer not null default 0;
alter table public.profiles add column if not exists longest_streak integer not null default 0;
alter table public.profiles add column if not exists last_practice_date date;

create table if not exists public.achievements (
  code text primary key,
  title text not null,
  description text not null,
  icon text not null default '🏅',
  sort_order integer not null default 0
);

insert into public.achievements (code, title, description, icon, sort_order) values
  ('first_session', 'Primeiro passo', 'Concluiu a primeira aula de prática.', '🌱', 1),
  ('streak_3', 'Três dias seguidos', 'Praticou 3 dias seguidos.', '🔥', 2),
  ('streak_7', 'Uma semana de constância', 'Praticou 7 dias seguidos.', '🌟', 3),
  ('streak_30', 'Um mês de constância', 'Praticou 30 dias seguidos.', '👑', 4),
  ('sessions_10', '10 aulas concluídas', 'Completou 10 aulas de prática.', '📚', 5),
  ('sessions_50', '50 aulas concluídas', 'Completou 50 aulas de prática.', '🏆', 6),
  ('score_9', 'Nota de destaque', 'Alcançou nota geral acima de 9 em uma aula.', '⭐', 7),
  ('all_strong', 'Cinco pontos fortes', 'Teve as 5 habilidades avaliadas como fortes na mesma aula.', '💪', 8),
  ('level_up', 'Subiu de nível', 'Avançou para um novo nível de CEFR.', '🚀', 9)
on conflict (code) do update set
  title = excluded.title,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order;

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_code text not null references public.achievements(code) on delete cascade,
  unlocked_at timestamptz not null default now(),
  unique (user_id, achievement_code)
);

alter table public.user_achievements enable row level security;

-- Endurecimento: só o backend (chave service_role) lê/escreve aqui — não
-- existe nenhuma tela que precise que o próprio aluno acesse esta tabela
-- direto pelo navegador. Antes havia policies de select/insert "própria",
-- o que permitia a um aluno chamar a API do Supabase direto do console do
-- navegador e se autoconceder qualquer conquista (achievement_code
-- arbitrário) sem ter cumprido a condição. Sem nenhuma policy aqui, com
-- RLS ligado, o acesso via chave anon/authenticated fica bloqueado por
-- padrão — só a chave service_role (que ignora RLS) continua funcionando.
drop policy if exists "user_achievements_select_own" on public.user_achievements;
drop policy if exists "user_achievements_insert_own" on public.user_achievements;

-- Correção: a tabela de conquistas é um catálogo público (sem dado de
-- aluno), mas alguns projetos Supabase ativam RLS por padrão em tabelas
-- novas. Sem uma regra de leitura explícita isso bloqueia tudo, então
-- garantimos a regra aqui.
alter table public.achievements enable row level security;

drop policy if exists "achievements_select_all" on public.achievements;
create policy "achievements_select_all" on public.achievements
  for select using (true);

-- ---------------------------------------------------------------------
-- Aprovação de novos alunos por um admin: a partir de agora, uma conta
-- recém-criada nasce desativada (is_active = false) até um admin liberá-la
-- pelo painel. approved_at guarda quando isso aconteceu, para diferenciar
-- "nunca aprovado" (pendente) de "foi aprovado e depois desativado".
-- Idempotente — seguro rodar de novo.
-- ---------------------------------------------------------------------
alter table public.profiles alter column is_active set default false;
alter table public.profiles add column if not exists approved_at timestamptz;

-- Não afeta quem já usa o app: todo mundo que já está ativo hoje é
-- considerado aprovado retroativamente na data do cadastro.
update public.profiles set approved_at = created_at where is_active = true and approved_at is null;

-- ---------------------------------------------------------------------
-- Dificuldade adaptativa por habilidade: a cada 10 aulas consecutivas em
-- que o aluno é avaliado como "forte" numa habilidade, a próxima leva de
-- exercícios daquela habilidade fica 10% mais desafiadora (cumulativo —
-- nunca regride sozinho; só reinicia a sequência de 10 se a avaliação
-- deixar de ser "forte"). Uma linha por aluno/habilidade.
-- Idempotente — seguro rodar de novo.
-- ---------------------------------------------------------------------
create table if not exists public.skill_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  skill text not null check (skill in ('reading','grammar','listening','speaking','writing')),
  consecutive_strong integer not null default 0,
  difficulty_percent integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, skill)
);

alter table public.skill_progress enable row level security;

-- Endurecimento: mesma lógica do user_achievements acima. Antes a policy
-- "for all" deixava o aluno, autenticado direto pela API do Supabase (sem
-- passar pelo app), zerar ou forçar o próprio difficulty_percent — ou
-- seja, escolher deixar as próprias aulas sempre mais fáceis. Só o backend
-- (service_role) lê e escreve nesta tabela agora.
drop policy if exists "skill_progress: owner read/write" on public.skill_progress;

-- ---------------------------------------------------------------------
-- Aula retomável: o aluno pode parar no meio ("terminar depois") e voltar
-- de onde parou. Guarda em qual das cinco habilidades ele estava.
-- 0 = leitura, 1 = gramática, 2 = escuta, 3 = fala, 4 = escrita.
-- Idempotente — seguro rodar de novo.
-- ---------------------------------------------------------------------
alter table public.sessions
  add column if not exists current_skill_index integer not null default 0;

-- ---------------------------------------------------------------------
-- Consumo de tokens das chamadas à API da Claude. A resposta da API traz
-- o número exato de tokens de entrada e saída; esta tabela guarda isso
-- para o painel mostrar custo real por operação e por aluno.
--
-- Visibilidade exclusiva do admin: sem policy de RLS e sem privilégios
-- para anon/authenticated, só o backend (service_role) acessa. Mesmo
-- padrão de skill_progress e user_achievements.
--
-- O "on delete set null" é proposital, ao contrário do cascade das outras
-- tabelas: o custo de uma chamada já foi pago e não deixa de ter existido
-- quando o aluno é apagado ou a aula é descartada.
-- Idempotente — seguro rodar de novo.
-- ---------------------------------------------------------------------
create table if not exists public.token_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  session_id uuid references public.sessions (id) on delete set null,
  operation text not null,
  model text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists token_usage_created_at_idx on public.token_usage (created_at desc);
create index if not exists token_usage_operation_idx on public.token_usage (operation);
create index if not exists token_usage_user_id_idx on public.token_usage (user_id);

alter table public.token_usage enable row level security;
revoke all privileges on table public.token_usage from anon, authenticated;

-- ---------------------------------------------------------------------
-- Games (Quiz e "Quem é?"): recorde e histórico de partidas por aluno.
-- Mesmo padrão de token_usage: sem policy de RLS para anon/authenticated,
-- só o backend (service_role) grava e lê — o aluno não consegue inserir
-- uma pontuação inventada pelo cliente do Supabase no navegador.
-- "detail" guarda o conteúdo da partida (ex: a personalidade), usado para
-- não repetir a mesma nas próximas rodadas.
-- Idempotente — seguro rodar de novo.
-- ---------------------------------------------------------------------
create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('quiz','guess','trivia','words')),
  score integer not null default 0,
  max_score integer not null default 0,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- Bancos criados antes de trivia/words: ver Claude outputs/liberar-games-trivia-e-palavras.sql
create index if not exists game_scores_user_game_idx on public.game_scores (user_id, game, created_at desc);

alter table public.game_scores enable row level security;
revoke all privileges on table public.game_scores from anon, authenticated;

-- ---------------------------------------------------------------------
-- Billing InfinitePay (assinatura mensal). Mesmo conteúdo de
-- Claude outputs/billing-infinitepay.sql. Substitui o fluxo de aprovação
-- manual: cadastro novo nasce como demo de 3 dias, já liberado.
-- ---------------------------------------------------------------------

-- 1. Categoria e prazo de acesso no perfil -----------------------------------
alter table public.profiles add column if not exists category text not null default 'demo';
alter table public.profiles add column if not exists access_until timestamptz;
alter table public.profiles drop constraint if exists profiles_category_check;
alter table public.profiles add constraint profiles_category_check
  check (category in ('demo','unblocking','app'));

-- Alunos de hoje foram liberados à mão: viram "unblocking" (gratuito enquanto
-- o admin mantiver). Só roda na primeira vez (antes disso todos são 'demo'
-- sem access_until).
update public.profiles
   set category = 'unblocking'
 where category = 'demo' and access_until is null and is_active = true;

-- Pendentes de aprovação (se houver) viram demo de 3 dias.
update public.profiles
   set is_active = true, approved_at = coalesce(approved_at, now()), access_until = now() + interval '3 days'
 where category = 'demo' and access_until is null and is_active = false and approved_at is null;

-- 2. Campos que só o admin/servidor muda ------------------------------------
create or replace function public.protect_admin_only_profile_fields()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.role() <> 'service_role' then
    new.is_admin := old.is_admin;
    new.is_active := old.is_active;
    new.approved_at := old.approved_at;
    new.default_level := old.default_level;
    new.password_expires_at := old.password_expires_at;
    new.category := old.category;
    new.access_until := old.access_until;
  end if;
  return new;
end;
$$;

-- 3. Cadastro novo nasce como demo de 3 dias, já liberado --------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, is_active, approved_at, category, access_until)
  values (new.id, new.raw_user_meta_data->>'name', true, now(), 'demo', now() + interval '3 days');
  return new;
end;
$$ language plpgsql security definer;

-- 4. Pagamentos (só service_role) --------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_cents integer not null,
  period_days integer not null default 30,
  status text not null default 'pending' check (status in ('pending','paid')),
  checkout_url text,
  invoice_slug text,
  transaction_nsu text unique,
  capture_method text,
  paid_amount integer,
  receipt_url text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists payments_user_idx on public.payments (user_id, created_at desc);
alter table public.payments enable row level security;
revoke all privileges on table public.payments from anon, authenticated;

-- 5. Confirmação atômica e idempotente ---------------------------------------
-- Marca o pagamento como pago e estende o acesso numa única transação. Se o
-- pagamento já estava pago (webhook repetido, ou webhook e página de retorno
-- chegando juntos), não faz nada e devolve null.
create or replace function public.apply_payment(
  p_id uuid, p_slug text, p_tx text, p_method text, p_paid_amount integer, p_receipt text
) returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_days integer;
  v_until timestamptz;
begin
  update payments
     set status = 'paid', paid_at = now(), invoice_slug = p_slug, transaction_nsu = p_tx,
         capture_method = p_method, paid_amount = p_paid_amount, receipt_url = p_receipt
   where id = p_id and status = 'pending'
   returning user_id, period_days into v_user, v_days;

  if v_user is null then
    return null;
  end if;

  update profiles
     set category = case when category = 'unblocking' then category else 'app' end,
         access_until = greatest(coalesce(access_until, now()), now()) + v_days * interval '1 day'
   where id = v_user
   returning access_until into v_until;

  return v_until;
end;
$$;
revoke all on function public.apply_payment(uuid, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.apply_payment(uuid, text, text, text, integer, text) to service_role;

-- 6. Controle de e-mails de cobrança já enviados (só service_role) -----------
create table if not exists public.billing_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  access_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, access_until)
);
alter table public.billing_emails enable row level security;
revoke all privileges on table public.billing_emails from anon, authenticated;

-- ---------------------------------------------------------------------
-- Progressão 7 de 10 e sugestão de nível ao assinante. Mesmo conteúdo de
-- Claude outputs/progressao-7-de-10.sql.
-- ---------------------------------------------------------------------

-- Histórico das últimas avaliações por habilidade, da mais antiga para a
-- mais recente: "F" = forte, "x" = qualquer outra. No máximo 10 caracteres.
alter table public.skill_progress add column if not exists recent_results text not null default '';

-- Quem já vinha numa sequência de "forte" começa com essa sequência no
-- histórico (até 10), para não perder o progresso acumulado.
update public.skill_progress
   set recent_results = repeat('F', least(consecutive_strong, 10))
 where recent_results = '' and consecutive_strong > 0;

-- Nível CEFR sugerido ao assinante depois de 5 aumentos de desafio. Gravado
-- só pelo servidor; o aluno aceita ou recusa pelo relatório.
alter table public.profiles add column if not exists suggested_level text;
alter table public.profiles drop constraint if exists profiles_suggested_level_check;
alter table public.profiles add constraint profiles_suggested_level_check
  check (suggested_level is null or suggested_level in ('A1','A2','B1','B2','C1','C2'));

create or replace function public.protect_admin_only_profile_fields()
returns trigger
language plpgsql
security definer
as $$
begin
  if auth.role() <> 'service_role' then
    new.is_admin := old.is_admin;
    new.is_active := old.is_active;
    new.approved_at := old.approved_at;
    new.default_level := old.default_level;
    new.password_expires_at := old.password_expires_at;
    new.category := old.category;
    new.access_until := old.access_until;
    new.suggested_level := old.suggested_level;
  end if;
  return new;
end;
$$;
