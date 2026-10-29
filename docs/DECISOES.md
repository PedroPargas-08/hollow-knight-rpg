# Valdrim RPG — Decisões Arquiteturais e de Design

> **Registro permanente** de decisões aprovadas. Não altere decisões passadas; adicione novas com data e contexto. Cada decisão tem: **Contexto**, **Decisão**, **Alternativas Consideradas**, **Consequências**.

---

## 1. Autenticação e Autorização (Fase 1–2)

### 1.1 Papel global ≠ papel na campanha
- **Data**: 2026-10-23
- **Contexto**: Usuários podem ser "mestre" globalmente, mas só administram campanhas onde são owner ou co_mestre explícito.
- **Decisão**: `profiles.role` (`jogador` | `mestre`) controla acesso a rotas `/mestre*`. `campaign_members.member_role` (`jogador` | `co_mestre`) controla permissões dentro da campanha. `private.is_campaign_admin(cid)` = `is_master() AND (owner OR co_mestre)`.
- **Alternativas**: Papel único global; papel só na campanha.
- **Consequências**: Mestre global sem vínculo não vê nada. Promoção a mestre é processo administrativo fora da API (`private.admin_set_role`).

### 1.2 Promoção a mestre só via SQL Editor
- **Data**: 2026-10-23
- **Contexto**: Evitar autoelevação; `profiles.role` não exposto para UPDATE pelo cliente.
- **Decisão**: `private.admin_set_role(uuid, text)` é `SECURITY DEFINER`, schema `private`, sem grants para `authenticated`/`anon`. Só `service_role`/`postgres`/`supabase_admin` executa.
- **Consequências**: Nenhum endpoint API promove a mestre. Dono do projeto roda `select private.admin_set_role('<uuid>', 'mestre')` no SQL Editor.

### 1.3 Convites com hash SHA-256, uso único, 72h
- **Data**: 2026-10-23
- **Contexto**: Token em texto puro nunca armazenado; hash indexado para lookup rápido.
- **Decisão**: `campaign_invites.token_hash` = `sha256(token)`. `create_campaign_invite` retorna token plano **uma vez**; `redeem_campaign_invite` verifica hash, marca `used_at`/`used_by`, deleta ou invalida.
- **Consequências**: Não há como listar convites válidos (só hashes). Expiração via `expires_at` + job externo ou limpeza manual.

### 1.4 RLS é a única autoridade de permissão
- **Data**: 2026-10-23
- **Contexto**: Frontend não decide "pode ou não pode"; banco decide.
- **Decisão**: Todas as tabelas com `ENABLE ROW LEVEL SECURITY`. Políticas `USING`/`WITH CHECK` usam `private.is_campaign_member()`, `private.is_campaign_admin()`, `auth.uid()`. Grants column-level para `authenticated`.
- **Consequências**: `api.ts` só chama `supabase.from().select/insert/update/delete`. Zero checagem de permissão no TypeScript. Testes de segurança **só** no SQL (`supabase/tests/rls_security.test.sql`).

---

## 2. Ficha de Personagem e Atributos (Fase 2–3)

### 2.1 JSONB `sheet` para campos flexíveis; tabela `character_attributes` para atributos/recursos
- **Data**: 2026-10-27 (Fase 3)
- **Contexto**: Ficha tem identidade (nome, conceito, história) + atributos numéricos + recursos (PV, ALMA) + derivados (defesa). Atributos precisam índice, query, constraints, RLS granular.
- **Decisão**: `characters.sheet` (JSONB, ≤64 KB) guarda identidade, narrativa, equipamento, habilidades, condições. `character_attributes` (tabela relacional, 1:1 com `characters`) guarda 5 attrs base + 5 bônus + PV/ALMA now/max + defense. `sheet.attributes` (legacy) mantido para compatibilidade.
- **Consequências**: `syncCharacterAttributes()` mantém as duas fontes sincronizadas. `character_attributes` é source of truth para mecânicas; `sheet` para exibição/narrativa.

### 2.2 5 Atributos Fase 3 (EN, lowercase) vs 6 Legados (PT, TitleCase)
- **Data**: 2026-10-27 (Fase 3) / 2026-10-28 (Fase 4 Migração 1)
- **Contexto**: Sistema original usava 6 nomes em PT. Novo sistema usa 5 em EN (AGI, FOR, INT, PRE, VIG).
- **Decisão**:
  - **Fase 3 (novo)**: `character_attributes` usa colunas `agi`, `for`, `int`, `pre`, `vig` (lowercase). `Sheet.attributes` no TypeScript usa chaves uppercase `AGI`, `FOR`, `INT`, `PRE`, `VIG` (enum `ATTRIBUTES`). `CharacterAttributes` interface usa **lowercase** (`agi`, `for`, `int`, `pre`, `vig`).
  - **Legado (JSONB antigo)**: `sheet.attributes` com chaves `Agilidade`, `Intelecto`, `Vigor`, `Percepção`, `Presença`, `Vontade`.
  - **Mapeamento padrão**: Agilidade→AGI, Intelecto→INT, Vigor→VIG, Percepção→PRE, Presença→PRE, Vontade→FOR.
  - **Merge rules**: PRE = `max(Percepção, Presença)`, FOR = `direct(Vontade)`, demais `direct`.
- **Consequências**: `legacyAttributesToPhase3()` retorna `Partial<CharacterAttributes>` com chaves lowercase. `ATTR_KEYS` map faz a tradução `AGI→agi`, etc. Testes usam lowercase.

### 2.3 Derivados calculados no banco e no TypeScript (dupla fonte)
- **Data**: 2026-10-27
- **Contexto**: PV max, ALMA max, Defesa dependem de attrs base + stage. Precisam estar corretos no banco (RLS, queries) e no frontend (UI imediata).
- **Decisão**: Fórmulas em `src/lib/rules.ts` (TypeScript) e replicadas em `migrate_legacy_character()` e `syncCharacterAttributes()` (PL/pgSQL). `recalculateDerivedStats(sheet, stage)` usado na UI; `character_attributes` armazenado no banco.
- **Consequências**: Risco de divergência se fórmula mudar. Mitigação: `syncCharacterAttributes()` chamado sempre que `sheet` ou `stage` muda.

### 2.4 Bônus de equipamento/condição em colunas separadas (`*_bonus`)
- **Data**: 2026-10-27
- **Contexto**: Equipamentos e condições dão bônus temporários (-10 a +10) aos atributos base.
- **Decisão**: Colunas `agi_bonus`, `for_bonus`, `int_bonus`, `pre_bonus`, `vig_bonus` em `character_attributes`. Valor efetivo = `base + bonus` (clamp 1–30 para derivados). `calculateEquipmentModifiers()` soma bônus de itens equipados; condições aplicam via `calculateConditionModifiers()`.
- **Consequências**: `getEffectiveAttribute(sheet, attr)` no TypeScript lê `sheet.attributeBonuses[attr]`. No banco, `character_attributes.*_bonus` atualizado por triggers ou API ao equipar/desaplicar.

### 2.5 `stage` (progressão) imutável para jogadores; só admin da campanha altera
- **Data**: 2026-10-24 (trigger `characters_guard`)
- **Contexto**: Progressão é decisão do mestre, não do jogador.
- **Decisão**: Trigger `BEFORE INSERT OR UPDATE ON characters` bloqueia `stage` se `NOT private.is_campaign_admin(campaign_id)`. `api.ts` permite `updateCharacter(id, { stage })` mas RLS rejeita se não for admin.
- **Consequências**: Jogador vê `stage` read-only na UI. Mestre edita via `MasterPage` ou SQL.

---

## 3. Equipamento, Habilidades, Condições (Fase 3)

### 3.1 Definições reutilizáveis (`*_definitions`) + instâncias por personagem (`character_*`)
- **Data**: 2026-10-27
- **Contexto**: Itens/habilidades/condições têm templates oficiais (criados por mestres) e instâncias por personagem (quantidade, equipado, cooldown, stacks).
- **Decisão**:
  - `equipment_definitions` (oficiais + custom) → `character_equipment` (inventory, `equipped_slot`, `quantity`, `instance_data`)
  - `ability_definitions` → `character_abilities` (`uses_remaining`, `cooldown_remaining`)
  - `condition_definitions` (oficiais, `condition_type` único) → `character_conditions` (`severity`, `stacks`, `duration_remaining`, `source_ability_id`, `applied_by`)
- **Consequências**: `is_official` flag distingue conteúdo do jogo vs custom. RLS: definições legíveis por todos autenticados; instâncias seguem RLS do personagem.

### 3.2 Slots de equipamento fixos (Hollow Knight style)
- **Data**: 2026-10-27
- **Contexto**: Jogo inspirado em Hollow Knight: arma principal, arma secundária, armadura, amuleto, 3 encantos.
- **Decisão**: `EQUIPMENT_SLOTS` = `['arma_principal', 'arma_secundaria', 'armadura', 'amuleto', 'encanto1', 'encanto2', 'encanto3']`. Constraint `unique_equipped_slot` por personagem. Arma de duas mãos ocupa `arma_principal` + bloqueia `arma_secundaria` (validado no TypeScript `InventoryPanel`).
- **Consequências**: `equipment_definitions.slot` valida contra essa lista. Consumíveis têm `slot = null`.

### 3.3 Tipos de habilidade: ativa, passiva, reação
- **Data**: 2026-10-27
- **Contexto**: Mecânica de ação/reação do sistema.
- **Decisão**: `ability_type` enum. `cost` JSONB: `{alma?, pv?, cooldownTurns?, usesPerRest?}`. `range` JSONB: `{min, max}` metros. `target_type`: `self`, `single`, `area`, `cone`, `line`, `all_allies`, `all_enemies`. `effects` array com tipos: `dano`, `cura`, `buff`, `debuff`, `condicao`, `movimento`, `utilidade`.
- **Consequências**: `meetsRequirements()`, `canPayCost()`, `applyCost()` em `abilities.ts` validam uso. `createBasicAttack()` factory para ataque básico.

### 3.4 Condições com stacking configurável
- **Data**: 2026-10-27
- **Contexto**: Venenos empilham (extend), atordoado não empilha (refresh), etc.
- **Decisão**: `condition_definitions`: `can_stack`, `max_stacks`, `stacking_behavior` (`refresh` | `extend` | `intensify`). `applyCondition()` em `conditions.ts` implementa lógica. `processEndOfTurn()` decrementa duração, remove expiradas.
- **Consequências**: 6 condições oficiais seedadas. Mestre cria custom via `condition_definitions` (RLS: só admin da campanha insere/atualiza).

### 3.5 Combate: encontros, participantes, log de ações
- **Data**: 2026-10-27
- **Contexto**: Sistema de iniciativa, turnos, registro de ações para histórico.
- **Decisão**:
  - `combat_encounters`: `status` (preparing, active, paused, ended), `current_round`, `current_turn_order`
  - `combat_participants`: PC (FK `character_id`) ou NPC (`npc_name`), `initiative`, `turn_order` (unique por encounter), `team` (ally/enemy/neutral), `current_pv/alma` (snapshot para NPCs)
  - `combat_actions`: `action_type`, `ability_id`/`item_id` opcional, `target_ids[]`, `roll_result`, `damage_dealt`, `description`
- **RLS**: Membros da campanha veem encontros; admins gerenciam; participantes inserem ações.
- **UI**: `MasterPage` seção `encontros` com CRUD completo + rolar iniciativa + próximo turno + log.

---

## 4. Compatibilidade Legada (Fase 4 — Migração 1/5)

### 4.1 Migração assistida (não automática), JSONB preservado
- **Data**: 2026-10-28
- **Contexto**: Fichas existentes têm 6 attrs PT no JSONB. Não se pode converter automaticamente sem risco de erro/perda. Mestre deve revisar.
- **Decisão**:
  - `legacy_mapping` JSONB em `character_attributes` registra mapping usado, merge_rules, valores legados, timestamp, autor.
  - `suggest_legacy_mapping()` **só sugere**; `migrate_legacy_character()` **aplica** após confirmação do mestre.
  - `p_override_existing=false` por padrão — evita sobrescrever acidental.
  - View `characters_needing_migration` lista pendentes (RLS `security_invoker=true`).
- **Consequências**: Zero perda de dados. Auditoria completa. Mestre pode re-migrar com `override_existing=true`.

### 4.2 Merge rules: max / avg / sum / direct
- **Data**: 2026-10-28
- **Contexto**: Percepção + Presença → PRE (qual regra?). Vontade → FOR (direto).
- **Decisão**: `DEFAULT_LEGACY_MAPPING.mergeRules = { PRE: 'max', FOR: 'direct', AGI: 'direct', INT: 'direct', VIG: 'direct' }`. Personalizável via `p_merge_rules` em `migrate_legacy_character()`.
- **Consequências**: `legacyAttributesToPhase3()` e `migrate_legacy_character()` implementam as 4 regras. Testes cobrem todas.

### 4.3 Clamp 1–30 em attrs base; PV/ALMA atuais clampados aos novos máximos
- **Data**: 2026-10-28
- **Contexto**: Valores legados podem estar fora de faixa; derivados recalculados podem ser menores que atuais.
- **Decisão**: `GREATEST(1, LEAST(30, valor))` em attrs base. `pv_now = LEAST(pv_max_novo, pv_now_antigo)`, idem `alma_now`.
- **Consequências**: Personagem não fica com PV/ALMA acima do máximo após migração. Atributos fora de faixa normalizados.

---

## 5. Mapas, Regiões, Marcadores (Fase 4 — Migração 2/5)

### 5.1 Mapas com grade, névoa de guerra, visibilidade em 3 níveis
- **Data**: 2026-10-28
- **Contexto**: Mestre precisa de mapas táticos com grid (square/hex), fog of war, controle de quem vê.
- **Decisão**: `maps`: `grid_type` (square/hex/none), `grid_size` (px), `fog_enabled`, `fog_color`, `fog_opacity`, `visibility` (`all` | `players_only` | `gm_only`). `image_url` aponta para Supabase Storage ou URL externa.
- **Consequências**: `map_layers` separa fundo, grade, tokens, névoa, notas do mestre, medidas. `z_index` ordena renderização.

### 5.2 Regiões com geometria e hierarquia
- **Data**: 2026-10-28
- **Contexto**: Dungeons têm salas; cidades têm distritos; mundo tem zonas.
- **Decisão**: `regions`: `shape_type` (polygon/circle/rectangle), `geometry` JSONB (pontos/centro+raio/x+y+w+h), `parent_region_id` auto-FK para árvore. `is_secret` (oculto até revelado), `is_restricted` (requer permissão), `tags[]` para filtros.
- **Consequências**: RLS oculta `is_secret` de jogadores. Mestre vê tudo. Hierarquia permite "salas dentro de masmorra".

### 5.3 Marcadores tipados com descoberta e links
- **Data**: 2026-10-28
- **Contexto**: POIs, NPCs, encontros, tesouros, segredos, entradas, perigos, descanso, lojas.
- **Decisão**: `markers`: `marker_type` enum (11 valores), `icon` (emoji/lucide/URL), `icon_color`, `icon_size`, posição `x`/`y` (px no mapa). Links opcionais: `linked_character_id`, `linked_encounter_id`, `linked_map_id` (para entradas). `is_secret` (mestre só), `is_discovered` + `discovered_by[]` + `discovered_at` (descoberta progressiva).
- **Consequências**: Jogador vê só `!is_secret OR is_discovered OR user_id IN discovered_by`. `discoverMarker(id, userId)` adiciona à lista e seta `is_discovered=true`.

### 5.4 Permissões finas por mapa (`map_permissions`)
- **Data**: 2026-10-28
- **Contexto**: Além de membro da campanha, mestre pode dar permissões específicas a jogadores (ex.: revelar névoa, mover tokens).
- **Decisão**: `map_permissions`: alvo = `target_user_id` OU `target_role` (`all_players` | `all_masters`). Flags: `can_view`, `can_edit`, `can_manage_layers`, `can_manage_markers`, `can_reveal_fog`, `can_manage_regions`. Só admin da campanha gerencia.
- **Consequências**: RLS de `maps`/`layers`/`regions`/`markers` consulta `map_permissions` via subquery. Flexível sem criar tabelas intermediárias complexas.

---

## 6. TypeScript e Frontend

### 6.1 `api.ts` = única camada de dados; zero lógica de permissão
- **Data**: 2026-10-23 (Fase 2) — mantido
- **Decisão**: Todas as queries Supabase em `src/lib/api.ts`. Funções retornam `Promise<T>` ou `Promise<T[]>`, lançam `Error` com `code: 'NOT_FOUND_OR_DENIED'` se RLS retorna 0 linhas. `ok()` helper extrai `data` ou lança.
- **Consequências**: Componentes só importam de `api.ts`. Fácil mockar em testes. Segurança centralizada no banco.

### 6.2 `normalizeSheet()` + `defaultSheet()` = contrato de ficha
- **Data**: 2026-10-24
- **Decisão**: `normalizeSheet(input)` valida, limpa, aplica defaults, garante `pv.now <= pv.max`, `alma.now <= alma.max`, corta strings, limita arrays. `defaultSheet()` retorna ficha vazia válida. Usado em `createCharacter`, `updateCharacter`, testes.
- **Consequências**: JSONB `sheet` sempre consistente. `CharacterAttributes` sincronizado via `syncCharacterAttributes()`.

### 6.3 Componentes UI puros (sem Supabase, sem router)
- **Data**: 2026-10-23
- **Decisão**: `components/ui/*` recebem props, disparam callbacks (`onChange`, `onClick`). `components/overlay/*` (Modal, Toast) usam portal + context. `components/layout/*` (AppShell, AuthLayout) compõem página. `components/domain/*` (Icon, MaskGlyph) são específicos do jogo.
- **Consequências**: Testáveis isoladamente. Reutilizáveis. `Player.tsx`/`Master.tsx`/`Maps.tsx` orquestram via `useAsync` + `api.ts`.

### 6.4 `useAsync(fn, deps)` para data fetching declarativo
- **Data**: 2026-10-23
- **Decisão**: Hook retorna `{ data, loading, error, reload }`. `deps` array dispara recarga. Usado em todas as páginas para listas (campanhas, personagens, mapas, etc).
- **Consequências**: Loading/error states consistentes. `reload()` exposto para botão "Tentar de novo".

---

## 7. Testes e Qualidade

### 7.1 Testes unitários: lógica pura, sem Supabase real
- **Data**: 2026-10-23
- **Decisão**: `tests/unit/*.test.ts` usa `node:test` + `node:assert/strict`. Testam `validation`, `search`, `sheet`, `rules`, `equipment`, `abilities`, `conditions`, `legacy-compat`, `router`. **Não** testam RLS nem integração Supabase.
- **Consequências**: Rápidos (~500 ms). `npm run test:unit` no CI/local. 110 testes atuais.

### 7.2 Testes RLS: SQL real com roles simuladas
- **Data**: 2026-10-23
- **Decisão**: `supabase/tests/rls_security.test.sql` cria usuários falsos (`auth.uid()` = `set_config('request.jwt.claims', ...)`), insere dados, testa 99 assertions (SELECT/INSERT/UPDATE/DELETE) como Mestre A/B, Jogador A/B, Estranho. Roda em transação `ROLLBACK` — não suja banco.
- **Consequências**: **Prova real de segurança**. Deve ser rodado no SQL Editor **sempre que mudar política RLS**. Não roda no `npm test`.

### 7.3 Testes E2E: Playwright com fakes (não segurança)
- **Data**: 2026-10-24
- **Decisão**: `tests/e2e/` usa `tests/fakes/supabase.ts` (mock do client). Testam fluxos UI: login, guardas de rota, convites, ficha, erro de rede, mobile. **Não** testam RLS nem banco real.
- **Consequências**: Úteis para regressão de UI/UX. Não substituem testes SQL de RLS.

---

## 8. Migrações e Schema

### 8.1 Migrações só adicionam; nunca `DROP` colunas/tabelas em uso
- **Data**: 2026-10-23
- **Decisão**: Padrão `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`. Índices `IF NOT EXISTS`. Views `CREATE OR REPLACE VIEW`.
- **Consequências**: `supabase db reset` sempre funciona do zero. `supabase migration up` idempotente. Seguro para desenvolvimento local.

### 8.2 Nomes de migração: `YYYYMMDDNNNN_descrição.sql`
- **Data**: 2026-10-23
- **Decisão**: Data ISO + sequência + slug. Ex.: `20261027000001_phase3_game_mechanics.sql`. Ordem cronológica = dependência.
- **Consequências**: Fácil ver histórico. `supabase migration list` mostra ordem.

### 8.3 Schema `private` para funções auxiliares de RLS
- **Data**: 2026-10-23
- **Decisão**: Funções `is_master()`, `is_campaign_admin()`, `extract_legacy_attributes()`, etc. em schema `private`. `REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated; GRANT USAGE ON SCHEMA private TO authenticated;`. Funções `SECURITY DEFINER SET search_path TO ''`.
- **Consequências**: Não expostas via PostgREST. Clientes não veem. Usadas só em políticas RLS e outras funções `private.*`.

---

## 9. Próximas Decisões (Pendentes — Migrações 3–5)

### 9.1 Migração 3/5: Missões/Objetivos
- **Perguntas em aberto**:
  - Missão pertence à campanha ou ao mapa? (Provavelmente campanha, com `map_id` opcional)
  - Objetivos são checklist simples ou têm estado complexo (progresso numérico, escolhas)?
  - Jogadores veem missões ativas? Mestre vê todas?
  - Recompensas (XP, itens, attrs) vinculadas a objetivos ou à missão completa?
- **Decisão preliminar**: `missions` (campaign_id, name, description, status, map_id?, created_by), `mission_objectives` (mission_id, description, order, type: 'kill'|'reach'|'discover'|'custom', target_ref?, target_count, completed), `mission_progress` (character_id, mission_id, objective_id, progress, completed_at). RLS: campanha members veem ativas; mestre gerencia.

### 9.2 Migração 4/5: Bestiário/Criaturas
- **Perguntas em aberto**:
  - Criaturas são templates reutilizáveis (como `equipment_definitions`) ou instâncias por encontro?
  - Stat block: attrs base (agi/for/int/pre/vig), PV/ALMA, defesa, habilidades, resistências, imunidades, loot table.
  - Vincular a `combat_participants` via `creature_id` (em vez de `npc_name`)?
- **Decisão preliminar**: `creatures` (template: attrs, pv_max, alma_max, defense, abilities[], resistances, immunities, loot_table, challenge_rating). `creature_instances` (encounter_id, creature_id, custom_overrides, current_pv/alma). RLS: oficiais legíveis por todos; custom por admin da campanha.

### 9.3 Migração 5/5: Diário do Mestre + Recompensas
- **Perguntas em aberto**:
  - Diário: entradas por sessão, por NPC, por trama? Tags? Busca full-text?
  - Recompensas: XP por etapa? Itens? Atributos? Quem concede (mestre) e quem recebe (personagem)?
  - Log de progressão: auditoria de mudanças de `stage`, attrs, itens importantes?
- **Decisão preliminar**: `gm_journal` (campaign_id, title, content, tags[], session_date, is_secret, created_by). `rewards` (campaign_id, character_id, type: 'xp'|'item'|'attribute'|'custom', payload, granted_by, granted_at). `progression_log` (character_id, field, old_value, new_value, changed_by, changed_at, reason).

---

## 10. Convenções de Código (Resumo)

| Item | Convenção | Exemplo |
|------|-----------|---------|
| Tabelas/colunas | `snake_case` | `character_attributes`, `pv_now` |
| Interfaces TS | `PascalCase` | `CharacterAttributes` |
| Chaves JSONB (novo) | `camelCase` | `pvMax`, `attributeBonuses` |
| Chaves JSONB (legado) | `TitleCase` | `Agilidade`, `Percepção` |
| Atributos Fase 3 (TS) | `UPPERCASE` enum | `ATTRIBUTES = ['AGI','FOR','INT','PRE','VIG']` |
| Atributos Fase 3 (banco/API) | `lowercase` | `agi`, `for`, `int`, `pre`, `vig` |
| Enums PG | `text CHECK IN (...)` | `status text CHECK IN ('preparing','active',...)` |
| Funções RLS | `private.nome_funcao` | `private.is_campaign_admin` |
| Migrações | `YYYYMMDDNNNN_slug.sql` | `20261028000001_phase4_legacy_compat.sql` |
| Branches | `review/descrição-data` | `review/copia-local-2026-10-24` |

---

## 11. Comandos de Verificação Rápida

```bash
# Estado do git
git status

# Migrações aplicadas localmente
supabase migration list

# Testes unitários
npm run test:unit

# TypeScript
npm run typecheck

# Build
npm run build

# Diff schema local vs migrações
supabase db diff

# Rodar testes RLS (no SQL Editor do Supabase local)
# 1. Abrir supabase/tests/rls_security.test.sql
# 2. Colar no SQL Editor
# 3. Executar → ler erro "RESULTADO_DOS_TESTES passam=99 falham=0"
```

---

*Última atualização: 2026-10-28 — Fases 1–2 preservadas, Fase 3 em validação, Fase 4 migrações 1–2/5 aplicadas localmente.*