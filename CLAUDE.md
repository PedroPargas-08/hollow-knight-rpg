# Valdrim RPG — Instruções Permanentes para o Agente

## Princípios Gerais
- **Preserve Fases 1 e 2**: Não altere autenticação, campanhas, convites, RLS base, perfis, papéis (jogador/mestre), triggers de proteção (`characters_guard`, `profiles_guard`).
- **Fase 3 em revisão/correção**: As mecânicas de jogo (atributos, equipamento, habilidades, condições, combate) existem no banco e no TypeScript, mas a UI do jogador precisa ajustes finos e testes de integração real.
- **Fase 4 em andamento**: Migrações 1/5 (compatibilidade legada) e 2/5 (mapas/regiões/marcadores) aplicadas localmente. Migrações 3–5 planejadas.
- **Nenhuma alteração remota**: Não execute `supabase db push`, não publique, não faça commits a menos que solicitado. Trabalhe apenas localmente com `supabase db reset` / `supabase migration up`.
- **Dados são sagrados**: Nunca apague dados de produção nem de desenvolvimento. Migrações só adicionam; nunca `DROP` colunas/tabelas em uso.
- **RLS é a autoridade**: Toda autorização acontece no banco. O frontend só chama `supabase.from().select/insert/update/delete`. Nunca implemente "checagens de permissão" no TypeScript.
- **TypeScript estrito**: `npm run typecheck` deve passar sem erros. `npm run build` deve gerar bundle sem warnings.
- **Testes**: `npm run test:unit` (110+ testes) deve passar. Testes e2e usam fakes; testes SQL de RLS (`supabase/tests/rls_security.test.sql`) são a prova real de segurança — rode no SQL Editor sempre que mudar políticas.

## Fluxo de Trabalho Local
```bash
# Subir banco local (Docker)
supabase start

# Aplicar migrações pendentes
supabase migration up

# Reset completo (apaga dados locais, reaplica tudo)
supabase db reset

# Rodar testes
npm run test:unit
npm run typecheck
npm run build
```

## Estrutura de Pastas Relevante
```
src/
  app/           # auth, prefs, router, routes, nav
  components/    # ui, overlay, layout, domain (Icon, MaskGlyph)
  lib/           # api.ts (camada de dados), sheet.ts, rules.ts, equipment.ts, abilities.ts, conditions.ts, legacy-compat.ts, validation.ts, search.ts, supabase.ts, useAsync.ts, router.ts
  pages/         # Home, Auth, Campaigns, Player, Master, Maps, Rules, Misc
  data/          # brand.ts, compendium (regras estáticas)
  styles/        # CSS global
  types.ts       # tipos globais

supabase/
  migrations/    # 9 migrações (ordem cronológica = dependência)
  tests/         # rls_security.test.sql (99 verificações)

tests/
  unit/          # 110 testes Node.js (validação, ficha, regras, legacy-compat)
  e2e/           # Playwright com fakes (não testa segurança real)
```

## Convenções de Código
- **Nomes**: Tabelas/colunas em `snake_case`; interfaces TS em `PascalCase`; chaves JSONB em `camelCase` (ex.: `pv_now`, `pvMax` no JSON).
- **Atributos Fase 3**: 5 atributos EN (`agi`, `for`, `int`, `pre`, `vig`) — chaves *lowercase* no `CharacterAttributes` e no JSONB da ficha nova.
- **Atributos Legados**: 6 atributos PT (`Agilidade`, `Intelecto`, `Vigor`, `Percepção`, `Presença`, `Vontade`) — chaves *TitleCase* no JSONB antigo.
- **Mapeamento legado → Fase 3**:
  - Agilidade → AGI (direct)
  - Intelecto → INT (direct)
  - Vigor → VIG (direct)
  - Percepção → PRE (max com Presença)
  - Presença → PRE (max com Percepção)
  - Vontade → FOR (direct)
- **Merge rules**: `direct` | `max` | `avg` | `sum` — aplicadas no `legacyAttributesToPhase3()` e no `migrate_legacy_character()`.
- **Dados derivados**: `pv_max = 10 + VIG*stage + floor((VIG-10)/2)`, `alma_max = floor(5 + INT*stage/2 + floor((INT-10)/2))`, `defense = 10 + floor((AGI-10)/2)`.

## Comandos Úteis
| Comando | Descrição |
|---|---|
| `npm run dev` | Vite dev server (porta 5173) |
| `npm run build` | Build produção (esbuild) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:unit` | Testes unitários (tsx --test) |
| `npm run test:e2e` | Testes e2e (Playwright) |
| `supabase status` | Status containers locais |
| `supabase db diff` | Ver diff schema local vs migrações |

## Próximos Passos Prioritários
1. **Validar Fase 3 na UI**: Abrir ficha de jogador, confirmar que atributos, PV/ALMA, defesa, equipamento, habilidades, condições carregam/salvam corretamente via `character_attributes` (não mais só JSONB).
2. **Testar migração legada ponta a ponta**: Criar ficha com JSONB legado, rodar `suggest_legacy_mapping` → `migrate_legacy_character`, conferir `character_attributes` e `legacy_mapping`.
3. **Testar mapas/regiões/marcadores**: Acessar `/mestre/mapas`, criar mapa, camadas, região, marcador, descobrir, conferir RLS (jogador não vê segredos, mestre vê tudo).
4. **Migração 3/5**: Missões/objetivos (tabela `missions`, `mission_objectives`, RLS por campanha).
5. **Migração 4/5**: Bestiário/NPCs/criaturas/chefes (tabela `creatures`, `creature_abilities`, vincular a encontros de combate).
6. **Migração 5/5**: Diário privado do mestre + recompensas/progressão.

## Restrições de Segurança (Não Negociáveis)
- **Nunca** use `service_role_key` no frontend.
- **Nunca** desative RLS em tabela que tenha dados de usuário.
- **Nunca** conceda `INSERT/UPDATE/DELETE` em `profiles.role` ou `characters.stage` para `authenticated` — só `private.admin_set_role()` e trigger `characters_guard` tocam esses campos.
- **Nunca** exponha funções `private.*` via PostgREST (schema `private` não tem grants para clientes).
- **Sempre** revise `supabase/tests/rls_security.test.sql` após mudar políticas.
- **Sempre** use `SECURITY DEFINER` + `SET search_path TO ''` em funções auxiliares de RLS.

## Referências Rápidas
- `src/lib/api.ts` — Única camada de dados; todas as queries Supabase passam por aqui.
- `src/lib/sheet.ts` — `Sheet`, `normalizeSheet`, `defaultSheet`, validação de ficha.
- `src/lib/rules.ts` — `ATTRIBUTES`, `getModifier`, `calculateMaxPV`, `calculateMaxAlma`, `calculateDefense`.
- `src/app/routes.tsx` — Definição de rotas, guards de acesso (`public` | `auth` | `mestre`).
- `src/app/nav.ts` — `SHEET_TABS`, `MASTER_SECTIONS` (inclui `mapas`).
- `docs/STATUS.md` — Estado atual detalhado por fase.
- `docs/DECISOES.md` — Decisões arquiteturais registradas.

---
*Atualize este arquivo quando houver mudança estrutural (nova migração, nova tabela, mudança de convenção, nova restrição).*