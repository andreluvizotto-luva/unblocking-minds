-- URGENTE: rode isto o mais rápido possível em produção.
--
-- Falha de segurança encontrada: a policy "profiles: owner read/write" usa
-- "for all", que cobre insert e delete além de select/update. O trigger
-- protect_admin_only_profile_fields (que bloqueia is_admin, is_active,
-- approved_at, default_level e password_expires_at fora das rotas /api/admin)
-- só é acionado em "before update" — ele nunca roda em insert ou delete.
--
-- Ou seja: qualquer aluno logado, direto do console do navegador, consegue:
--   await supabase.from('profiles').delete().eq('id', meuId)
--   await supabase.from('profiles').insert({ id: meuId, is_admin: true, is_active: true, default_level: 'C2' })
-- e ganhar acesso total ao /admin (ver, editar e apagar qualquer aluno),
-- sem passar por nenhuma rota do servidor.
--
-- Esta migração troca a policy "for all" por duas policies (select/update),
-- sem nenhuma policy de insert/delete para o papel authenticated. Linha
-- nova continua sendo criada só pelo trigger handle_new_user (security
-- definer, dono da tabela, ignora RLS); delete continua só pela rota de
-- admin (service_role). O aluno continua lendo e editando os campos
-- normais da própria linha (nome, bio, foto) exatamente como antes — só
-- perde a capacidade de deletar/recriar a própria linha.
--
-- Idempotente — seguro rodar de novo.

drop policy if exists "profiles: owner read/write" on public.profiles;
drop policy if exists "profiles: owner select" on public.profiles;
drop policy if exists "profiles: owner update" on public.profiles;

create policy "profiles: owner select" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles: owner update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
