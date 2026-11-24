-- Endurece as funções de gatilho do banco (alerta do advisor de segurança do Supabase).
--
-- O que muda e por quê:
-- 1. handle_new_user, protect_admin_only_profile_fields e rls_auto_enable são
--    SECURITY DEFINER e estavam com EXECUTE liberado para anon/authenticated, ou seja,
--    apareciam como RPC na Data API (/rest/v1/rpc/...) para qualquer um, logado ou não.
--    Chamá-las fora de um gatilho falha hoje, mas não há motivo para ficarem expostas.
--    Gatilhos continuam funcionando: o Postgres não checa EXECUTE quando o gatilho
--    dispara, só quem cria o gatilho precisa do privilégio.
-- 2. handle_new_user e protect_admin_only_profile_fields não fixavam search_path. Função
--    SECURITY DEFINER sem search_path fixo pode ser enganada por um objeto de mesmo nome
--    criado em outro schema. As duas já usam nomes qualificados (public.profiles,
--    auth.role()), então fixar o caminho não muda o comportamento.
--
-- Seguro para rodar a qualquer momento, antes ou depois do deploy: nenhum código do app
-- chama essas funções diretamente. Idempotente (pode rodar de novo sem efeito).
-- Não mexe nas funções caminhos_*, que são abertas para anon de propósito (site Caminhos).

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_admin_only_profile_fields() from public, anon, authenticated;

-- rls_auto_enable é o gatilho de evento criado pelo próprio Supabase (liga RLS em tabela
-- nova); não está no schema.sql, por isso só é tocado se existir.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.protect_admin_only_profile_fields() set search_path = public, pg_temp;

-- Conferência (deve voltar sem anon/authenticated no acl e com search_path nas duas):
-- select proname, proconfig, proacl from pg_proc
--  where pronamespace = 'public'::regnamespace
--    and proname in ('handle_new_user','protect_admin_only_profile_fields','rls_auto_enable');
