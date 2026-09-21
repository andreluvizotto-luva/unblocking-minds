-- Corrige ícones de conquista duplicados: streak_3/streak_7/streak_30
-- usavam todos 🔥, e sessions_10/sessions_50 usavam ambos 📚. Duas
-- conquistas diferentes ficavam com o mesmo selo na tira de badges do
-- aluno, sem distinção visual nenhuma entre elas.
--
-- Fogo cresce até coroa nas conquistas de sequência (3 → 7 → 30 dias);
-- troféu marca o volume maior de aulas concluídas. Os demais ícones já
-- eram únicos e não mudam.
--
-- Idempotente — seguro rodar de novo.

update public.achievements set icon = '🌟' where code = 'streak_7';
update public.achievements set icon = '👑' where code = 'streak_30';
update public.achievements set icon = '🏆' where code = 'sessions_50';
