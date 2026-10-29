# Valdrim RPG — Status do Projeto (2026-10-28)

> **Regra**: Este documento reflete o **estado real do código e do banco** (verificado via `git status`, `supabase migration list`, `npm run test:unit`, `npm run typecheck`, `npm run build`). Planos futuros ficam em `docs/DECISOES.md` ou no final como "Próximos Passos".

---

## Resumo Executivo

| Fase | Status | Migrações | Testes | Build | Observações |
|------|--------|-----------|--------|-------|-------------|
| **Fase 1** | ✅ Concluída e preservada | 0001 (schema base) | — | ✅ | Interface, navegação, autenticação, perfis |
| **Fase 2** | ✅ Concluída e validada | 0002, 0003 (RLS, convites, correções) | 99 RLS SQL | ✅ | Segurança, campanhas, co-mestre, convites |
| **Fase 3** | 🔄 Em revisão/correção | 20261027000001 (mecânicas de jogo) | 110 unit | ✅ | Atributos, equipamento, habilidades, condições, combate — UI precisa validação ponta a ponta |
| **Fase 4** | 🚧 Em andamento (2/5 migrações aplicadas) | 20261028000001 (legacy), 20261028000002 (mapas) | 15 unit (legacy) | ✅ | Compatibilidade legada + mapas/regiões/marcadores |

---

## Fase 1 — Interface e Navegação (Preservada)

**Migrações**: `20261023000001_schema_and_helpers.sql` (tabelas base: `profiles`, `campaigns`, `campaign_members`, `campaign_invites`, `characters`)

**Funcionalidades Implementadas**:
- Autenticação Supabase (login, cadastro, recuperação de senha, PKCE)
- Perfis com `display_name` e `role` (`jogador` | `mestre`)
- Campanhas com `owner_id`, `status` (`preparacao`, `andamento`, `pausada`, `encerrada`)
- Convites com token hash (SHA-256), expiração 72h, uso único
- Roteamento hash-based (`#/rota`) com guards (`public`, `auth`, `mestre`)
- Layouts: `PublicLayout`, `AuthLayout`, `AppShell` (sidebar + header)
- Componentes UI: `Button`, `Panel`, `Field`, `Modal`, `Toast`, `Badge`, `Meter`, `Tabs`, `EmptyState`, `Icon`, `VisTag`

**Testes**: Cobertos indiretamente pelos testes de Fase 2/3.

---

## Fase 2 — Segurança, Campanhas e Convites (Concluída e Validada)

**Migrações**:
- `20261023000002_rls_policies_and_invites.sql` — RLS base, `campaign_invites`, funções `private.*`
- `20261023000003_fix_campaigns_select_returning.sql` — Correção `RETURNING` em `campaigns`
- `20261024000001_guard_character_sheet_fields.sql` — Trigger `characters_guard` (imutabilidade de `id`, `owner_id`, `campaign_id`, `stage` só por admin)
- `20261024000002_campaign_scoped_co_masters.sql` — `member_role` (`jogador` | `co_mestre`), `private.is_campaign_admin()`

**Funcionalidades Implementadas**:
- RLS em todas as tabelas: `profiles`, `campaigns`, `campaign_members`, `campaign_invites`, `characters`
- Funções auxiliares `private.*` (SECURITY DEFINER, search_path vazio): `is_master()`, `is_campaign_owner()`, `is_campaign_admin()`, `is_campaign_member()`, `shares_campaign_with()`, `admin_set_role()`, `touch_updated_at()`, `handle_new_user()`, `profiles_guard()`, `characters_guard()`
- Promoção a mestre **só** via `private.admin_set_role(uuid, 'mestre')` no SQL Editor (conta dona do projeto)
- Co-mestre existe no banco e RLS, mas **UI ainda não expõe controles de administração para co-mestre**
- Jogador vê só próprias fichas; mestre vê todas da campanha
- Testes de segurança SQL: **99 verificações** em `supabase/tests/rls_security.test.sql` (Mestre A/B, Jogador A/B, Estranho)

**Testes**:
- `npm run test:unit` — 110 testes passam (validação, busca, ficha, mensagens, regras, legacy-compat)
- `supabase/tests/rls_security.test.sql` — 99 testes (rodar no SQL Editor, transação desfeita)

**Limitações Conhecidas**:
- Co-mestre sem UI de admin
- Jogador não vê fichas de outros jogadores (decisão conservadora)
- Habilidades/equipamento no JSONB da ficha — sem editor dedicado (Fase 3 resolve)
- Exclusão de mestre com campanhas bloqueada (`ON DELETE RESTRICT`)

---

## Fase 3 — Mecânicas de Jogo (Em Revisão/Correção)

**Migração**: `20261027000001_phase3_game_mechanics.sql` (35 KB, 850+ linhas)

**Tabelas Criadas**:
1. **`character_attributes`** — Atributos base (agi, for, int, pre, vig 1–30), bônus (-10 a +10), PV/ALMA atuais/máximos, defesa, constraints `pv_now <= pv_max`, `alma_now <= alma_max`
2. **`equipment_definitions`** — Templates reutilizáveis (weapon, armor, accessory, consumable), raridade, slot, `data` JSONB tipado por tipo
3. **`character_equipment`** — Instâncias no inventário, `quantity`, `equipped_slot`, `instance_data` JSONB
4. **`ability_definitions`** — Templates (ativa, passiva, reacao), requirements, cost, range, target_type, aoe, effects array
5. **`character_abilities`** — Habilidades conhecidas, `uses_remaining`, `cooldown_remaining`
6. **`condition_definitions`** — Templates (condition_type único), effects, stacking rules
7. **`character_conditions`** — Condições ativas, severity, stacks, duration, source
8. **`combat_encounters`** — Encontros (preparing, active, paused, ended), round/turn tracking
9. **`combat_participants`** — PCs e NPCs, initiative, turn_order, team, current_pv/alma
10. **`combat_actions`** — Log de ações (attack, ability, move, item, defend, other), roll_result, damage_dealt

**Dados Iniciais (seed)**:
- 3 equipamentos oficiais: Espinho Básico, Carapaça Básica, Frasco de Cura
- 6 condições oficiais: Envenenado, Atordoado, Imobilizado, Protegido, Amedrontado, Queimando

**RLS**: Políticas completas em todas as tabelas (select/insert/update/delete por campanha + admin)
**Grants**: Column-level grants para `authenticated` (ex.: jogadores só atualizam `pv_now`, `alma_now` em `character_attributes`)

**TypeScript** (`src/lib/`):
- `api.ts` — CRUD completo para todas as 10 tabelas + sync `character_attributes` ↔ `sheet`
- `sheet.ts` — `Sheet`, `normalizeSheet`, `defaultSheet`, `recalculateDerivedStats`, `applyRecalculatedStats`
- `rules.ts` — `ATTRIBUTES`, `getModifier`, `calculateMaxPV`, `calculateMaxAlma`, `calculateDefense`, `rollDice`, `rollAttributeTest`, `rollDamage`, `applyDamageModifiers`
- `equipment.ts` — `EQUIPMENT_SLOTS`, factories (`createBasicNail`, `createBasicShell`, `createHealingFlask`), `calculateEquipmentModifiers`
- `abilities.ts` — `meetsRequirements`, `canPayCost`, `applyCost`, `createBasicAttack`, `calculateAbilityRoll`
- `conditions.ts` — `ConditionType`, `ConditionMap`, `applyCondition`, `processEndOfTurn`, `calculateConditionModifiers`, `calculateDamageOverTime`

**UI (Player.tsx)**:
- `PlayerDashboard` — lista campanhas e personagens do jogador
- `CharacterSheetPage` — abas: Identidade, Atributos, Combate, Habilidades, Equipamento, Narrativa
- `SheetEditor` — edição com dirty tracking, recálculo automático de derivados ao mudar atributos
- `InventoryPanel` — equipar/desequipar, adicionar/usar consumíveis, slots válidos por tipo
- `AbilitiesPanel` — listar/conhecer habilidades, mostrar custo/alcance/CD/usos

**O que Precisa Validação (Ponta a Ponta)**:
1. Criar personagem → `character_attributes` criado automaticamente com valores corretos
2. Editar atributos na aba "Atributos" → PV max, ALMA max, Defesa recalculados e salvos
3. Equipar arma/armadura/amuleto/encantos → bônus aplicados aos atributos efetivos
4. Adicionar habilidade → aparece na aba, custo/alcance/CD corretos
5. Aplicar condição → modificadores somados, duração decrementa no fim do turno
6. Iniciar encontro de combate → participantes, iniciativa, log de ações
7. Jogador não consegue editar `stage` (só mestre via `updateCharacter` com `stage`)

**Testes Unitários**: 110 testes passam (inclui regras, equipamento, condições, validação, ficha, legacy-compat)

---

## Fase 4 — Ferramentas do Mestre e Compatibilidade (Em Andamento)

### Migração 1/5: Compatibilidade de Fichas Legadas ✅ Aplicada Localmente
**Arquivo**: `supabase/migrations/20261028000001_phase4_legacy_compat.sql`

**Objetivo**: Permitir migração **assistida** (não automática) de fichas com JSONB legado (6 attrs PT) para `character_attributes` (5 attrs EN), preservando o JSONB original como source of truth.

**Entregas**:
- Coluna `legacy_mapping` JSONB em `character_attributes` (auditoria: mapping, merge_rules, legacy_values, migrated_at, migrated_by)
- `private.extract_legacy_attributes(p_sheet jsonb)` — extrai `sheet->'attributes'` se objeto válido
- `public.suggest_legacy_mapping(p_character_id uuid)` — retorna sugestão com mapping padrão + merge_max para PRE
- `public.migrate_legacy_character(p_character_id, p_mapping, p_merge_rules, p_override_existing)` — aplica mapping, calcula derivados, upsert `character_attributes`, grava `legacy_mapping`
- View `public.characters_needing_migration` — lista chars com attrs legados no JSONB sem `character_attributes` migrado (RLS `security_invoker = true`)
- Índice `character_attributes_legacy_mapping_idx` para busca rápida de não migrados
- RLS: só admin da campanha executa `suggest_legacy_mapping` / `migrate_legacy_character`

**TypeScript** (`src/lib/legacy-compat.ts`):
- `LEGACY_ATTRIBUTES` — tupla dos 6 nomes PT
- `DEFAULT_LEGACY_MAPPING` — mapping + mergeRules (PRE=max, FOR=direct, demais=direct)
- `legacyAttributesToPhase3(sheet, mapping?)` — retorna `Partial<CharacterAttributes>` com chaves **lowercase** (agi, for, int, pre, vig, pv_max, alma_max, defense, pv_now, alma_now)
- `hasLegacyAttributes(sheet)` — detecta attrs legados válidos
- `getMappingConflicts(mapping)` — detecta PRE multi-legado, attrs Fase 3 sem mapeamento, legados não mapeados
- `generateMappingSuggestion(sheet)` — sugestão para pré-preencher UI de migração

**Testes Unitários** (`tests/unit/legacy-compat.test.ts`): **15 testes** — todos passam
- Mapeamento direto, merge rules (max, avg, sum), derivados, clamp PV/ALMA, ausentes, conflitos, sugestão

**API** (`src/lib/api.ts`):
- `suggestLegacyMapping(characterId)`
- `migrateLegacyCharacter(characterId, mapping, mergeRules, overrideExisting)`
- `listCharactersNeedingMigration()`

---

### Migração 2/5: Mapas, Regiões e Marcadores ✅ Aplicada Localmente
**Arquivo**: `supabase/migrations/20261028000002_phase4_maps_regions_markers.sql`

**Tabelas**:
1. **`maps`** — campaign-scoped, `image_url`, `grid_type` (square/hex/none), `grid_size`, `fog_enabled`, `fog_color`, `fog_opacity`, `visibility` (all/players_only/gm_only), `sort_order`
2. **`map_layers`** — camadas ordenadas por `z_index`, `layer_type` (background, grid, tokens, fog, gm_notes, measurements), `visible`, `gm_only`, `opacity`, `data` JSONB
3. **`regions`** — áreas nomeadas no mapa, `shape_type` (polygon/circle/rectangle), `geometry` JSONB, `fill_color`, `stroke_color`, `is_secret`, `is_restricted`, `tags[]`, `parent_region_id` (hierarquia)
4. **`markers`** — POIs, NPCs, encontros, loot, segredos, notas, entradas, perigos, descanso, lojas, custom; `icon`, `icon_color`, `icon_size`, posição `x`/`y`, `linked_character_id`, `linked_encounter_id`, `linked_map_id`, `is_secret`, `is_discovered`, `discovered_by[]`, `discovered_at`, `tags[]`
5. **`map_permissions`** — permissões finas por usuário ou role (`all_players`, `all_masters`): `can_view`, `can_edit`, `can_manage_layers`, `can_manage_markers`, `can_reveal_fog`, `can_manage_regions`

**RLS Completo**:
- `maps`: campanha members veem conforme `visibility` + `map_permissions`
- `map_layers`: `gm_only` respeitado, `map_permissions.can_manage_layers`
- `regions`: `is_secret` oculta de jogadores, `map_permissions.can_manage_regions`
- `markers`: `is_secret` + `is_discovered` + `discovered_by` + `map_permissions.can_manage_markers`
- `map_permissions`: só admin da campanha gerencia

**TypeScript** (`src/lib/api.ts`):
- Interfaces: `Map`, `MapLayer`, `Region`, `Marker`, `MapPermission`
- CRUD completo para todas (list, get, create, update, delete)
- `discoverMarker(id, userId)` — marca descoberto pelo jogador atual
- `listMarkers(mapId, filters?)` — filtro por região, tipo, includeSecret

**UI** (`src/pages/Maps.tsx`):
- Rota `/mestre/mapas` (adicionada em `src/app/routes.tsx`)
- Painel mestre com 4 abas: **Camadas**, **Regiões**, **Marcadores**, **Permissões**
- Lista de mapas da campanha com toggle de visibilidade e delete
- Modais de criação para cada tipo de entidade
- Descoberta de marcadores (botão "Descobrir" → adiciona `userId` a `discovered_by`, seta `is_discovered=true`)
- Tabela de permissões com checkboxes por capacidade

---

### Migrações 3–5/5: Planejadas (Não Implementadas)

| Migração | Tema | Tabelas Planejadas | Status |
|----------|------|-------------------|--------|
| **3/5** | Missões/Objetivos | `missions`, `mission_objectives`, `mission_progress` | 📋 Planejada |
| **4/5** | Bestiário/Criaturas | `creatures`, `creature_abilities`, `creature_loot_tables` | 📋 Planejada |
| **5/5** | Diário + Recompensas | `gm_journal`, `rewards`, `progression_log` | 📋 Planejada |

---

## Banco de Dados Local (Supabase Docker)

**Migrações Aplicadas** (`supabase migration list` ou `supabase db reset`):
```
20261023000001_schema_and_helpers.sql
20261023000002_rls_policies_and_invites.sql
20261023000003_fix_campaigns_select_returning.sql
20261024000001_guard_character_sheet_fields.sql
20261024000002_campaign_scoped_co_masters.sql
20261027000001_phase3_game_mechanics.sql
20261028000001_phase4_legacy_compat.sql
20261028000002_phase4_maps_regions_markers.sql
```

**Tabelas Públicas** (verificadas via `supabase db diff` ou `psql`):
- `profiles`, `campaigns`, `campaign_members`, `campaign_invites`, `characters`
- `character_attributes`, `equipment_definitions`, `character_equipment`
- `ability_definitions`, `character_abilities`
- `condition_definitions`, `character_conditions`
- `combat_encounters`, `combat_participants`, `combat_actions`
- `maps`, `map_layers`, `regions`, `markers`, `map_permissions`

**Funções `private.*`**: `is_master`, `is_campaign_owner`, `is_campaign_admin`, `is_campaign_member`, `shares_campaign_with`, `admin_set_role`, `touch_updated_at`, `handle_new_user`, `profiles_guard`, `characters_guard`, `extract_legacy_attributes`

**Funções `public.*`**: `create_campaign_invite`, `redeem_campaign_invite`, `suggest_legacy_mapping`, `migrate_legacy_character`

**Views**: `characters_needing_migration`

---

## Testes

| Suite | Comando | Testes | Status |
|-------|---------|--------|--------|
| Unitário | `npm run test:unit` | 110 | ✅ Passam |
| TypeScript | `npm run typecheck` | — | ✅ Sem erros |
| Build | `npm run build` | — | ✅ 593 KB JS, 27 KB CSS |
| RLS SQL | `supabase/tests/rls_security.test.sql` (SQL Editor) | 99 | ✅ Validado na Fase 2; **precisa re-rodar após Fase 4** |
| E2E | `npm run test:e2e` | ~30 | ⚠️ Usa fakes; não testa segurança real |

**Cobertura Unitária** (principais módulos):
- `validation.ts`, `search.ts`, `sheet.ts`, `rules.ts`, `equipment.ts`, `abilities.ts`, `conditions.ts`, `legacy-compat.ts`, `router.ts`, `api.ts` (parcial)

---

## Próximo Passo Recomendado

1. **Validar Fase 3 ponta a ponta** no navegador (`npm run dev`):
   - Criar campanha, gerar convites, entrar com 2 jogadores
   - Criar fichas, editar atributos, equipar itens, aprender habilidades, aplicar condições
   - Iniciar encontro de combate, rolar iniciativa, registrar ações
   - Confirmar que `character_attributes` é source of truth (não JSONB da ficha)

2. **Testar Migração Legada**:
   - Inserir ficha com JSONB legado (6 attrs PT) via SQL ou seed
   - Chamar `suggest_legacy_mapping` → revisar → `migrate_legacy_character`
   - Conferir `character_attributes` + `legacy_mapping` + view `characters_needing_migration` vazia

3. **Testar Mapas/Regiões/Marcadores**:
   - Acessar `/mestre/mapas` como mestre
   - Criar mapa, camadas, região, marcadores (incluindo secretos)
   - Entrar como jogador → confirmar que não vê segredos, vê descobertos
   - Testar `discoverMarker` e permissões finas

4. **Rodar testes RLS SQL** após validar Fase 4 (políticas novas em `maps`, `map_layers`, `regions`, `markers`, `map_permissions`)

5. **Planejar/Implementar Migração 3/5** (Missões/Objetivos) — ver `docs/DECISOES.md` para decisões arquiteturais.

---

## O que NÃO Está Confirmado (Precisa Validação Manual)

- [ ] UI da Fase 3 salva corretamente `character_attributes` ao editar ficha
- [ ] Equipamento aplica bônus aos atributos efetivos em tempo real na UI
- [ ] Habilidades/condições funcionam no fluxo de combate real
- [ ] Migração legada ponta a ponta (JSONB → character_attributes) funciona sem perda
- [ ] RLS de mapas/regiões/marcadores bloqueia corretamente jogadores (teste real com 2 usuários)
- [ ] Descoberta de marcadores sincroniza entre abas/usuários
- [ ] Performance de queries com índices atuais (especialmente `character_attributes`, `markers`)

---

*Atualize este arquivo a cada marco concluído (migração aplicada, teste validado, decisão registrada).*