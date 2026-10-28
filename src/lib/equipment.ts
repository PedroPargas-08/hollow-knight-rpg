// =====================================================================
// FASE 3 — SISTEMA DE EQUIPAMENTOS E INVENTÁRIO
// Armas, armaduras, itens consumíveis e inventário
// =====================================================================

import type { Attribute, DamageRoll } from './rules';
import type { DamageType } from './abilities';

/** Tipo de slot de equipamento */
export type EquipmentSlot =
  | 'arma_principal'    // Mão principal
  | 'arma_secundaria'   // Mão secundária / escudo
  | 'armadura'          // Armadura corporal
  | 'amuleto'           // Amuleto mágico
  | 'encanto1'          // Slot de encanto 1
  | 'encanto2'          // Slot de encanto 2
  | 'encanto3';         // Slot de encanto 3

/** Lista de todos os slots de equipamento com labels para UI */
export const EQUIPMENT_SLOTS: { id: EquipmentSlot; label: string; icon: string }[] = [
  { id: 'arma_principal', label: 'Arma Principal', icon: 'sword' },
  { id: 'arma_secundaria', label: 'Arma Secundária / Escudo', icon: 'shield' },
  { id: 'armadura', label: 'Armadura', icon: 'armor' },
  { id: 'amuleto', label: 'Amuleto', icon: 'gem' },
  { id: 'encanto1', label: 'Encanto 1', icon: 'spark' },
  { id: 'encanto2', label: 'Encanto 2', icon: 'spark' },
  { id: 'encanto3', label: 'Encanto 3', icon: 'spark' },
];

/** Raridade do item */
export type ItemRarity = 'comum' | 'incomum' | 'raro' | 'epico' | 'lendario';

/** Propriedades especiais de armas */
export interface WeaponProperties {
  twoHanded?: boolean;          // Requer duas mãos
  finesse?: boolean;            // Pode usar AGI em vez de FOR
  reach?: boolean;              // Alcance estendido
  ranged?: boolean;             // Arma de alcance
  rangeMin?: number;            // Alcance mínimo
  rangeMax?: number;            // Alcance máximo
  ammunition?: string;          // Tipo de munição necessária
  versatile?: DamageRoll;       // Dano alternativo com duas mãos
}

/** Arma */
export interface Weapon {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;

  damage: DamageRoll;
  damageType: DamageType;

  properties: WeaponProperties;

  // Requisitos
  requirements?: {
    attributes?: Partial<Record<Attribute, number>>;
    minStage?: number;
  };

  // Modificadores
  attributeBonus?: Partial<Record<Attribute, number>>;
  attackBonus?: number;         // Bônus para acertar
  damageBonus?: number;         // Bônus para dano

  // Visual
  icon?: string;
  weight?: number;              // Peso em kg
  value?: number;               // Valor em geo
}

/** Armadura */
export interface Armor {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;

  defenseBonus: number;         // Bônus de defesa

  // Requisitos
  requirements?: {
    attributes?: Partial<Record<Attribute, number>>;
    minStage?: number;
  };

  // Modificadores
  attributeBonus?: Partial<Record<Attribute, number>>;
  movementPenalty?: number;     // Penalidade de movimento (0-1)

  // Visual
  icon?: string;
  weight?: number;
  value?: number;
}

/** Acessório (amuleto, encanto) */
export interface Accessory {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  slot: 'amuleto' | 'encanto';

  // Modificadores
  attributeBonus?: Partial<Record<Attribute, number>>;
  defenseBonus?: number;
  pvBonus?: number;
  almaBonus?: number;

  // Habilidades concedidas
  grantsAbility?: string[];     // IDs de habilidades que o item concede

  // Efeitos passivos
  effects?: {
    type: 'resistance' | 'vulnerability' | 'immunity' | 'special';
    damageType?: DamageType;
    description: string;
  }[];

  // Requisitos
  requirements?: {
    attributes?: Partial<Record<Attribute, number>>;
    minStage?: number;
  };

  // Visual
  icon?: string;
  weight?: number;
  value?: number;
}

/** Item consumível */
export interface Consumable {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;

  // Efeitos ao usar
  effects: {
    type: 'heal_pv' | 'restore_alma' | 'buff' | 'cure_condition' | 'damage' | 'special';
    value?: number;               // Para cura/dano
    duration?: number;            // Para buffs
    attributeMods?: Partial<Record<Attribute, number>>;  // Para buffs
    conditionId?: string;         // Para cura de condição
    description: string;
  }[];

  // Visual
  icon?: string;
  weight?: number;
  value?: number;
}

/** Tipo genérico de item */
export type Item = Weapon | Armor | Accessory | Consumable;

/** Item no inventário */
export interface InventoryItem {
  itemId: string;
  quantity: number;
  equipped?: boolean;           // Para equipáveis
  slot?: EquipmentSlot;         // Slot onde está equipado
}

/** Equipamentos atuais do personagem */
export interface EquippedGear {
  arma_principal?: string;      // ID da arma
  arma_secundaria?: string;     // ID da arma/escudo
  armadura?: string;            // ID da armadura
  amuleto?: string;             // ID do amuleto
  encanto1?: string;            // ID do encanto
  encanto2?: string;
  encanto3?: string;
}

/** Inventário completo */
export interface Inventory {
  items: InventoryItem[];
  equipped: EquippedGear;
  maxWeight?: number;           // Capacidade máxima de peso
  geo: number;                  // Moeda do jogo
}

// ========== FUNÇÕES DE GESTÃO DE INVENTÁRIO ==========

/**
 * Adiciona um item ao inventário
 */
export function addItem(
  inventory: Inventory,
  itemId: string,
  quantity: number = 1
): Inventory {
  const existing = inventory.items.find(i => i.itemId === itemId);

  if (existing) {
    return {
      ...inventory,
      items: inventory.items.map(i =>
        i.itemId === itemId
          ? { ...i, quantity: i.quantity + quantity }
          : i
      )
    };
  }

  return {
    ...inventory,
    items: [...inventory.items, { itemId, quantity }]
  };
}

/**
 * Remove um item do inventário
 */
export function removeItem(
  inventory: Inventory,
  itemId: string,
  quantity: number = 1
): Inventory {
  return {
    ...inventory,
    items: inventory.items
      .map(i =>
        i.itemId === itemId
          ? { ...i, quantity: Math.max(0, i.quantity - quantity) }
          : i
      )
      .filter(i => i.quantity > 0)
  };
}

/**
 * Equipa um item em um slot
 */
export function equipItem(
  inventory: Inventory,
  itemId: string,
  slot: EquipmentSlot,
  itemDefinitions: Map<string, Item>
): { success: boolean; inventory: Inventory; reason?: string } {
  const item = itemDefinitions.get(itemId);
  if (!item) {
    return { success: false, inventory, reason: 'Item não encontrado' };
  }

  // Verifica se o item está no inventário
  const inventoryItem = inventory.items.find(i => i.itemId === itemId);
  if (!inventoryItem) {
    return { success: false, inventory, reason: 'Item não está no inventário' };
  }

  // Verifica compatibilidade do slot
  if ('damage' in item) {
    // Arma
    if (slot !== 'arma_principal' && slot !== 'arma_secundaria') {
      return { success: false, inventory, reason: 'Slot inválido para arma' };
    }
    if (item.properties.twoHanded && slot === 'arma_secundaria') {
      return { success: false, inventory, reason: 'Arma de duas mãos não pode ir na secundária' };
    }
  } else if ('defenseBonus' in item) {
    // Armadura
    if (slot !== 'armadura') {
      return { success: false, inventory, reason: 'Slot inválido para armadura' };
    }
  } else if ('slot' in item) {
    // Acessório
    const validSlots = item.slot === 'amuleto'
      ? ['amuleto']
      : ['encanto1', 'encanto2', 'encanto3'];
    if (!validSlots.includes(slot)) {
      return { success: false, inventory, reason: `Item deve ir em slot ${item.slot}` };
    }
  }

  // Remove item do slot atual se já estava equipado
  const newEquipped = { ...inventory.equipped };
  const previousSlot = Object.entries(newEquipped).find(
    ([_, id]) => id === itemId
  )?.[0] as EquipmentSlot | undefined;

  if (previousSlot) {
    newEquipped[previousSlot] = undefined;
  }

  // Desequipa item que estava no slot de destino
  newEquipped[slot] = itemId;

  return {
    success: true,
    inventory: {
      ...inventory,
      equipped: newEquipped,
      items: inventory.items.map(i =>
        i.itemId === itemId
          ? { ...i, equipped: true, slot }
          : i
      )
    }
  };
}

/**
 * Desequipa um item
 */
export function unequipItem(
  inventory: Inventory,
  slot: EquipmentSlot
): Inventory {
  const itemId = inventory.equipped[slot];
  if (!itemId) return inventory;

  return {
    ...inventory,
    equipped: {
      ...inventory.equipped,
      [slot]: undefined
    },
    items: inventory.items.map(i =>
      i.itemId === itemId
        ? { ...i, equipped: false, slot: undefined }
        : i
    )
  };
}

/**
 * Usa um item consumível
 */
export function useConsumable(
  inventory: Inventory,
  itemId: string
): { success: boolean; inventory: Inventory; reason?: string } {
  const item = inventory.items.find(i => i.itemId === itemId);
  if (!item) {
    return { success: false, inventory, reason: 'Item não encontrado' };
  }

  if (item.quantity < 1) {
    return { success: false, inventory, reason: 'Sem quantidade suficiente' };
  }

  return {
    success: true,
    inventory: removeItem(inventory, itemId, 1)
  };
}

/**
 * Calcula peso total do inventário
 */
export function calculateTotalWeight(
  inventory: Inventory,
  itemDefinitions: Map<string, Item>
): number {
  return inventory.items.reduce((total, invItem) => {
    const item = itemDefinitions.get(invItem.itemId);
    const weight = item?.weight || 0;
    return total + (weight * invItem.quantity);
  }, 0);
}

/**
 * Calcula modificadores totais de todos os equipamentos
 */
export function calculateEquipmentModifiers(
  equipped: EquippedGear,
  itemDefinitions: Map<string, Item>
): {
  attributeMods: Partial<Record<Attribute, number>>;
  defenseBonus: number;
  pvBonus: number;
  almaBonus: number;
  attackBonus: number;
  grantedAbilities: string[];
} {
  const attributeMods: Partial<Record<Attribute, number>> = {};
  let defenseBonus = 0;
  let pvBonus = 0;
  let almaBonus = 0;
  let attackBonus = 0;
  const grantedAbilities: string[] = [];

  for (const itemId of Object.values(equipped)) {
    if (!itemId) continue;

    const item = itemDefinitions.get(itemId);
    if (!item) continue;

    // Bônus de atributos (armas, armaduras, acessórios)
    if ('attributeBonus' in item && item.attributeBonus) {
      for (const [attr, bonus] of Object.entries(item.attributeBonus)) {
        const key = attr as Attribute;
        if (typeof bonus === 'number') {
          attributeMods[key] = (attributeMods[key] || 0) + bonus;
        }
      }
    }

    // Bônus de defesa (armaduras, acessórios)
    if ('defenseBonus' in item && typeof item.defenseBonus === 'number') {
      defenseBonus += item.defenseBonus;
    }

    // Bônus de ataque (armas)
    if ('attackBonus' in item && typeof item.attackBonus === 'number') {
      attackBonus += item.attackBonus;
    }

    // Bônus de PV/ALMA (acessórios)
    if ('pvBonus' in item && typeof item.pvBonus === 'number') {
      pvBonus += item.pvBonus;
    }
    if ('almaBonus' in item && typeof item.almaBonus === 'number') {
      almaBonus += item.almaBonus;
    }

    // Habilidades concedidas (acessórios)
    if ('grantsAbility' in item && Array.isArray(item.grantsAbility)) {
      grantedAbilities.push(...item.grantsAbility);
    }
  }

  return {
    attributeMods,
    defenseBonus,
    pvBonus,
    almaBonus,
    attackBonus,
    grantedAbilities
  };
}

// ========== ITENS PRÉ-DEFINIDOS ==========

/** Arma básica: Prego */
export function createBasicNail(): Weapon {
  return {
    id: 'basic_nail',
    name: 'Prego',
    description: 'Um prego simples, a arma padrão de Hallownest.',
    rarity: 'comum',
    damage: { quantity: 1, sides: 6, bonus: 0 },
    damageType: 'fisico',
    properties: {},
    value: 0,
    weight: 1
  };
}

/** Armadura básica: Casca Simples */
export function createBasicShell(): Armor {
  return {
    id: 'basic_shell',
    name: 'Casca Simples',
    description: 'A casca natural do personagem.',
    rarity: 'comum',
    defenseBonus: 0,
    value: 0,
    weight: 0
  };
}

/** Consumível básico: Frasco de Cura */
export function createHealingFlask(): Consumable {
  return {
    id: 'healing_flask',
    name: 'Frasco de Cura',
    description: 'Restaura pontos de vida.',
    rarity: 'comum',
    effects: [{
      type: 'heal_pv',
      value: 20,
      description: 'Restaura 20 PV'
    }],
    value: 50,
    weight: 0.1
  };
}
