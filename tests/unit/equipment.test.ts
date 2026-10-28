import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addItem,
  removeItem,
  equipItem,
  unequipItem,
  useConsumable,
  calculateTotalWeight,
  calculateEquipmentModifiers,
  createBasicNail,
  createBasicShell,
  createHealingFlask,
  type Inventory,
  type Item,
  type Weapon,
  type Armor,
  type Accessory,
} from '../../src/lib/equipment.js'

// Helper to create a minimal inventory
function createEmptyInventory(): Inventory {
  return {
    items: [],
    equipped: {},
    maxWeight: 100,
    geo: 0,
  }
}

// Helper to create item definitions map
function createItemDefs(...items: Item[]): Map<string, Item> {
  const map = new Map<string, Item>()
  for (const item of items) {
    map.set(item.id, item)
  }
  return map
}

test('addItem adds new item to inventory', () => {
  const inv = createEmptyInventory()
  const weapon = createBasicNail()
  const result = addItem(inv, weapon.id, 1)

  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].itemId, weapon.id)
  assert.equal(result.items[0].quantity, 1)
})

test('addItem stacks existing items', () => {
  const inv = createEmptyInventory()
  const flask = createHealingFlask()

  const step1 = addItem(inv, flask.id, 2)
  assert.equal(step1.items[0].quantity, 2)

  const step2 = addItem(step1, flask.id, 3)
  assert.equal(step2.items.length, 1) // Still one entry
  assert.equal(step2.items[0].quantity, 5) // 2 + 3
})

test('removeItem reduces quantity', () => {
  const inv = createEmptyInventory()
  const flask = createHealingFlask()

  const added = addItem(inv, flask.id, 5)
  const removed = removeItem(added, flask.id, 2)

  assert.equal(removed.items.length, 1)
  assert.equal(removed.items[0].quantity, 3)
})

test('removeItem removes entry when quantity reaches zero', () => {
  const inv = createEmptyInventory()
  const flask = createHealingFlask()

  const added = addItem(inv, flask.id, 3)
  const removed = removeItem(added, flask.id, 3)

  assert.equal(removed.items.length, 0)
})

test('removeItem does not go below zero', () => {
  const inv = createEmptyInventory()
  const flask = createHealingFlask()

  const added = addItem(inv, flask.id, 2)
  const removed = removeItem(added, flask.id, 10) // Remove more than available

  assert.equal(removed.items.length, 0) // Entry removed
})

test('equipItem equips weapon to correct slot', () => {
  const weapon = createBasicNail()
  const defs = createItemDefs(weapon)
  const inv = addItem(createEmptyInventory(), weapon.id, 1)

  const result = equipItem(inv, weapon.id, 'arma_principal', defs)

  assert.equal(result.success, true)
  assert.equal(result.inventory.equipped.arma_principal, weapon.id)
  const item = result.inventory.items.find(i => i.itemId === weapon.id)
  assert.equal(item?.equipped, true)
  assert.equal(item?.slot, 'arma_principal')
})

test('equipItem fails if item not in inventory', () => {
  const weapon = createBasicNail()
  const defs = createItemDefs(weapon)
  const inv = createEmptyInventory() // Empty inventory

  const result = equipItem(inv, weapon.id, 'arma_principal', defs)

  assert.equal(result.success, false)
  assert.match(result.reason || '', /inventário/)
})

test('equipItem validates slot for armor', () => {
  const armor = createBasicShell()
  const defs = createItemDefs(armor)
  const inv = addItem(createEmptyInventory(), armor.id, 1)

  const wrongSlot = equipItem(inv, armor.id, 'arma_principal', defs)
  assert.equal(wrongSlot.success, false)

  const correctSlot = equipItem(inv, armor.id, 'armadura', defs)
  assert.equal(correctSlot.success, true)
})

test('equipItem handles two-handed weapons', () => {
  const twoHanded: Weapon = {
    ...createBasicNail(),
    id: 'greatsword',
    properties: { twoHanded: true },
  }
  const defs = createItemDefs(twoHanded)
  const inv = addItem(createEmptyInventory(), twoHanded.id, 1)

  const result = equipItem(inv, twoHanded.id, 'arma_principal', defs)

  assert.equal(result.success, true)
  // Note: Implementation doesn't auto-fill secondary slot; this just validates main slot works
  assert.equal(result.inventory.equipped.arma_principal, twoHanded.id)
})

test('equipItem rejects two-handed weapon in secondary slot', () => {
  const twoHanded: Weapon = {
    ...createBasicNail(),
    id: 'greatsword',
    properties: { twoHanded: true },
  }
  const defs = createItemDefs(twoHanded)
  const inv = addItem(createEmptyInventory(), twoHanded.id, 1)

  const result = equipItem(inv, twoHanded.id, 'arma_secundaria', defs)

  assert.equal(result.success, false)
  assert.match(result.reason || '', /duas mãos/)
})

test('unequipItem removes item from slot', () => {
  const weapon = createBasicNail()
  const defs = createItemDefs(weapon)
  const inv = addItem(createEmptyInventory(), weapon.id, 1)
  const equipped = equipItem(inv, weapon.id, 'arma_principal', defs).inventory

  const unequipped = unequipItem(equipped, 'arma_principal')

  assert.equal(unequipped.equipped.arma_principal, undefined)
  const item = unequipped.items.find(i => i.itemId === weapon.id)
  assert.equal(item?.equipped, false)
  assert.equal(item?.slot, undefined)
})

test('useConsumable removes one from stack', () => {
  const flask = createHealingFlask()
  const inv = addItem(createEmptyInventory(), flask.id, 3)

  const result = useConsumable(inv, flask.id)

  assert.equal(result.success, true)
  assert.equal(result.inventory.items.length, 1)
  assert.equal(result.inventory.items[0].quantity, 2) // 3 - 1
})

test('useConsumable removes item when quantity reaches zero', () => {
  const flask = createHealingFlask()
  const inv = addItem(createEmptyInventory(), flask.id, 1)

  const result = useConsumable(inv, flask.id)

  assert.equal(result.success, true)
  assert.equal(result.inventory.items.length, 0)
})

test('useConsumable fails if item not found', () => {
  const inv = createEmptyInventory()

  const result = useConsumable(inv, 'nonexistent')

  assert.equal(result.success, false)
  assert.match(result.reason || '', /não encontrado/)
})

test('calculateTotalWeight sums item weights', () => {
  const weapon = createBasicNail() // weight: 1
  const armor = createBasicShell() // weight: 0
  const flask = createHealingFlask() // weight: 0.1
  const defs = createItemDefs(weapon, armor, flask)

  const inv = addItem(
    addItem(addItem(createEmptyInventory(), weapon.id, 1), armor.id, 1),
    flask.id,
    2
  )

  const total = calculateTotalWeight(inv, defs) // 1 + 0 + 0.1*2 = 1.2
  assert.equal(total, 1.2)
})

test('calculateTotalWeight handles empty inventory', () => {
  const defs = createItemDefs()
  const inv = createEmptyInventory()
  assert.equal(calculateTotalWeight(inv, defs), 0)
})

test('calculateTotalWeight ignores missing definitions', () => {
  const defs = createItemDefs()
  const inv = addItem(createEmptyInventory(), 'unknown_item', 5)
  assert.equal(calculateTotalWeight(inv, defs), 0)
})

test('calculateEquipmentModifiers aggregates armor defense', () => {
  const armor: Armor = {
    ...createBasicShell(),
    defenseBonus: 5,
  }
  const defs = createItemDefs(armor)
  const equipped = { armadura: armor.id }

  const mods = calculateEquipmentModifiers(equipped, defs)

  assert.equal(mods.defenseBonus, 5)
})

test('calculateEquipmentModifiers aggregates attribute bonuses', () => {
  const weapon: Weapon = {
    ...createBasicNail(),
    attributeBonus: { AGI: 1, FOR: 2 },
  }
  const armor: Armor = {
    ...createBasicShell(),
    attributeBonus: { VIG: 3 },
  }
  const defs = createItemDefs(weapon, armor)
  const equipped = { arma_principal: weapon.id, armadura: armor.id }

  const mods = calculateEquipmentModifiers(equipped, defs)

  assert.equal(mods.attributeMods.AGI, 1)
  assert.equal(mods.attributeMods.FOR, 2)
  assert.equal(mods.attributeMods.VIG, 3)
})

test('calculateEquipmentModifiers aggregates accessory bonuses', () => {
  const accessory: Accessory = {
    id: 'charm1',
    name: 'Encanto da Vida',
    description: 'Aumenta PV e ALMA',
    rarity: 'raro',
    slot: 'encanto',
    pvBonus: 10,
    almaBonus: 5,
    defenseBonus: 2,
    weight: 1,
    value: 100,
  }
  const defs = createItemDefs(accessory)
  const equipped = { encanto1: accessory.id }

  const mods = calculateEquipmentModifiers(equipped, defs)

  assert.equal(mods.pvBonus, 10)
  assert.equal(mods.almaBonus, 5)
  assert.equal(mods.defenseBonus, 2)
})

test('calculateEquipmentModifiers includes granted abilities', () => {
  const accessory: Accessory = {
    id: 'amulet1',
    name: 'Amuleto do Poder',
    description: 'Concede habilidades',
    rarity: 'epico',
    slot: 'amuleto',
    grantsAbility: ['fireball', 'shield'],
    weight: 2,
    value: 500,
  }
  const defs = createItemDefs(accessory)
  const equipped = { amuleto: accessory.id }

  const mods = calculateEquipmentModifiers(equipped, defs)

  assert.deepEqual(mods.grantedAbilities, ['fireball', 'shield'])
})

test('calculateEquipmentModifiers handles empty equipped', () => {
  const defs = createItemDefs()
  const equipped = {}

  const mods = calculateEquipmentModifiers(equipped, defs)

  assert.equal(mods.defenseBonus, 0)
  assert.equal(mods.pvBonus, 0)
  assert.equal(mods.almaBonus, 0)
  assert.equal(mods.attackBonus, 0)
  assert.deepEqual(mods.grantedAbilities, [])
})

test('factory functions create valid items', () => {
  const nail = createBasicNail()
  assert.equal(nail.id, 'basic_nail')
  assert.equal(nail.name, 'Prego')
  assert.equal(nail.damage.quantity, 1)
  assert.equal(nail.damage.sides, 6)
  assert.equal(nail.damageType, 'fisico')

  const shell = createBasicShell()
  assert.equal(shell.id, 'basic_shell')
  assert.equal(shell.name, 'Casca Simples')
  assert.equal(shell.defenseBonus, 0)

  const flask = createHealingFlask()
  assert.equal(flask.id, 'healing_flask')
  assert.equal(flask.name, 'Frasco de Cura')
  assert.equal(flask.effects[0].type, 'heal_pv')
  assert.equal(flask.effects[0].value, 20)
})
