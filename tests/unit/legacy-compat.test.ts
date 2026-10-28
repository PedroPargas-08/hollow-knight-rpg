import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_ATTRIBUTES,
  DEFAULT_LEGACY_MAPPING,
  legacyAttributesToPhase3,
  hasLegacyAttributes,
  getMappingConflicts,
  generateMappingSuggestion,
  type LegacyMapping,
  type Sheet,
} from '../../src/lib/legacy-compat.ts';

// Helper to create a test sheet with legacy attributes
function createTestSheet(attrs: Record<string, number> = {}): Sheet {
  return {
    concept: '', archetype: '', origin: '',
    attributes: {
      Agilidade: 10, Intelecto: 10, Vigor: 10,
      Percepção: 10, Presença: 10, Vontade: 10,
      ...attrs,
    } as any,
    attributeBonuses: { AGI: 0, FOR: 0, INT: 0, PRE: 0, VIG: 0 },
    pv: { now: 20, max: 20 }, alma: { now: 10, max: 10 }, defense: 10,
    history: '', personality: '', notes: '', abilities: [], equipment: [],
  };
}

test('LEGACY_ATTRIBUTES contém os 6 atributos esperados', () => {
  assert.deepEqual([...LEGACY_ATTRIBUTES], [
    'Agilidade', 'Intelecto', 'Vigor', 'Percepção', 'Presença', 'Vontade'
  ]);
});

test('DEFAULT_LEGACY_MAPPING mapeia todos os 6 legados para 5 Fase 3', () => {
  const mapping = DEFAULT_LEGACY_MAPPING.mapping;
  assert.equal(mapping.Agilidade, 'AGI');
  assert.equal(mapping.Intelecto, 'INT');
  assert.equal(mapping.Vigor, 'VIG');
  assert.equal(mapping.Percepção, 'PRE');
  assert.equal(mapping.Presença, 'PRE');
  assert.equal(mapping.Vontade, 'FOR');
});

test('DEFAULT_LEGACY_MAPPING define mergeRules', () => {
  const rules = DEFAULT_LEGACY_MAPPING.mergeRules;
  assert.equal(rules.PRE, 'max');
  assert.equal(rules.FOR, 'direct');
  assert.equal(rules.AGI, 'direct');
  assert.equal(rules.INT, 'direct');
  assert.equal(rules.VIG, 'direct');
});

test('hasLegacyAttributes: detecta atributos legados presentes', () => {
  const sheet = createTestSheet({ Agilidade: 12 });
  assert.equal(hasLegacyAttributes(sheet), true);
});

test('hasLegacyAttributes: false para ficha sem atributos legados', () => {
  const sheet = createTestSheet({});
  // A ficha padrão tem todos os 6 com valor 10
  assert.equal(hasLegacyAttributes(sheet), true);
});

test('legacyAttributesToPhase3: converte mapeamento direto', () => {
  const sheet = createTestSheet({
    Agilidade: 14, Intelecto: 12, Vigor: 16,
    Percepção: 13, Presença: 11, Vontade: 15
  });

  const result = legacyAttributesToPhase3(sheet);

  assert.equal(result.agi, 14);  // direto
  assert.equal(result.int, 12);  // direto
  assert.equal(result.vig, 16);  // direto
  assert.equal(result.for, 15);  // Vontade → FOR direto
  assert.equal(result.pre, 13);  // max(Percepção=13, Presença=11) = 13
});

test('legacyAttributesToPhase3: calcula derivados', () => {
  const sheet = createTestSheet({
    Vigor: 14, Intelecto: 16, Agilidade: 12
  });

  const result = legacyAttributesToPhase3(sheet);

  // PV = 10 + 14*1 + floor((14-10)/2) = 10+14+2 = 26
  assert.equal(result.pv_max, 26);
  // ALMA = floor(5 + 16*1/2 + floor((16-10)/2)) = floor(5+8+3) = 16
  assert.equal(result.alma_max, 16);
  // Defense = 10 + floor((12-10)/2) = 11
  assert.equal(result.defense, 11);
});

test('legacyAttributesToPhase3: clampa PV/ALMA atuais aos novos máximos', () => {
  const sheet = createTestSheet({
    Vigor: 10, Intelecto: 10, Agilidade: 10
  });
  sheet.pv.now = 100; // maior que o máximo calculado
  sheet.alma.now = 100;

  const result = legacyAttributesToPhase3(sheet);

  // PV max = 10 + 10*1 + 0 = 20
  assert.equal(result.pv_max, 20);
  assert.equal(result.pv_now, 20); // clamped

  // ALMA max = floor(5 + 10*1/2 + 0) = 10
  assert.equal(result.alma_max, 10);
  assert.equal(result.alma_now, 10); // clamped
});

test('legacyAttributesToPhase3: NÃO preenche atributos ausentes', () => {
  const sheet = createTestSheet({});
  // Remove todos os atributos legados
  sheet.attributes = {} as any;

  const result = legacyAttributesToPhase3(sheet);

  assert.equal(result.agi, undefined);
  assert.equal(result.for, undefined);
  assert.equal(result.int, undefined);
  assert.equal(result.pre, undefined);
  assert.equal(result.vig, undefined);
});

test('legacyAttributesToPhase3: merge rule "avg"', () => {
  const customMapping: LegacyMapping = {
    mapping: {
      Agilidade: 'AGI', Intelecto: 'INT', Vigor: 'VIG',
      Percepção: 'PRE', Presença: 'PRE', Vontade: 'FOR',
    },
    mergeRules: {
      AGI: 'direct', FOR: 'direct', INT: 'direct', PRE: 'avg', VIG: 'direct',
    },
  };

  const sheet = createTestSheet({ Percepção: 14, Presença: 10 });
  const result = legacyAttributesToPhase3(sheet, customMapping);

  // avg(14, 10) = 12 (lowercase key)
  assert.equal(result.pre, 12);
});

test('legacyAttributesToPhase3: merge rule "sum"', () => {
  const customMapping: LegacyMapping = {
    mapping: {
      Agilidade: 'AGI', Intelecto: 'INT', Vigor: 'VIG',
      Percepção: 'PRE', Presença: 'PRE', Vontade: 'FOR',
    },
    mergeRules: {
      AGI: 'direct', FOR: 'direct', INT: 'direct', PRE: 'sum', VIG: 'direct',
    },
  };

  const sheet = createTestSheet({ Percepção: 5, Presença: 7 });
  const result = legacyAttributesToPhase3(sheet, customMapping);

  assert.equal(result.pre, 12);
});

test('getMappingConflicts: detecta PRE recebendo múltiplos legados', () => {
  const conflicts = getMappingConflicts(DEFAULT_LEGACY_MAPPING);
  // Conflict messages use uppercase Attribute names
  assert.ok(conflicts.some(c => c.includes('PRE') && c.includes('Percepção') && c.includes('Presença')));
});

test('getMappingConflicts: detecta atributos Fase 3 sem mapeamento', () => {
  const incompleteMapping: LegacyMapping = {
    mapping: { Agilidade: 'AGI', Intelecto: 'INT', Vigor: 'VIG' } as any,
    mergeRules: { AGI: 'direct', FOR: 'direct', INT: 'direct', PRE: 'max', VIG: 'direct' },
  };
  const conflicts = getMappingConflicts(incompleteMapping);
  assert.ok(conflicts.some(c => c.includes('FOR') && c.includes('não recebe')));
  assert.ok(conflicts.some(c => c.includes('PRE') && c.includes('não recebe')));
});

test('getMappingConflicts: detecta legados não mapeados', () => {
  const incompleteMapping: LegacyMapping = {
    mapping: { Agilidade: 'AGI', Intelecto: 'INT', Vigor: 'VIG', Percepção: 'PRE' } as any,
    mergeRules: { AGI: 'direct', FOR: 'direct', INT: 'direct', PRE: 'max', VIG: 'direct' },
  };
  const conflicts = getMappingConflicts(incompleteMapping);
  assert.ok(conflicts.some(c => c.includes('Presença') && c.includes('não tem mapeamento')));
  assert.ok(conflicts.some(c => c.includes('Vontade') && c.includes('não tem mapeamento')));
});

test('generateMappingSuggestion: cria sugestão baseada na ficha', () => {
  const sheet = createTestSheet({ Agilidade: 12, Vigor: 14 });
  const suggestion = generateMappingSuggestion(sheet);

  assert.equal(suggestion.source, 'sheet');
  assert.equal(suggestion.legacy_attributes.Agilidade, 12);
  assert.equal(suggestion.legacy_attributes.Vigor, 14);
  assert.equal(suggestion.mapping.Agilidade, 'AGI');
  assert.equal(suggestion.merge_rules.PRE, 'max');
  assert.ok(suggestion.suggested_at);
});