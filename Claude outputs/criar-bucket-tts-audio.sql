-- Rode isto no SQL Editor do Supabase ANTES (ou junto) do próximo deploy que
-- inclui o cache de áudio de TTS. Sem o bucket, /api/tts/generate continua
-- funcionando exatamente como hoje (só não cacheia nada — falha de upload é
-- ignorada de propósito, não derruba a aula).
--
-- Cria o bucket "tts-audio", privado (public=false). Não cria nenhuma
-- policy de RLS para os papéis anon/authenticated — mesmo padrão de
-- token_usage e skill_progress (schema.sql): sem policy nenhuma, com RLS
-- ligado por padrão no storage do Supabase, o acesso fica negado pra esses
-- papéis. Só o backend, com a chave service_role, lê e escreve aqui.
--
-- Idempotente — seguro rodar de novo.

insert into storage.buckets (id, name, public)
values ('tts-audio', 'tts-audio', false)
on conflict (id) do nothing;
