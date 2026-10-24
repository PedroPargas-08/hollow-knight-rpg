-- =====================================================================
-- Fase 2 · Migration 3 — corrige INSERT ... RETURNING em campaigns
--
-- Problema encontrado pela suíte de testes: INSERT ... RETURNING também avalia a política de SELECT
-- sobre a linha recém-criada. A política anterior dependia só de private.is_campaign_member(id), que
-- consulta public.campaigns; dentro da mesma instrução essa consulta NÃO enxerga a linha nova, então o
-- mestre não conseguia criar campanhas (supabase-js: .insert().select()).
-- Correção: comparar owner_id diretamente na linha (sem subconsulta) além da função de participação.
-- =====================================================================
drop policy campaigns_select on public.campaigns;
create policy campaigns_select on public.campaigns for select to authenticated
  using (owner_id = (select auth.uid()) or private.is_campaign_member(id));
