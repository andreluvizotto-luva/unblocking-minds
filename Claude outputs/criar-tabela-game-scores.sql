-- Cria a tabela de pontuação dos Games (Quiz e "Quem é?"), para guardar o
-- recorde e o histórico de partidas de cada aluno.
--
-- Mesmo padrão de token_usage e skill_progress (ver schema.sql): RLS ligado
-- e nenhuma policy para anon/authenticated. Assim o aluno não consegue
-- inserir uma pontuação inventada direto pelo cliente do Supabase no
-- navegador — só as rotas /api/games/*, com a chave service_role, gravam e
-- leem aqui, e elas limitam a pontuação ao máximo possível de cada partida.
--
-- "detail" guarda o que a partida teve (ex: o nome da personalidade), usado
-- para não repetir a mesma personalidade nas próximas rodadas.
--
-- Pode ser rodado antes ou depois do deploy: sem a tabela, os games
-- funcionam normalmente, só não salvam pontuação.
--
-- Idempotente — seguro rodar de novo.

create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game text not null check (game in ('quiz','guess')),
  score integer not null default 0,
  max_score integer not null default 0,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists game_scores_user_game_idx on public.game_scores (user_id, game, created_at desc);

alter table public.game_scores enable row level security;
revoke all privileges on table public.game_scores from anon, authenticated;
