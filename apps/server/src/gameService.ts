import {
  calcRoleStats,
  expRequiredForLevel,
  GENERAL_TEMPLATES,
  ITEMS,
  MAPS,
  REALMS,
  ROLE_CLASS_META,
  type CharacterView,
  type Gender,
  type GeneralView,
  type InventoryItemView,
  type RankEntry,
  type RoleClass,
} from '@hxsg/shared';
import { db } from './db.js';

interface CharacterRow {
  id: number;
  account_id: number;
  realm_id: string;
  name: string;
  role_class: RoleClass;
  gender: Gender;
  portrait: string;
  level: number;
  exp: number;
  hp: number;
  max_hp: number;
  mp: number;
  max_mp: number;
  atk: number;
  def: number;
  spd: number;
  silver: number;
  gold: number;
  map_id: string;
}

interface GeneralRow {
  id: number;
  character_id: number;
  template_id: string;
  name: string;
  role_class: RoleClass;
  sprite_key: string;
  avatar_key: string;
  level: number;
  exp: number;
  hp: number;
  max_hp: number;
  mp: number;
  max_mp: number;
  atk: number;
  spd: number;
  growth: number;
  slot: number | null;
}

export function getCharacterByAccountAndRealm(
  accountId: number,
  realmId: string,
): CharacterView | null {
  const row = db
    .prepare('SELECT * FROM characters WHERE account_id = ? AND realm_id = ?')
    .get(accountId, realmId) as CharacterRow | undefined;
  if (!row) return null;
  return hydrateCharacter(row);
}

export function getCharacterById(characterId: number): CharacterView | null {
  const row = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId) as
    | CharacterRow
    | undefined;
  if (!row) return null;
  return hydrateCharacter(row);
}

function hydrateCharacter(row: CharacterRow): CharacterView {
  const acc = db.prepare('SELECT is_gm FROM accounts WHERE id = ?').get(row.account_id) as
    | { is_gm: number }
    | undefined;

  const generalRows = db
    .prepare('SELECT * FROM generals WHERE character_id = ? ORDER BY slot IS NULL, slot ASC, id ASC')
    .all(row.id) as unknown as GeneralRow[];

  const generals: GeneralView[] = generalRows.map((g) => ({
    id: g.id,
    templateId: g.template_id,
    name: g.name,
    roleClass: g.role_class,
    spriteKey: g.sprite_key,
    avatarKey: g.avatar_key,
    level: g.level,
    exp: g.exp,
    hp: g.hp,
    maxHp: g.max_hp,
    mp: g.mp,
    maxMp: g.max_mp,
    atk: g.atk,
    spd: g.spd,
    growth: g.growth,
    slot: g.slot,
  }));

  const invRows = db
    .prepare('SELECT item_id, quantity FROM inventory WHERE character_id = ? AND quantity > 0')
    .all(row.id) as unknown as Array<{ item_id: string; quantity: number }>;

  const inventory: InventoryItemView[] = invRows
    .map((ir) => {
      const tpl = ITEMS[ir.item_id];
      if (!tpl) return null;
      return {
        itemId: tpl.itemId,
        name: tpl.name,
        desc: tpl.desc,
        type: tpl.type,
        quantity: ir.quantity,
        hpRestore: tpl.hpRestore,
        mpRestore: tpl.mpRestore,
        priceSilver: tpl.priceSilver,
      };
    })
    .filter(Boolean) as InventoryItemView[];

  return {
    id: row.id,
    accountId: row.account_id,
    realmId: row.realm_id,
    name: row.name,
    roleClass: row.role_class,
    gender: row.gender,
    portrait: row.portrait,
    level: row.level,
    exp: row.exp,
    expToNext: expRequiredForLevel(row.level),
    hp: row.hp,
    maxHp: row.max_hp,
    mp: row.mp,
    maxMp: row.max_mp,
    atk: row.atk,
    def: row.def,
    spd: row.spd,
    silver: row.silver,
    gold: row.gold,
    mapId: row.map_id,
    isGm: Boolean(acc?.is_gm),
    generals,
    inventory,
  };
}

export function createCharacter(params: {
  accountId: number;
  realmId: string;
  name: string;
  roleClass: RoleClass;
  gender: Gender;
}): CharacterView {
  const realm = REALMS.find((r) => r.id === params.realmId);
  if (!realm) throw new Error('无效的服务器分区');

  const name = params.name.trim();
  if (name.length < 2 || name.length > 10) {
    throw new Error('角色名需为 2~10 个字');
  }
  if (!ROLE_CLASS_META[params.roleClass]) {
    throw new Error('无效的职业');
  }
  const existing = db
    .prepare('SELECT id FROM characters WHERE account_id = ? AND realm_id = ?')
    .get(params.accountId, params.realmId);
  if (existing) throw new Error('你在该区已有角色');

  const nameTaken = db
    .prepare('SELECT id FROM characters WHERE realm_id = ? AND name = ?')
    .get(params.realmId, name);
  if (nameTaken) throw new Error('该角色名已被占用');

  const stats = calcRoleStats(params.roleClass, 1);
  const portrait = ROLE_CLASS_META[params.roleClass].portrait;
  const now = Date.now();

  const res = db
    .prepare(
      `INSERT INTO characters (
        account_id, realm_id, name, role_class, gender, portrait,
        level, exp, hp, max_hp, mp, max_mp, atk, def, spd,
        silver, gold, map_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, 800, 100, 'xuchang', ?, ?)`,
    )
    .run(
      params.accountId,
      params.realmId,
      name,
      params.roleClass,
      params.gender,
      portrait,
      stats.maxHp,
      stats.maxHp,
      stats.maxMp,
      stats.maxMp,
      stats.atk,
      stats.def,
      stats.spd,
      now,
      now,
    );

  const characterId = Number(res.lastInsertRowid);

  // Starter items
  addItem(characterId, 'jinchuang', 5);
  addItem(characterId, 'ningshen', 3);

  return getCharacterById(characterId)!;
}

export function addItem(characterId: number, itemId: string, delta: number) {
  const existing = db
    .prepare('SELECT id, quantity FROM inventory WHERE character_id = ? AND item_id = ?')
    .get(characterId, itemId) as { id: number; quantity: number } | undefined;
  if (existing) {
    const nextQty = Math.max(0, existing.quantity + delta);
    db.prepare('UPDATE inventory SET quantity = ? WHERE id = ?').run(nextQty, existing.id);
  } else if (delta > 0) {
    db.prepare('INSERT INTO inventory (character_id, item_id, quantity) VALUES (?, ?, ?)').run(
      characterId,
      itemId,
      delta,
    );
  }
}

export function moveCharacter(characterId: number, targetMapId: string): CharacterView {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const currentMap = MAPS[ch.mapId];
  const nextMap = MAPS[targetMapId];
  if (!nextMap) throw new Error('目标地图不存在');
  if (currentMap && !currentMap.neighbors.includes(targetMapId) && ch.mapId !== targetMapId) {
    throw new Error(`无法从 ${currentMap.name} 直接前往 ${nextMap.name}`);
  }
  db.prepare('UPDATE characters SET map_id = ?, updated_at = ? WHERE id = ?').run(
    targetMapId,
    Date.now(),
    characterId,
  );
  return getCharacterById(characterId)!;
}

export function restAtInn(characterId: number): CharacterView {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  db.prepare('UPDATE characters SET hp = max_hp, mp = max_mp, updated_at = ? WHERE id = ?').run(
    Date.now(),
    characterId,
  );
  db.prepare('UPDATE generals SET hp = max_hp, mp = max_mp WHERE character_id = ?').run(
    characterId,
  );
  return getCharacterById(characterId)!;
}

export function buyShopItem(characterId: number, itemId: string, quantity: number): CharacterView {
  const tpl = ITEMS[itemId];
  if (!tpl) throw new Error('商品不存在');
  const qty = Math.max(1, Math.min(99, Math.floor(quantity)));
  const cost = tpl.priceSilver * qty;
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  if (ch.silver < cost) throw new Error('银两不足');

  db.prepare('UPDATE characters SET silver = silver - ?, updated_at = ? WHERE id = ?').run(
    cost,
    Date.now(),
    characterId,
  );
  addItem(characterId, itemId, qty);
  return getCharacterById(characterId)!;
}

export function useInventoryItem(characterId: number, itemId: string): CharacterView {
  const tpl = ITEMS[itemId];
  if (!tpl || tpl.type !== 'consumable') throw new Error('该物品无法直接使用');
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const owned = ch.inventory.find((i) => i.itemId === itemId);
  if (!owned || owned.quantity <= 0) throw new Error('背包数量不足');

  const newHp = Math.min(ch.maxHp, ch.hp + (tpl.hpRestore ?? 0));
  const newMp = Math.min(ch.maxMp, ch.mp + (tpl.mpRestore ?? 0));
  db.prepare('UPDATE characters SET hp = ?, mp = ?, updated_at = ? WHERE id = ?').run(
    newHp,
    newMp,
    Date.now(),
    characterId,
  );
  addItem(characterId, itemId, -1);
  return getCharacterById(characterId)!;
}

export function grantGeneralToCharacter(
  characterId: number,
  templateId: string,
  level = 1,
): GeneralView {
  const tpl = GENERAL_TEMPLATES[templateId];
  if (!tpl) throw new Error('副将模板不存在');
  const existingSlots = db
    .prepare('SELECT slot FROM generals WHERE character_id = ? AND slot IS NOT NULL')
    .all(characterId) as unknown as Array<{ slot: number }>;
  const used = new Set(existingSlots.map((s) => s.slot));
  let freeSlot: number | null = null;
  for (const s of [0, 1, 2]) {
    if (!used.has(s)) {
      freeSlot = s;
      break;
    }
  }
  const lv = Math.max(1, level);
  const maxHp = Math.round(tpl.baseHp + (lv - 1) * 20 * tpl.growth);
  const maxMp = Math.round(tpl.baseMp + (lv - 1) * 12 * tpl.growth);
  const atk = Math.round(tpl.baseAtk + (lv - 1) * 5.5 * tpl.growth);
  const spd = Math.round(tpl.baseSpd + (lv - 1) * 3 * tpl.growth);

  const info = db
    .prepare(
      `INSERT INTO generals (
        character_id, template_id, name, role_class, sprite_key, avatar_key,
        level, exp, hp, max_hp, mp, max_mp, atk, spd, growth, slot, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      characterId,
      tpl.templateId,
      tpl.name,
      tpl.roleClass,
      tpl.spriteKey,
      tpl.avatarKey,
      lv,
      maxHp,
      maxHp,
      maxMp,
      maxMp,
      atk,
      spd,
      tpl.growth,
      freeSlot,
      Date.now(),
    );

  return {
    id: Number(info.lastInsertRowid),
    templateId: tpl.templateId,
    name: tpl.name,
    roleClass: tpl.roleClass,
    spriteKey: tpl.spriteKey,
    avatarKey: tpl.avatarKey,
    level: lv,
    exp: 0,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    atk,
    spd,
    growth: tpl.growth,
    slot: freeSlot,
  };
}

export function recruitGeneral(characterId: number, templateId: string): CharacterView {
  const tpl = GENERAL_TEMPLATES[templateId];
  if (!tpl) throw new Error('无效的副将');
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  if (ch.generals.length >= 12) throw new Error('副将栏位已满（最多 12 名）');
  if (ch.silver < tpl.recruitCostSilver) throw new Error(`银两不足，需要 ${tpl.recruitCostSilver} 两`);

  db.prepare('UPDATE characters SET silver = silver - ?, updated_at = ? WHERE id = ?').run(
    tpl.recruitCostSilver,
    Date.now(),
    characterId,
  );
  grantGeneralToCharacter(characterId, templateId, Math.max(1, ch.level - 1));
  return getCharacterById(characterId)!;
}

export function setGeneralSlot(
  characterId: number,
  generalId: number,
  slot: number | null,
): CharacterView {
  const gen = db
    .prepare('SELECT id FROM generals WHERE id = ? AND character_id = ?')
    .get(generalId, characterId);
  if (!gen) throw new Error('副将不存在');

  if (slot !== null) {
    if (![0, 1, 2].includes(slot)) throw new Error('无效的出战槽位');
    db.prepare('UPDATE generals SET slot = NULL WHERE character_id = ? AND slot = ?').run(
      characterId,
      slot,
    );
  }
  db.prepare('UPDATE generals SET slot = ? WHERE id = ?').run(slot, generalId);
  return getCharacterById(characterId)!;
}

export function applyExpAndSilver(
  characterId: number,
  expGain: number,
  silverGain: number,
  hpAfter?: number,
  mpAfter?: number,
): { character: CharacterView; leveledUp: boolean; newLevel: number } {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');

  let level = ch.level;
  let exp = ch.exp + expGain;
  let leveledUp = false;

  while (exp >= expRequiredForLevel(level) && level < 140) {
    exp -= expRequiredForLevel(level);
    level++;
    leveledUp = true;
  }

  const stats = calcRoleStats(ch.roleClass, level);
  const finalHp = leveledUp
    ? stats.maxHp
    : Math.max(1, Math.min(stats.maxHp, hpAfter ?? ch.hp));
  const finalMp = leveledUp
    ? stats.maxMp
    : Math.max(0, Math.min(stats.maxMp, mpAfter ?? ch.mp));

  db.prepare(
    `UPDATE characters
     SET level = ?, exp = ?, hp = ?, max_hp = ?, mp = ?, max_mp = ?,
         atk = ?, def = ?, spd = ?, silver = silver + ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    level,
    exp,
    finalHp,
    stats.maxHp,
    finalMp,
    stats.maxMp,
    stats.atk,
    stats.def,
    stats.spd,
    silverGain,
    Date.now(),
    characterId,
  );

  // Also level up active generals
  const activeGenerals = ch.generals.filter((g) => g.slot !== null);
  for (const g of activeGenerals) {
    const tpl = GENERAL_TEMPLATES[g.templateId];
    if (!tpl) continue;
    let gLv = g.level;
    let gExp = g.exp + Math.round(expGain * 0.8);
    while (gExp >= expRequiredForLevel(gLv) && gLv < level + 2) {
      gExp -= expRequiredForLevel(gLv);
      gLv++;
    }
    const maxHp = Math.round(tpl.baseHp + (gLv - 1) * 20 * g.growth);
    const maxMp = Math.round(tpl.baseMp + (gLv - 1) * 12 * g.growth);
    const atk = Math.round(tpl.baseAtk + (gLv - 1) * 5.5 * g.growth);
    const spd = Math.round(tpl.baseSpd + (gLv - 1) * 3 * g.growth);
    db.prepare(
      `UPDATE generals SET level = ?, exp = ?, hp = ?, max_hp = ?, mp = ?, max_mp = ?, atk = ?, spd = ? WHERE id = ?`,
    ).run(gLv, gExp, maxHp, maxHp, maxMp, maxMp, atk, spd, g.id);
  }

  return {
    character: getCharacterById(characterId)!,
    leveledUp,
    newLevel: level,
  };
}

export function getRankings(realmId: string, sort: 'level' | 'silver' | 'gold'): RankEntry[] {
  const orderSql =
    sort === 'silver'
      ? 'silver DESC, level DESC'
      : sort === 'gold'
        ? 'gold DESC, level DESC'
        : 'level DESC, exp DESC';
  const rows = db
    .prepare(
      `SELECT id, name, role_class, level, silver, gold FROM characters WHERE realm_id = ? ORDER BY ${orderSql} LIMIT 30`,
    )
    .all(realmId) as unknown as Array<{
    id: number;
    name: string;
    role_class: RoleClass;
    level: number;
    silver: number;
    gold: number;
  }>;

  return rows.map((r, i) => ({
    rank: i + 1,
    id: r.id,
    name: r.name,
    roleClass: r.role_class,
    level: r.level,
    silver: r.silver,
    gold: r.gold,
  }));
}

export function gmGrant(
  characterId: number,
  opts: { silver?: number; gold?: number; exp?: number; fullHeal?: boolean; grantGeneralId?: string },
): CharacterView {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');

  if (opts.silver) {
    db.prepare('UPDATE characters SET silver = MAX(0, silver + ?) WHERE id = ?').run(
      opts.silver,
      characterId,
    );
  }
  if (opts.gold) {
    db.prepare('UPDATE characters SET gold = MAX(0, gold + ?) WHERE id = ?').run(
      opts.gold,
      characterId,
    );
  }
  if (opts.exp && opts.exp > 0) {
    applyExpAndSilver(characterId, opts.exp, 0);
  }
  if (opts.fullHeal) {
    restAtInn(characterId);
  }
  if (opts.grantGeneralId && GENERAL_TEMPLATES[opts.grantGeneralId]) {
    grantGeneralToCharacter(characterId, opts.grantGeneralId, ch.level);
  }
  return getCharacterById(characterId)!;
}
