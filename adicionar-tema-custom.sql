-- Adiciona 'custom' à lista de topic_kind aceitos, para o novo campo onde
-- o aluno escreve a própria situação a simular (ex: "entrevista de emprego
-- numa empresa de tecnologia"). Sem isso, o insert em sessions falha na
-- constraint de check.
--
-- Idempotente — seguro rodar de novo.

alter table public.sessions drop constraint if exists sessions_topic_kind_check;
alter table public.sessions add constraint sessions_topic_kind_check
  check (topic_kind in ('news','music','biography','travel','work','health','sports','cooking','technology','astrology','custom'));
