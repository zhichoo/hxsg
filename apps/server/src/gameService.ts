import {
  calcRoleStats,
  EQUIPMENT_TEMPLATES,
  expRequiredForLevel,
  GENERAL_TEMPLATES,
  getSkillMaxTargets,
  getSkillTier,
  ITEMS,
  MAPS,
  REALMS,
  ROLE_CLASS_META,
  SKILLS,
  type CharacterView,
  type EquipmentBonusSummary,
  type EquipmentQuality,
  type EquipmentSlot,
  type EquipmentView,
  type Gender,
  type GeneralView,
  type InventoryItemView,
  type RankEntry,
  type RoleClass,
  type SkillProgressView,
  type TreasureDigResult,
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
  free_points: number;
  pt_vit: number;
  pt_str: number;
  pt_int: number;
  pt_agi: number;
  res_points: number;
  res_phys: number;
  res_chaos: number;
  res_seal: number;
  res_trap: number;
  res_magic: number;
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

interface EquipmentRow {
  id: number;
  character_id: number;
  template_id: string;
  name: string;
  slot: EquipmentSlot;
  quality: EquipmentQuality;
  icon: string;
  level_req: number;
  hp_bonus: number;
  mp_bonus: number;
  atk_bonus: number;
  def_bonus: number;
  spd_bonus: number;
  res_phys: number;
  res_chaos: number;
  res_seal: number;
  res_trap: number;
  res_magic: number;
  sell_silver: number;
  equipped: number;
}

function getEquipmentList(characterId: number): {
  equipment: EquipmentView[];
  bonus: EquipmentBonusSummary;
} {
  const rows = db
    .prepare(
      'SELECT * FROM character_equipment WHERE character_id = ? ORDER BY equipped DESC, id DESC',
    )
    .all(characterId) as unknown as EquipmentRow[];

  const bonus: EquipmentBonusSummary = {
    hp: 0,
    mp: 0,
    atk: 0,
    def: 0,
    spd: 0,
    resPhys: 0,
    resChaos: 0,
    resSeal: 0,
    resTrap: 0,
    resMagic: 0,
  };

  const equipment: EquipmentView[] = rows.map((r) => {
    const equipped = Boolean(r.equipped);
    if (equipped) {
      bonus.hp += r.hp_bonus;
      bonus.mp += r.mp_bonus;
      bonus.atk += r.atk_bonus;
      bonus.def += r.def_bonus;
      bonus.spd += r.spd_bonus;
      bonus.resPhys += r.res_phys;
      bonus.resChaos += r.res_chaos;
      bonus.resSeal += r.res_seal;
      bonus.resTrap += r.res_trap;
      bonus.resMagic += r.res_magic;
    }
    return {
      id: r.id,
      templateId: r.template_id,
      name: r.name,
      slot: r.slot,
      quality: r.quality,
      icon: r.icon,
      levelReq: r.level_req,
      hpBonus: r.hp_bonus,
      mpBonus: r.mp_bonus,
      atkBonus: r.atk_bonus,
      defBonus: r.def_bonus,
      spdBonus: r.spd_bonus,
      resPhys: r.res_phys,
      resChaos: r.res_chaos,
      resSeal: r.res_seal,
      resTrap: r.res_trap,
      resMagic: r.res_magic,
      sellSilver: r.sell_silver,
      equipped,
    };
  });

  return { equipment, bonus };
}

function hydrateCharacter(row: CharacterRow): CharacterView {
  const acc = db.prepare('SELECT is_gm FROM accounts WHERE id = ?').get(row.account_id) as
    | { is_gm: number }
    | undefined;

  const { equipment, bonus } = getEquipmentList(row.id);
  const alloc = {
    freePoints: row.free_points ?? 0,
    vit: row.pt_vit ?? 0,
    str: row.pt_str ?? 0,
    int: row.pt_int ?? 0,
    agi: row.pt_agi ?? 0,
  };
  const baseStats = calcRoleStats(row.role_class, row.level, alloc);
  const effectiveMaxHp = baseStats.maxHp + bonus.hp;
  const effectiveMaxMp = baseStats.maxMp + bonus.mp;
  const effectiveAtk = baseStats.atk + bonus.atk;
  const effectiveDef = baseStats.def + bonus.def;
  const effectiveSpd = baseStats.spd + bonus.spd;

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

  const skillRows = db
    .prepare('SELECT skill_id, proficiency FROM character_skills WHERE character_id = ?')
    .all(row.id) as unknown as Array<{ skill_id: string; proficiency: number }>;
  const profMap = new Map(skillRows.map((s) => [s.skill_id, s.proficiency]));

  const skills: SkillProgressView[] = SKILLS.filter(
    (s) => s.roleClass === row.role_class || s.roleClass === 'all',
  ).map((s) => {
    const prof = profMap.get(s.id) ?? 0;
    const { tier, nextTierProf } = getSkillTier(prof);
    return {
      skillId: s.id,
      name: s.name,
      proficiency: prof,
      tier,
      nextTierProf,
      mpCost: s.mpCost,
      maxTargets: getSkillMaxTargets(s.aoe, prof),
      controlKind: s.controlKind,
      desc: s.desc,
    };
  });

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
    hp: Math.min(row.hp, effectiveMaxHp),
    maxHp: effectiveMaxHp,
    mp: Math.min(row.mp, effectiveMaxMp),
    maxMp: effectiveMaxMp,
    atk: effectiveAtk,
    def: effectiveDef,
    spd: effectiveSpd,
    silver: row.silver,
    gold: row.gold,
    mapId: row.map_id,
    isGm: Boolean(acc?.is_gm),
    alloc,
    resist: {
      freePoints: row.res_points ?? 0,
      phys: Math.min(75, (row.res_phys ?? 0) + bonus.resPhys),
      chaos: Math.min(75, (row.res_chaos ?? 0) + bonus.resChaos),
      seal: Math.min(75, (row.res_seal ?? 0) + bonus.resSeal),
      trap: Math.min(75, (row.res_trap ?? 0) + bonus.resTrap),
      magic: Math.min(75, (row.res_magic ?? 0) + bonus.resMagic),
    },
    equipBonus: bonus,
    equipment,
    skills,
    generals,
    inventory,
  };
}

export function addSkillProficiency(characterId: number, skillId: string, delta: number): number {
  const row = db
    .prepare('SELECT id, proficiency FROM character_skills WHERE character_id = ? AND skill_id = ?')
    .get(characterId, skillId) as { id: number; proficiency: number } | undefined;
  const next = Math.min(10000, (row?.proficiency ?? 0) + delta);
  if (row) {
    db.prepare('UPDATE character_skills SET proficiency = ? WHERE id = ?').run(next, row.id);
  } else {
    db.prepare(
      'INSERT INTO character_skills (character_id, skill_id, proficiency) VALUES (?, ?, ?)',
    ).run(characterId, skillId, next);
  }
  return next;
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
        silver, gold, map_id,
        free_points, pt_vit, pt_str, pt_int, pt_agi,
        res_points, res_phys, res_chaos, res_seal, res_trap, res_magic,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, ?, 800, 100, 'xuchang',
        4, 0, 0, 0, 0,
        5, 0, 0, 0, 0, 0,
        ?, ?)`,
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
  addItem(characterId, 'jinchuang', 5);
  addItem(characterId, 'ningshen', 3);
  addItem(characterId, 'baotu', 1);

  return getCharacterById(characterId)!;
}

export function allocateCharacterStats(
  characterId: number,
  delta: { vit?: number; str?: number; int?: number; agi?: number },
): CharacterView {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');

  const dVit = Math.max(0, Math.floor(delta.vit ?? 0));
  const dStr = Math.max(0, Math.floor(delta.str ?? 0));
  const dInt = Math.max(0, Math.floor(delta.int ?? 0));
  const dAgi = Math.max(0, Math.floor(delta.agi ?? 0));
  const total = dVit + dStr + dInt + dAgi;
  if (total <= 0) throw new Error('请选择要分配的属性点');
  if (total > ch.alloc.freePoints) throw new Error('剩余自由属性点不足');

  const nextAlloc = {
    vit: ch.alloc.vit + dVit,
    str: ch.alloc.str + dStr,
    int: ch.alloc.int + dInt,
    agi: ch.alloc.agi + dAgi,
  };
  const stats = calcRoleStats(ch.roleClass, ch.level, nextAlloc);
  const nextHp = Math.min(stats.maxHp, ch.hp + dVit * 18);
  const nextMp = Math.min(stats.maxMp, ch.mp + dInt * 16);

  db.prepare(
    `UPDATE characters
     SET free_points = free_points - ?,
         pt_vit = ?, pt_str = ?, pt_int = ?, pt_agi = ?,
         hp = ?, max_hp = ?, mp = ?, max_mp = ?, atk = ?, def = ?, spd = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    total,
    nextAlloc.vit,
    nextAlloc.str,
    nextAlloc.int,
    nextAlloc.agi,
    nextHp,
    stats.maxHp,
    nextMp,
    stats.maxMp,
    stats.atk,
    stats.def,
    stats.spd,
    Date.now(),
    characterId,
  );
  return getCharacterById(characterId)!;
}

export function resetCharacterStats(characterId: number): CharacterView {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const refunded = ch.alloc.vit + ch.alloc.str + ch.alloc.int + ch.alloc.agi;
  if (refunded <= 0) throw new Error('尚未分配任何属性点');
  const stats = calcRoleStats(ch.roleClass, ch.level, { vit: 0, str: 0, int: 0, agi: 0 });
  db.prepare(
    `UPDATE characters
     SET free_points = free_points + ?,
         pt_vit = 0, pt_str = 0, pt_int = 0, pt_agi = 0,
         hp = MIN(hp, ?), max_hp = ?, mp = MIN(mp, ?), max_mp = ?, atk = ?, def = ?, spd = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    refunded,
    stats.maxHp,
    stats.maxHp,
    stats.maxMp,
    stats.maxMp,
    stats.atk,
    stats.def,
    stats.spd,
    Date.now(),
    characterId,
  );
  return getCharacterById(characterId)!;
}

export function allocateCharacterResist(
  characterId: number,
  delta: { phys?: number; chaos?: number; seal?: number; trap?: number; magic?: number },
): CharacterView {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');

  const dPhys = Math.max(0, Math.floor(delta.phys ?? 0));
  const dChaos = Math.max(0, Math.floor(delta.chaos ?? 0));
  const dSeal = Math.max(0, Math.floor(delta.seal ?? 0));
  const dTrap = Math.max(0, Math.floor(delta.trap ?? 0));
  const dMagic = Math.max(0, Math.floor(delta.magic ?? 0));
  const total = dPhys + dChaos + dSeal + dTrap + dMagic;
  if (total <= 0) throw new Error('请选择要分配的抗性点');
  if (total > ch.resist.freePoints) throw new Error('剩余抗性点不足');

  const nextPhys = ch.resist.phys + dPhys * 3;
  const nextChaos = ch.resist.chaos + dChaos * 3;
  const nextSeal = ch.resist.seal + dSeal * 3;
  const nextTrap = ch.resist.trap + dTrap * 3;
  const nextMagic = ch.resist.magic + dMagic * 3;

  if (Math.max(nextPhys, nextChaos, nextSeal, nextTrap, nextMagic) > 75) {
    throw new Error('单项抗性上限为 75%');
  }

  db.prepare(
    `UPDATE characters
     SET res_points = res_points - ?,
         res_phys = ?, res_chaos = ?, res_seal = ?, res_trap = ?, res_magic = ?, updated_at = ?
     WHERE id = ?`,
  ).run(total, nextPhys, nextChaos, nextSeal, nextTrap, nextMagic, Date.now(), characterId);

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
  db.prepare(
    'UPDATE characters SET hp = ?, mp = ?, max_hp = ?, max_mp = ?, updated_at = ? WHERE id = ?',
  ).run(ch.maxHp, ch.maxMp, ch.maxHp, ch.maxMp, Date.now(), characterId);
  db.prepare('UPDATE generals SET hp = max_hp, mp = max_mp WHERE character_id = ?').run(
    characterId,
  );
  return getCharacterById(characterId)!;
}

export function grantEquipmentToCharacter(
  characterId: number,
  templateId: string,
  randomize = false,
): EquipmentView {
  const tpl = EQUIPMENT_TEMPLATES[templateId];
  if (!tpl) throw new Error('装备模板不存在');

  const roll = (val?: number) => {
    if (!val) return 0;
    if (!randomize) return val;
    const mult = 0.9 + Math.random() * 0.28;
    return Math.max(1, Math.round(val * mult));
  };

  let resPhys = tpl.resPhys ?? 0;
  let resChaos = tpl.resChaos ?? 0;
  let resSeal = tpl.resSeal ?? 0;
  let resTrap = tpl.resTrap ?? 0;
  let resMagic = tpl.resMagic ?? 0;
  let name = tpl.name;

  // Dropped / dug gear has a chance to roll an extra classic resistance affix
  if (randomize && Math.random() < 0.35) {
    const extra = 3 + Math.floor(Math.random() * 4);
    const pick = Math.floor(Math.random() * 5);
    if (pick === 0) resPhys += extra;
    else if (pick === 1) resChaos += extra;
    else if (pick === 2) resSeal += extra;
    else if (pick === 3) resTrap += extra;
    else resMagic += extra;
    name = `极品·${tpl.name}`;
  }

  const hpBonus = roll(tpl.hpBonus);
  const mpBonus = roll(tpl.mpBonus);
  const atkBonus = roll(tpl.atkBonus);
  const defBonus = roll(tpl.defBonus);
  const spdBonus = roll(tpl.spdBonus);
  const sellSilver = Math.max(30, Math.round(tpl.priceSilver * 0.4));

  const info = db
    .prepare(
      `INSERT INTO character_equipment (
        character_id, template_id, name, slot, quality, icon, level_req,
        hp_bonus, mp_bonus, atk_bonus, def_bonus, spd_bonus,
        res_phys, res_chaos, res_seal, res_trap, res_magic,
        sell_silver, equipped, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(
      characterId,
      tpl.templateId,
      name,
      tpl.slot,
      tpl.quality,
      tpl.icon,
      tpl.levelReq,
      hpBonus,
      mpBonus,
      atkBonus,
      defBonus,
      spdBonus,
      resPhys,
      resChaos,
      resSeal,
      resTrap,
      resMagic,
      sellSilver,
      Date.now(),
    );

  return {
    id: Number(info.lastInsertRowid),
    templateId: tpl.templateId,
    name,
    slot: tpl.slot,
    quality: tpl.quality,
    icon: tpl.icon,
    levelReq: tpl.levelReq,
    hpBonus,
    mpBonus,
    atkBonus,
    defBonus,
    spdBonus,
    resPhys,
    resChaos,
    resSeal,
    resTrap,
    resMagic,
    sellSilver,
    equipped: false,
  };
}

export function buyEquipment(characterId: number, templateId: string): CharacterView {
  const tpl = EQUIPMENT_TEMPLATES[templateId];
  if (!tpl || !tpl.shopAvailable) throw new Error('商店暂不出售该装备');
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  if (ch.equipment.length >= 30) throw new Error('装备栏已满（最多 30 件），请先出售多余装备');
  if (ch.silver < tpl.priceSilver) throw new Error(`银两不足，需要 ${tpl.priceSilver} 两`);

  db.prepare('UPDATE characters SET silver = silver - ?, updated_at = ? WHERE id = ?').run(
    tpl.priceSilver,
    Date.now(),
    characterId,
  );
  grantEquipmentToCharacter(characterId, templateId, false);
  return getCharacterById(characterId)!;
}

export function equipItem(characterId: number, equipId: number): CharacterView {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const target = ch.equipment.find((e) => e.id === equipId);
  if (!target) throw new Error('装备不存在');
  if (ch.level < target.levelReq) {
    throw new Error(`需要 ${target.levelReq} 级才能穿戴【${target.name}】`);
  }

  db.prepare('UPDATE character_equipment SET equipped = 0 WHERE character_id = ? AND slot = ?').run(
    characterId,
    target.slot,
  );
  db.prepare('UPDATE character_equipment SET equipped = 1 WHERE id = ? AND character_id = ?').run(
    equipId,
    characterId,
  );

  const updated = getCharacterById(characterId)!;
  const nextHp = Math.min(updated.maxHp, ch.hp + Math.max(0, target.hpBonus));
  const nextMp = Math.min(updated.maxMp, ch.mp + Math.max(0, target.mpBonus));
  db.prepare('UPDATE characters SET hp = ?, mp = ?, max_hp = ?, max_mp = ?, updated_at = ? WHERE id = ?').run(
    nextHp,
    nextMp,
    updated.maxHp,
    updated.maxMp,
    Date.now(),
    characterId,
  );
  return getCharacterById(characterId)!;
}

export function unequipSlot(characterId: number, slot: EquipmentSlot): CharacterView {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  db.prepare('UPDATE character_equipment SET equipped = 0 WHERE character_id = ? AND slot = ?').run(
    characterId,
    slot,
  );
  const updated = getCharacterById(characterId)!;
  db.prepare(
    'UPDATE characters SET hp = MIN(hp, ?), mp = MIN(mp, ?), max_hp = ?, max_mp = ?, updated_at = ? WHERE id = ?',
  ).run(updated.maxHp, updated.maxMp, updated.maxHp, updated.maxMp, Date.now(), characterId);
  return getCharacterById(characterId)!;
}

export function sellEquipment(characterId: number, equipId: number): CharacterView {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const target = ch.equipment.find((e) => e.id === equipId);
  if (!target) throw new Error('装备不存在');
  if (target.equipped) throw new Error('请先卸下该装备再出售');

  db.prepare('DELETE FROM character_equipment WHERE id = ? AND character_id = ?').run(
    equipId,
    characterId,
  );
  db.prepare('UPDATE characters SET silver = silver + ?, updated_at = ? WHERE id = ?').run(
    target.sellSilver,
    Date.now(),
    characterId,
  );
  return getCharacterById(characterId)!;
}

export function digTreasureMap(characterId: number): {
  result: TreasureDigResult;
  character: CharacterView;
} {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const owned = ch.inventory.find((i) => i.itemId === 'baotu');
  if (!owned || owned.quantity <= 0) throw new Error('行囊中没有藏宝图');

  addItem(characterId, 'baotu', -1);

  const roll = Math.random();
  let result: TreasureDigResult;

  if (roll < 0.42 && ch.equipment.length < 30) {
    // Classic treasure pool (includes rare & legend gear / mounts!)
    const r2 = Math.random();
    let pool: string[];
    if (r2 < 0.14) {
      pool = ['chitu_ma', 'longdan_qiang', 'huangjin_jia'];
    } else if (r2 < 0.45) {
      pool = ['dilu_ma', 'qixing_jian', 'zijin_guan', 'bagua_pao', 'jifeng_xue'];
    } else {
      pool = ['wuzhui_ma', 'bailian_dao', 'tiekui', 'suozi_jia', 'tayun_lv'];
    }
    const tplId = pool[Math.floor(Math.random() * pool.length)];
    const eq = grantEquipmentToCharacter(characterId, tplId, true);
    result = {
      outcome: 'equipment',
      equipment: eq,
      message: `铁铲一响，竟挖出了一件【${eq.name}】！`,
    };
  } else if (roll < 0.68) {
    const silver = 280 + Math.floor(Math.random() * 720);
    db.prepare('UPDATE characters SET silver = silver + ?, updated_at = ? WHERE id = ?').run(
      silver,
      Date.now(),
      characterId,
    );
    result = {
      outcome: 'silver',
      silver,
      message: `你在荒丘下掘出一坛古钱，获得银两 ${silver} 两！`,
    };
  } else if (roll < 0.8) {
    const gold = 20 + Math.floor(Math.random() * 45);
    db.prepare('UPDATE characters SET gold = gold + ?, updated_at = ? WHERE id = ?').run(
      gold,
      Date.now(),
      characterId,
    );
    result = {
      outcome: 'gold',
      gold,
      message: `金光闪现！你在古墓石匣中寻得金砖 ${gold} 块！`,
    };
  } else if (roll < 0.92) {
    const itemId = Math.random() < 0.5 ? 'dahuan' : 'jiangling';
    const qty = itemId === 'dahuan' ? 2 : 1;
    addItem(characterId, itemId, qty);
    result = {
      outcome: 'item',
      item: { itemId, name: ITEMS[itemId].name, quantity: qty },
      message: `你翻出一个旧行囊，获得【${ITEMS[itemId].name}】×${qty}！`,
    };
  } else {
    result = {
      outcome: 'nothing',
      message: '你吭哧吭哧挖了半天，只挖出一只破草鞋，看来前人已捷足先登……',
    };
  }

  return {
    result,
    character: getCharacterById(characterId)!,
  };
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
  let levelsGained = 0;

  while (exp >= expRequiredForLevel(level) && level < 140) {
    exp -= expRequiredForLevel(level);
    level++;
    levelsGained++;
  }

  const leveledUp = levelsGained > 0;
  const freePointsGain = levelsGained * 4;
  const resPointsGain = levelsGained * 1;
  const stats = calcRoleStats(ch.roleClass, level, ch.alloc);
  const effMaxHp = stats.maxHp + ch.equipBonus.hp;
  const effMaxMp = stats.maxMp + ch.equipBonus.mp;
  const finalHp = leveledUp ? effMaxHp : Math.max(1, Math.min(effMaxHp, hpAfter ?? ch.hp));
  const finalMp = leveledUp ? effMaxMp : Math.max(0, Math.min(effMaxMp, mpAfter ?? ch.mp));

  db.prepare(
    `UPDATE characters
     SET level = ?, exp = ?, hp = ?, max_hp = ?, mp = ?, max_mp = ?,
         atk = ?, def = ?, spd = ?, silver = silver + ?,
         free_points = free_points + ?, res_points = res_points + ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    level,
    exp,
    finalHp,
    effMaxHp,
    finalMp,
    effMaxMp,
    stats.atk + ch.equipBonus.atk,
    stats.def + ch.equipBonus.def,
    stats.spd + ch.equipBonus.spd,
    silverGain,
    freePointsGain,
    resPointsGain,
    Date.now(),
    characterId,
  );

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
  opts: {
    silver?: number;
    gold?: number;
    exp?: number;
    fullHeal?: boolean;
    grantGeneralId?: string;
    grantEquipId?: string;
    grantBaotu?: number;
  },
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
  if (opts.grantEquipId && EQUIPMENT_TEMPLATES[opts.grantEquipId]) {
    grantEquipmentToCharacter(characterId, opts.grantEquipId, true);
  }
  if (opts.grantBaotu && opts.grantBaotu > 0) {
    addItem(characterId, 'baotu', Math.min(20, opts.grantBaotu));
  }
  return getCharacterById(characterId)!;
}
