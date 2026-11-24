import {
  calcEquipmentSetBonuses,
  calcRoleStats,
  CRAFT_RECIPES,
  ENEMY_GROUPS,
  EQUIPMENT_SETS,
  EQUIPMENT_TEMPLATES,
  expRequiredForLevel,
  GENERAL_SKILL_BOOKS,
  GENERAL_TEMPLATES,
  getGeneralIntimacyInfo,
  getCurrentWorldBoss,
  getSkillMaxTargets,
  getSkillTier,
  getTowerFloorMeta,
  ITEMS,
  KEJU_QUESTIONS,
  MAIN_QUESTS,
  MAPS,
  REALMS,
  ROLE_CLASS_META,
  SKILLS,
  TEMPLATE_SET_MAP,
  TOWER_MAX_FLOOR,
  WORLD_BOSS_ROSTER,
  type CasinoBetPlacementResult,
  type CasinoBetView,
  type CasinoChibiChoice,
  type CasinoCurrency,
  type CasinoDiceChoice,
  type CasinoGameStateView,
  type CasinoGameType,
  type CasinoLeaderboardEntry,
  type CasinoRoundView,
  type CasinoStateView,
  type CasinoWinnerEntry,
  type CharacterQuestState,
  type CharacterView,
  type DailyStateView,
  type EquipmentBonusSummary,
  type EquipmentQuality,
  type EquipmentSlot,
  type EquipmentView,
  type FriendView,
  type Gender,
  type GeneralView,
  type InventoryItemView,
  type MailView,
  type MainQuestView,
  type MarketListingKind,
  type MarketListingView,
  type PaohuanStateView,
  type PlayerInspectView,
  type QuestObjectiveKind,
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
  tower_floor?: number;
  tower_sweep_date?: string | null;
  bank_silver?: number;
  bank_gold?: number;
  arena_wins?: number;
  arena_losses?: number;
  arena_daily_rewards?: number;
  arena_reward_date?: string | null;
  keju_date?: string | null;
  keju_answered?: number;
  keju_correct?: number;
  escort_date?: string | null;
  escort_status?: string | null;
  escort_origin_map_id?: string | null;
  escort_target_map_id?: string | null;
  world_boss_date?: string | null;
  paohuan_gold_date?: string | null;
  paohuan_gold_rounds?: number;
  rebirth?: number;
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
  base_hp: number;
  base_mp: number;
  base_atk: number;
  base_spd: number;
  growth: number;
  rebirth: number;
  rarity: EquipmentQuality;
  skill_id: string;
  skill2_id: string | null;
  intimacy: number;
  loyalty?: number;
  slot: number | null;
}

function calcGeneralStatsAtLevel(
  base: { hp: number; mp: number; atk: number; spd: number },
  growth: number,
  level: number,
) {
  const lv = Math.max(1, level);
  const lateLv = Math.max(0, lv - 20);
  // Differentiate low-tier starters (dipi ~1.02) from mid/top 1转-2转 generals (1.28-1.60+)
  const tierScale = Math.max(0.2, (growth - 0.92) * 2.5);
  return {
    maxHp: Math.round(base.hp + (lv - 1) * 22 * growth + lateLv * 44 * tierScale),
    maxMp: Math.round(base.mp + (lv - 1) * 12 * growth + lateLv * 9 * tierScale),
    atk: Math.round(base.atk + (lv - 1) * 5.8 * growth + lateLv * 7.2 * tierScale),
    spd: Math.round(base.spd + (lv - 1) * 3.2 * growth + lateLv * 2.0 * tierScale),
  };
}

function rollGeneralBuild(templateId: string, rebirth = 0) {
  const tpl = GENERAL_TEMPLATES[templateId];
  if (!tpl) throw new Error('副将模板不存在');
  const gMin = tpl.growthMin;
  const gMax = tpl.growthMax;
  const gRatio = Math.random();
  const baseGrowth = gMin + gRatio * (gMax - gMin);
  const growth = Math.round((baseGrowth + rebirth * 0.1) * 100) / 100;

  const rebirthMult = 1 + rebirth * 0.15;
  const rollBase = (val: number) =>
    Math.max(10, Math.round(val * rebirthMult * (0.88 + Math.random() * 0.26)));

  const baseHp = rollBase(tpl.baseHp);
  const baseMp = rollBase(tpl.baseMp);
  const baseAtk = rollBase(tpl.baseAtk);
  const baseSpd = rollBase(tpl.baseSpd);

  const avgBaseScore =
    (baseHp / (tpl.baseHp * rebirthMult) +
      baseAtk / (tpl.baseAtk * rebirthMult) +
      baseSpd / (tpl.baseSpd * rebirthMult)) /
    3;
  const score = gRatio * 0.65 + Math.max(0, Math.min(1, (avgBaseScore - 0.88) / 0.26)) * 0.35;

  let rarity: EquipmentQuality = 'common';
  if (score >= 0.86 || rebirth >= 2) rarity = 'legend';
  else if (score >= 0.65 || rebirth >= 1) rarity = 'rare';
  else if (score >= 0.38) rarity = 'fine';

  return { tpl, baseHp, baseMp, baseAtk, baseSpd, growth, rarity };
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
  set_id?: string | null;
  roll_pct?: number;
}

function getEquipmentList(characterId: number): {
  equipment: EquipmentView[];
  bonus: EquipmentBonusSummary;
  setBonuses: string[];
} {
  const rows = db
    .prepare('SELECT * FROM character_equipment WHERE character_id = ? ORDER BY equipped DESC, id DESC')
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

  const heroEquippedItems: EquipmentView[] = [];
  const equipment: EquipmentView[] = rows.map((r) => {
    const equipped = Boolean(r.equipped);
    const setId = r.set_id || TEMPLATE_SET_MAP[r.template_id] || null;
    const setName = setId ? EQUIPMENT_SETS[setId]?.name ?? null : null;
    const view: EquipmentView = {
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
      setId,
      setName,
      rollPct: r.roll_pct ?? 100,
    };
    if (equipped) {
      heroEquippedItems.push(view);
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
    return view;
  });

  const setBonus = calcEquipmentSetBonuses(heroEquippedItems);
  bonus.hp += setBonus.hp;
  bonus.mp += setBonus.mp;
  bonus.atk += setBonus.atk;
  bonus.def += setBonus.def;
  bonus.spd += setBonus.spd;
  bonus.resPhys += setBonus.allRes;
  bonus.resChaos += setBonus.allRes;
  bonus.resSeal += setBonus.allRes;
  bonus.resTrap += setBonus.allRes;
  bonus.resMagic += setBonus.allRes;

  return { equipment, bonus, setBonuses: setBonus.descriptions };
}

function hydrateCharacter(row: CharacterRow): CharacterView {
  const acc = db.prepare('SELECT is_gm FROM accounts WHERE id = ?').get(row.account_id) as
    | { is_gm: number }
    | undefined;

  const { equipment, bonus, setBonuses } = getEquipmentList(row.id);
  const alloc = {
    freePoints: row.free_points ?? 0,
    vit: row.pt_vit ?? 0,
    str: row.pt_str ?? 0,
    int: row.pt_int ?? 0,
    agi: row.pt_agi ?? 0,
  };
  const rebirth = Math.max(0, row.rebirth ?? 0);
  const resCap = 75 + rebirth * 10;
  const baseStats = calcRoleStats(row.role_class, row.level, alloc, rebirth);
  const effectiveMaxHp = baseStats.maxHp + bonus.hp;
  const effectiveMaxMp = baseStats.maxMp + bonus.mp;
  const effectiveAtk = baseStats.atk + bonus.atk;
  const effectiveDef = baseStats.def + bonus.def;
  const effectiveSpd = baseStats.spd + bonus.spd;

  const generalRows = db
    .prepare('SELECT * FROM generals WHERE character_id = ? ORDER BY slot IS NULL, slot ASC, id ASC')
    .all(row.id) as unknown as GeneralRow[];

  const generals: GeneralView[] = generalRows.map((g) => {
    const tpl = GENERAL_TEMPLATES[g.template_id];
    const skillId = g.skill_id || tpl?.skillId || 'liandao';
    const skillDef = SKILLS.find((s) => s.id === skillId);
    const skill2Id = g.skill2_id || null;
    const skill2Def = skill2Id ? SKILLS.find((s) => s.id === skill2Id) : undefined;
    const intimacy = Math.max(0, Math.min(100, g.intimacy ?? 0));
    const loyalty = Math.max(0, Math.min(100, g.loyalty ?? 100));
    const intInfo = getGeneralIntimacyInfo(intimacy);
    const statMult = 1 + intInfo.statPct / 100;
    const baseHp = g.base_hp || tpl?.baseHp || g.max_hp;
    const baseMp = g.base_mp || tpl?.baseMp || g.max_mp;
    const baseAtk = g.base_atk || tpl?.baseAtk || g.atk;
    const baseSpd = g.base_spd || tpl?.baseSpd || g.spd;
    const computed = calcGeneralStatsAtLevel(
      { hp: baseHp, mp: baseMp, atk: baseAtk, spd: baseSpd },
      g.growth,
      g.level,
    );
    const effMaxHp = Math.round(computed.maxHp * statMult);
    const effAtk = Math.round(computed.atk * statMult);
    return {
      id: g.id,
      templateId: g.template_id,
      name: g.name,
      roleClass: g.role_class,
      spriteKey: g.sprite_key,
      avatarKey: tpl?.avatarKey || g.avatar_key,
      level: g.level,
      exp: g.exp,
      expToNext: expRequiredForLevel(g.level),
      hp: Math.min(effMaxHp, Math.max(1, Math.round(g.hp * statMult))),
      maxHp: effMaxHp,
      mp: Math.min(computed.maxMp, g.mp),
      maxMp: computed.maxMp,
      atk: effAtk,
      spd: computed.spd,
      baseHp,
      baseMp,
      baseAtk,
      baseSpd,
      growth: g.growth,
      rebirth: g.rebirth ?? 0,
      rarity: (g.rarity as EquipmentQuality) || 'common',
      skillId,
      skillName: skillDef?.name ?? '力劈华山',
      skill2Id,
      skill2Name: skill2Def?.name ?? null,
      intimacy,
      intimacyTitle: intInfo.title,
      intimacyStatPct: intInfo.statPct,
      intimacyResistBonus: intInfo.resistBonus,
      loyalty,
      slot: g.slot,
    };
  });

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
        reviveHpPct: tpl.reviveHpPct,
        loyaltyRestore: tpl.loyaltyRestore,
        priceSilver: tpl.priceSilver,
        priceGold: tpl.priceGold,
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
    portrait:
      row.gender === 'female' && row.portrait === ROLE_CLASS_META[row.role_class].portrait
        ? ROLE_CLASS_META[row.role_class].femalePortrait
        : row.portrait,
    level: row.level,
    rebirth,
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
    bank: {
      silver: row.bank_silver ?? 0,
      gold: row.bank_gold ?? 0,
    },
    mapId: row.map_id,
    isGm: Boolean(acc?.is_gm),
    alloc,
    resist: {
      freePoints: row.res_points ?? 0,
      phys: Math.min(resCap, (row.res_phys ?? 0) + bonus.resPhys),
      chaos: Math.min(resCap, (row.res_chaos ?? 0) + bonus.resChaos),
      seal: Math.min(resCap, (row.res_seal ?? 0) + bonus.resSeal),
      trap: Math.min(resCap, (row.res_trap ?? 0) + bonus.resTrap),
      magic: Math.min(resCap, (row.res_magic ?? 0) + bonus.resMagic),
    },
    equipBonus: bonus,
    equipment,
    setBonuses,
    skills,
    generals,
    inventory,
    quests: hydrateQuestState(row.id, row.level),
    tower: buildTowerState(row.tower_floor ?? 0, row.tower_sweep_date ?? null),
    arena: {
      wins: row.arena_wins ?? 0,
      losses: row.arena_losses ?? 0,
      dailyRewardsLeft: Math.max(
        0,
        5 - (row.arena_reward_date === getTodayDateStr() ? (row.arena_daily_rewards ?? 0) : 0),
      ),
    },
    daily: buildDailyState(row),
    unreadMailCount: (
      db
        .prepare('SELECT COUNT(*) AS cnt FROM mails WHERE recipient_id = ? AND is_read = 0')
        .get(row.id) as { cnt: number }
    ).cnt,
    friendsCount: (
      db
        .prepare('SELECT COUNT(*) AS cnt FROM friends WHERE character_id = ?')
        .get(row.id) as { cnt: number }
    ).cnt,
  };
}

function getTodayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildTowerState(highestFloor: number, sweepDate: string | null) {
  const safeFloor = Math.max(0, Math.min(TOWER_MAX_FLOOR, highestFloor));
  const nextFloor = Math.min(TOWER_MAX_FLOOR, safeFloor + 1);
  const meta = getTowerFloorMeta(nextFloor);
  return {
    highestFloor: safeFloor,
    maxFloor: TOWER_MAX_FLOOR,
    dailySwept: sweepDate === getTodayDateStr(),
    nextFloorName: safeFloor >= TOWER_MAX_FLOOR ? `已登顶天玄塔第 ${TOWER_MAX_FLOOR} 层` : meta.name,
    nextFloorRecLevel: meta.recLevel,
    nextFloorMilestone: safeFloor >= TOWER_MAX_FLOOR ? undefined : meta.milestone,
  };
}

function calcPaohuanReward(level: number, ring: number) {
  const safeRing = Math.max(1, Math.min(10, ring));
  const lateExpBonus = level > 15 ? Math.round(Math.pow(level - 15, 1.55) * 28) : 0;
  const lateSilverBonus = level > 15 ? Math.round((level - 15) * 14) : 0;
  const exp = Math.round((75 + level * 48 + lateExpBonus) * (1 + (safeRing - 1) * 0.22));
  const silver = Math.round((50 + level * 15 + lateSilverBonus) * (1 + (safeRing - 1) * 0.18));
  let bonusHint: string | undefined;
  if (safeRing === 10) {
    bonusHint = '第 10 环大满贯：必得金砖 +25、稀有道具与同等级段精良/极品装备！';
  } else if (safeRing === 5) {
    bonusHint = '第 5 环节点：额外加赠 副将经验丹 或 藏宝图 ×1！';
  }
  return { exp, silver, bonusHint };
}

function hydrateQuestState(characterId: number, level: number): CharacterQuestState {
  const mainRows = db
    .prepare('SELECT quest_id, status, progress FROM character_main_quests WHERE character_id = ?')
    .all(characterId) as unknown as Array<{
    quest_id: string;
    status: string;
    progress: number;
  }>;
  const rowMap = new Map(mainRows.map((r) => [r.quest_id, r]));

  let prevClaimed = true;
  let activeMainQuestId: string | null = null;

  const mainQuests: MainQuestView[] = MAIN_QUESTS.map((def) => {
    const rec = rowMap.get(def.questId);
    let status: MainQuestView['status'];
    let progress = rec?.progress ?? 0;

    if (rec?.status === 'claimed') {
      status = 'claimed';
      progress = def.requiredCount;
    } else if (rec?.status === 'active') {
      status = progress >= def.requiredCount ? 'ready' : 'active';
      activeMainQuestId = def.questId;
      prevClaimed = false;
    } else if (prevClaimed) {
      status = 'available';
      prevClaimed = false;
    } else {
      status = 'locked';
    }

    const equipTpl = def.rewards.equipTemplateId
      ? EQUIPMENT_TEMPLATES[def.rewards.equipTemplateId]
      : undefined;
    const genTpl = def.rewards.generalTemplateId
      ? GENERAL_TEMPLATES[def.rewards.generalTemplateId]
      : undefined;
    const itemTpl = def.rewards.item ? ITEMS[def.rewards.item.itemId] : undefined;

    return {
      questId: def.questId,
      chapter: def.chapter,
      title: def.title,
      recLevel: def.recLevel,
      npcName: def.npcName,
      dialogue: def.dialogue,
      objectiveKind: def.objectiveKind,
      targetId: def.targetId,
      targetName: def.targetName,
      targetMapId: def.targetMapId,
      targetMapName: MAPS[def.targetMapId]?.name ?? def.targetMapId,
      requiredCount: def.requiredCount,
      progress: Math.min(def.requiredCount, progress),
      status,
      rewards: {
        exp: def.rewards.exp,
        silver: def.rewards.silver,
        gold: def.rewards.gold,
        item:
          def.rewards.item && itemTpl
            ? { itemId: itemTpl.itemId, name: itemTpl.name, quantity: def.rewards.item.quantity }
            : undefined,
        equipTemplateId: equipTpl?.templateId,
        equipName: equipTpl?.name,
        generalTemplateId: genTpl?.templateId,
        generalName: genTpl?.name,
      },
    };
  });

  const phRow = db
    .prepare('SELECT * FROM character_paohuan WHERE character_id = ?')
    .get(characterId) as
    | {
        ring: number;
        completed_rounds: number;
        status: 'idle' | 'active' | 'ready';
        task_type: QuestObjectiveKind | null;
        target_id: string | null;
        target_name: string | null;
        target_map_id: string | null;
        required_count: number;
        progress: number;
      }
    | undefined;

  const ring = phRow?.ring ?? 1;
  const reward = calcPaohuanReward(level, ring);
  const status: PaohuanStateView['status'] = phRow
    ? phRow.status === 'active' && phRow.progress >= phRow.required_count
      ? 'ready'
      : phRow.status
    : 'idle';

  const today = getTodayDateStr();
  const goldRow = db
    .prepare('SELECT paohuan_gold_date, paohuan_gold_rounds FROM characters WHERE id = ?')
    .get(characterId) as { paohuan_gold_date?: string | null; paohuan_gold_rounds?: number } | undefined;
  const dailyGoldRoundsUsed =
    goldRow?.paohuan_gold_date === today ? Math.max(0, goldRow.paohuan_gold_rounds ?? 0) : 0;
  const dailyGoldRoundsMax = 3;

  const paohuan: PaohuanStateView = {
    ring,
    completedRounds: phRow?.completed_rounds ?? 0,
    status,
    taskType: phRow?.task_type ?? undefined,
    targetId: phRow?.target_id ?? undefined,
    targetName: phRow?.target_name ?? undefined,
    targetMapId: phRow?.target_map_id ?? undefined,
    targetMapName: phRow?.target_map_id ? (MAPS[phRow.target_map_id]?.name ?? phRow.target_map_id) : undefined,
    requiredCount: phRow?.required_count ?? 1,
    progress: phRow?.progress ?? 0,
    rewardExp: reward.exp,
    rewardSilver: reward.silver,
    bonusHint:
      ring === 10 && dailyGoldRoundsUsed >= dailyGoldRoundsMax
        ? '第 10 环大满贯：必得稀有道具与精良/极品装备（今日 3 轮跑环金砖已领满）！'
        : reward.bonusHint,
    dailyGoldRoundsUsed,
    dailyGoldRoundsMax,
  };

  return {
    mainQuests,
    activeMainQuestId,
    paohuan,
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
  if (realm.hidden) throw new Error('该服务器分区暂未开放');

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
  const classMeta = ROLE_CLASS_META[params.roleClass];
  const portrait = params.gender === 'female' ? classMeta.femalePortrait : classMeta.portrait;
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
  addItem(characterId, 'jingyandan', 1);
  addItem(characterId, 'xisuidan', 1);

  // Auto-accept Chapter 1 main quest for new characters
  db.prepare(
    `INSERT OR IGNORE INTO character_main_quests (character_id, quest_id, status, progress, updated_at)
     VALUES (?, 'main_01', 'active', 0, ?)`,
  ).run(characterId, now);

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
  const stats = calcRoleStats(ch.roleClass, ch.level, nextAlloc, ch.rebirth);
  const effMaxHp = stats.maxHp + ch.equipBonus.hp;
  const effMaxMp = stats.maxMp + ch.equipBonus.mp;
  const nextHp = Math.min(effMaxHp, ch.hp + dVit * 18);
  const nextMp = Math.min(effMaxMp, ch.mp + dInt * 16);

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
    effMaxHp,
    nextMp,
    effMaxMp,
    stats.atk + ch.equipBonus.atk,
    stats.def + ch.equipBonus.def,
    stats.spd + ch.equipBonus.spd,
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
  const stats = calcRoleStats(ch.roleClass, ch.level, { vit: 0, str: 0, int: 0, agi: 0 }, ch.rebirth);
  const effMaxHp = stats.maxHp + ch.equipBonus.hp;
  const effMaxMp = stats.maxMp + ch.equipBonus.mp;
  db.prepare(
    `UPDATE characters
     SET free_points = free_points + ?,
         pt_vit = 0, pt_str = 0, pt_int = 0, pt_agi = 0,
         hp = MIN(hp, ?), max_hp = ?, mp = MIN(mp, ?), max_mp = ?, atk = ?, def = ?, spd = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    refunded,
    effMaxHp,
    effMaxHp,
    effMaxMp,
    effMaxMp,
    stats.atk + ch.equipBonus.atk,
    stats.def + ch.equipBonus.def,
    stats.spd + ch.equipBonus.spd,
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

  const rawRow = db
    .prepare('SELECT res_phys, res_chaos, res_seal, res_trap, res_magic FROM characters WHERE id = ?')
    .get(characterId) as unknown as {
    res_phys: number;
    res_chaos: number;
    res_seal: number;
    res_trap: number;
    res_magic: number;
  };
  const resCap = 75 + ch.rebirth * 10;
  const nextPhys = (rawRow.res_phys ?? 0) + dPhys * 3;
  const nextChaos = (rawRow.res_chaos ?? 0) + dChaos * 3;
  const nextSeal = (rawRow.res_seal ?? 0) + dSeal * 3;
  const nextTrap = (rawRow.res_trap ?? 0) + dTrap * 3;
  const nextMagic = (rawRow.res_magic ?? 0) + dMagic * 3;

  if (Math.max(nextPhys, nextChaos, nextSeal, nextTrap, nextMagic) > resCap) {
    throw new Error(`单项抗性上限为 ${resCap}%`);
  }

  db.prepare(
    `UPDATE characters
     SET res_points = res_points - ?,
         res_phys = ?, res_chaos = ?, res_seal = ?, res_trap = ?, res_magic = ?, updated_at = ?
     WHERE id = ?`,
  ).run(total, nextPhys, nextChaos, nextSeal, nextTrap, nextMagic, Date.now(), characterId);

  return getCharacterById(characterId)!;
}

export function rebirthCharacter(characterId: number): {
  character: CharacterView;
  message: string;
  broadcast: string;
} {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  if (ch.rebirth >= 1) throw new Error('首期版本已达最高 1 转境界！');
  if (ch.level < 60) throw new Error('主角需达到 60 级方可破境一转！');

  const nextRebirth = ch.rebirth + 1;
  const baseStats = calcRoleStats(ch.roleClass, 1, { vit: 0, str: 0, int: 0, agi: 0 }, nextRebirth);
  const effMaxHp = baseStats.maxHp + ch.equipBonus.hp;
  const effMaxMp = baseStats.maxMp + ch.equipBonus.mp;
  const bonusFreePoints = 4 + nextRebirth * 30;

  db.prepare(
    `UPDATE characters
     SET level = 1, exp = 0, rebirth = ?,
         free_points = ?, pt_vit = 0, pt_str = 0, pt_int = 0, pt_agi = 0,
         res_points = res_points + 10,
         hp = ?, max_hp = ?, mp = ?, max_mp = ?, atk = ?, def = ?, spd = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    nextRebirth,
    bonusFreePoints,
    effMaxHp,
    effMaxHp,
    effMaxMp,
    effMaxMp,
    baseStats.atk + ch.equipBonus.atk,
    baseStats.def + ch.equipBonus.def,
    baseStats.spd + ch.equipBonus.spd,
    Date.now(),
    characterId,
  );

  const updated = getCharacterById(characterId)!;
  return {
    character: updated,
    message: `🌟 恭喜破境【一转重生】！永久获赠 +30 自由属性点、+10 抗性点、成长属性 +15%、全抗上限 85%，并保留全部装备/副将/熟练度！`,
    broadcast: `【大道一转】绝世豪杰 ${ch.name} 功德圆满，于 60 级成功破境【一转重生】，威震三国！`,
  };
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
  recordQuestMapVisit(characterId, targetMapId);
  return getCharacterById(characterId)!;
}

export function acceptMainQuest(
  characterId: number,
  questId?: string,
): { character: CharacterView; message: string } {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const nextQuest = questId
    ? ch.quests.mainQuests.find((q) => q.questId === questId)
    : ch.quests.mainQuests.find((q) => q.status === 'available');
  if (!nextQuest || nextQuest.status !== 'available') {
    throw new Error('当前没有可接取的主线任务');
  }
  const initProgress =
    nextQuest.objectiveKind === 'visit_map' && ch.mapId === nextQuest.targetMapId
      ? nextQuest.requiredCount
      : 0;
  db.prepare(
    `INSERT OR REPLACE INTO character_main_quests (character_id, quest_id, status, progress, updated_at)
     VALUES (?, ?, 'active', ?, ?)`,
  ).run(characterId, nextQuest.questId, initProgress, Date.now());
  return {
    character: getCharacterById(characterId)!,
    message: `已接取主线【第${nextQuest.chapter}章 · ${nextQuest.title}】！`,
  };
}

export function claimMainQuest(
  characterId: number,
  questId?: string,
): { character: CharacterView; message: string } {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const target = questId
    ? ch.quests.mainQuests.find((q) => q.questId === questId)
    : ch.quests.mainQuests.find((q) => q.status === 'ready');
  if (!target || target.status !== 'ready') {
    throw new Error('该主线任务尚未达成条件');
  }
  const def = MAIN_QUESTS.find((q) => q.questId === target.questId);
  if (!def) throw new Error('任务配置不存在');

  db.prepare(
    `UPDATE character_main_quests SET status = 'claimed', progress = ?, updated_at = ?
     WHERE character_id = ? AND quest_id = ?`,
  ).run(def.requiredCount, Date.now(), characterId, def.questId);

  const expRes = applyExpAndSilver(characterId, def.rewards.exp, def.rewards.silver);
  const rewardParts: string[] = [`经验+${expRes.appliedExp}`, `银两+${def.rewards.silver}`];

  if (def.rewards.gold && def.rewards.gold > 0) {
    db.prepare('UPDATE characters SET gold = gold + ?, updated_at = ? WHERE id = ?').run(
      def.rewards.gold,
      Date.now(),
      characterId,
    );
    rewardParts.push(`金砖+${def.rewards.gold}`);
  }
  if (def.rewards.item) {
    addItem(characterId, def.rewards.item.itemId, def.rewards.item.quantity);
    const itName = ITEMS[def.rewards.item.itemId]?.name ?? def.rewards.item.itemId;
    rewardParts.push(`${itName}×${def.rewards.item.quantity}`);
  }
  if (def.rewards.equipTemplateId && EQUIPMENT_TEMPLATES[def.rewards.equipTemplateId]) {
    const latest = getCharacterById(characterId)!;
    if (latest.equipment.length < 30) {
      const eq = grantEquipmentToCharacter(characterId, def.rewards.equipTemplateId, false);
      rewardParts.push(`装备【${eq.name}】`);
    } else {
      db.prepare('UPDATE characters SET silver = silver + 500 WHERE id = ?').run(characterId);
      rewardParts.push('装备栏满折现银两+500');
    }
  }
  if (def.rewards.generalTemplateId && GENERAL_TEMPLATES[def.rewards.generalTemplateId]) {
    const latest = getCharacterById(characterId)!;
    if (latest.generals.length < 12) {
      const g = grantGeneralToCharacter(characterId, def.rewards.generalTemplateId, Math.max(1, latest.level));
      rewardParts.push(`副将【${g.name}】`);
    } else {
      addItem(characterId, 'jiangling', 1);
      rewardParts.push('副将栏满改赠【招贤令】×1');
    }
  }

  return {
    character: getCharacterById(characterId)!,
    message: `完成主线【${def.title}】！获得 ${rewardParts.join('、')}`,
  };
}

export function acceptPaohuan(characterId: number): { character: CharacterView; message: string } {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const ph = ch.quests.paohuan;
  if (ph.status === 'active' || ph.status === 'ready') {
    throw new Error('当前已有进行中的跑环任务');
  }

  const ring = ph.ring;
  const doVisit = ring < 10 && Math.random() < 0.32;
  let taskType: QuestObjectiveKind;
  let targetId: string;
  let targetName: string;
  let targetMapId: string;
  let requiredCount = 1;

  if (doVisit) {
    const visitPool = (
      ch.level >= 22
        ? ['zhuojun', 'luoyang', 'jingzhou', 'chibi', 'jiangling']
        : ['zhuojun', 'luoyang', 'xuchang_jiao', 'changshe']
    ).filter((m) => m !== ch.mapId);
    targetMapId = visitPool[Math.floor(Math.random() * visitPool.length)] ?? 'zhuojun';
    taskType = 'visit_map';
    targetId = targetMapId;
    targetName = `火速送信至【${MAPS[targetMapId]?.name ?? targetMapId}】`;
    requiredCount = 1;
  } else {
    let killPool: string[];
    if (ch.level < 5) {
      killPool = ['xuchang_dipi', 'xuchang_shibing'];
    } else if (ch.level < 10) {
      killPool = ['changshe_daoshi'];
    } else if (ch.level < 14) {
      killPool = ['luoyang_weidui', 'hulao_xiliang'];
    } else if (ch.level < 18) {
      killPool = ['hulao_xiliang', 'guandu_yuanjun'];
    } else if (ch.level < 23) {
      killPool = ['guandu_yuanjun', 'chibi_shuijun'];
    } else if (ch.level < 30) {
      killPool = ['chibi_shuijun', 'jiangling_caojun'];
    } else if (ch.level < 38) {
      killPool = ['jiangling_caojun', 'yizhou_chuanjun'];
    } else if (ch.level < 46) {
      killPool = ['yizhou_chuanjun', 'hanzhong_weijun'];
    } else if (ch.level < 53) {
      killPool = ['hanzhong_weijun', 'yiling_wujun'];
    } else {
      killPool = ['yiling_wujun', 'wuzhang_sima'];
    }
    const groupId = killPool[Math.floor(Math.random() * killPool.length)];
    const grp = ENEMY_GROUPS[groupId] ?? ENEMY_GROUPS.xuchang_dipi;
    taskType = 'kill';
    targetId = grp.id;
    targetName = `剿灭【${grp.name}】`;
    targetMapId = grp.mapId;
    requiredCount = ring === 10 || Math.random() < 0.45 ? 2 : 1;
  }

  db.prepare(
    `INSERT INTO character_paohuan (
      character_id, ring, completed_rounds, status, task_type, target_id, target_name, target_map_id, required_count, progress, updated_at
    ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(character_id) DO UPDATE SET
      status = 'active',
      task_type = excluded.task_type,
      target_id = excluded.target_id,
      target_name = excluded.target_name,
      target_map_id = excluded.target_map_id,
      required_count = excluded.required_count,
      progress = 0,
      updated_at = excluded.updated_at`,
  ).run(
    characterId,
    ring,
    ph.completedRounds,
    taskType,
    targetId,
    targetName,
    targetMapId,
    requiredCount,
    Date.now(),
  );

  return {
    character: getCharacterById(characterId)!,
    message: `已接取跑环第 ${ring}/10 环：${targetName}${taskType === 'kill' ? ` ×${requiredCount}` : ''}！`,
  };
}

export function claimPaohuan(characterId: number): { character: CharacterView; message: string } {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const ph = ch.quests.paohuan;
  if (ph.status !== 'ready') {
    throw new Error('当前跑环任务尚未完成');
  }

  const ring = ph.ring;
  const reward = calcPaohuanReward(ch.level, ring);
  const expRes = applyExpAndSilver(characterId, reward.exp, reward.silver);
  const parts: string[] = [`经验+${expRes.appliedExp}`, `银两+${reward.silver}`];

  if (ring === 5) {
    const bonusItem = Math.random() < 0.5 ? 'jingyandan' : 'baotu';
    addItem(characterId, bonusItem, 1);
    parts.push(`第5环礼【${ITEMS[bonusItem].name}】×1`);
  }

  let nextRing = ring + 1;
  let nextRounds = ph.completedRounds;

  if (ring >= 10) {
    nextRing = 1;
    nextRounds += 1;
    const today = getTodayDateStr();
    const usedToday = ph.dailyGoldRoundsUsed ?? 0;
    const maxToday = ph.dailyGoldRoundsMax ?? 3;
    if (usedToday < maxToday) {
      db.prepare(
        `UPDATE characters
         SET gold = gold + 25, paohuan_gold_date = ?, paohuan_gold_rounds = ?, updated_at = ?
         WHERE id = ?`,
      ).run(today, usedToday + 1, Date.now(), characterId);
      parts.push(`金砖+25（今日第 ${usedToday + 1}/${maxToday} 轮）`);
    } else {
      parts.push(`今日跑环金砖已领满 ${maxToday} 轮`);
    }
    const r = Math.random();
    const rareItem = r < 0.4 ? 'jiangling' : r < 0.75 ? 'xisuidan' : 'baotu';
    addItem(characterId, rareItem, 1);
    parts.push(`【${ITEMS[rareItem].name}】×1`);

    const latest = getCharacterById(characterId)!;
    if (latest.equipment.length < 30) {
      const equipPool =
        ch.level >= 48
          ? ['fangtian_ji', 'taiji_fajian', 'tianlong_guan', 'qilin_baojia', 'tengyun_xue', 'bailong_ju']
          : ch.level >= 34
            ? ['zhangba_mao', 'zhuge_yushan', 'wuhou_jin', 'xuanwu_jia', 'lingbo_lv', 'zhuahuang_ma']
            : ch.level >= 22
              ? ['qinglong_dao', 'fengchi_kui', 'mingguang_kai', 'yunlong_xue', 'jueying_ma']
              : ch.level >= 10
                ? ['qixing_jian', 'zijin_guan', 'bagua_pao', 'jifeng_xue', 'dilu_ma']
                : ['bailian_dao', 'tiekui', 'suozi_jia', 'tayun_lv', 'wuzhui_ma'];
      const picked = equipPool[Math.floor(Math.random() * equipPool.length)];
      const eq = grantEquipmentToCharacter(characterId, picked, true);
      parts.push(`装备【${eq.name}】`);
    }
  }

  db.prepare(
    `UPDATE character_paohuan
     SET ring = ?, completed_rounds = ?, status = 'idle',
         task_type = NULL, target_id = NULL, target_name = NULL, target_map_id = NULL,
         required_count = 1, progress = 0, updated_at = ?
     WHERE character_id = ?`,
  ).run(nextRing, nextRounds, Date.now(), characterId);

  return {
    character: getCharacterById(characterId)!,
    message:
      ring >= 10
        ? `🎉 跑环十环大满贯！获得 ${parts.join('、')}`
        : `完成跑环第 ${ring}/10 环！获得 ${parts.join('、')}`,
  };
}

export function abandonPaohuan(characterId: number): { character: CharacterView; message: string } {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  db.prepare(
    `UPDATE character_paohuan
     SET ring = 1, status = 'idle',
         task_type = NULL, target_id = NULL, target_name = NULL, target_map_id = NULL,
         required_count = 1, progress = 0, updated_at = ?
     WHERE character_id = ?`,
  ).run(Date.now(), characterId);
  return {
    character: getCharacterById(characterId)!,
    message: '已放弃当前跑环，环数已重置为第 1 环',
  };
}

export function recordQuestBattleVictory(characterId: number, enemyGroupId: string): string[] {
  const updates: string[] = [];
  const now = Date.now();

  // 1. Main quest kill progress
  const activeMain = db
    .prepare(
      `SELECT id, quest_id, progress FROM character_main_quests
       WHERE character_id = ? AND status = 'active'`,
    )
    .all(characterId) as unknown as Array<{ id: number; quest_id: string; progress: number }>;

  for (const row of activeMain) {
    const def = MAIN_QUESTS.find((q) => q.questId === row.quest_id);
    if (
      def &&
      def.objectiveKind === 'kill' &&
      def.targetId === enemyGroupId &&
      row.progress < def.requiredCount
    ) {
      const next = Math.min(def.requiredCount, row.progress + 1);
      db.prepare('UPDATE character_main_quests SET progress = ?, updated_at = ? WHERE id = ?').run(
        next,
        now,
        row.id,
      );
      updates.push(
        `主线【${def.title}】(${next}/${def.requiredCount})${next >= def.requiredCount ? ' 已达成，可领奖！' : ''}`,
      );
    }
  }

  // 2. Paohuan kill progress
  const ph = db
    .prepare(
      `SELECT ring, status, task_type, target_id, target_name, required_count, progress
       FROM character_paohuan WHERE character_id = ?`,
    )
    .get(characterId) as
    | {
        ring: number;
        status: string;
        task_type: string | null;
        target_id: string | null;
        target_name: string | null;
        required_count: number;
        progress: number;
      }
    | undefined;

  if (
    ph &&
    ph.status === 'active' &&
    ph.task_type === 'kill' &&
    ph.target_id === enemyGroupId &&
    ph.progress < ph.required_count
  ) {
    const next = Math.min(ph.required_count, ph.progress + 1);
    const nextStatus = next >= ph.required_count ? 'ready' : 'active';
    db.prepare(
      'UPDATE character_paohuan SET progress = ?, status = ?, updated_at = ? WHERE character_id = ?',
    ).run(next, nextStatus, now, characterId);
    updates.push(
      `跑环第 ${ph.ring} 环 (${next}/${ph.required_count})${nextStatus === 'ready' ? ' 已完成，可交环领奖！' : ''}`,
    );
  }

  return updates;
}

export function recordQuestMapVisit(characterId: number, mapId: string): void {
  const now = Date.now();
  const activeMain = db
    .prepare(
      `SELECT id, quest_id, progress FROM character_main_quests
       WHERE character_id = ? AND status = 'active'`,
    )
    .all(characterId) as unknown as Array<{ id: number; quest_id: string; progress: number }>;

  for (const row of activeMain) {
    const def = MAIN_QUESTS.find((q) => q.questId === row.quest_id);
    if (
      def &&
      def.objectiveKind === 'visit_map' &&
      def.targetId === mapId &&
      row.progress < def.requiredCount
    ) {
      db.prepare('UPDATE character_main_quests SET progress = ?, updated_at = ? WHERE id = ?').run(
        def.requiredCount,
        now,
        row.id,
      );
    }
  }

  const ph = db
    .prepare(
      `SELECT status, task_type, target_id, required_count, progress
       FROM character_paohuan WHERE character_id = ?`,
    )
    .get(characterId) as
    | {
        status: string;
        task_type: string | null;
        target_id: string | null;
        required_count: number;
        progress: number;
      }
    | undefined;

  if (
    ph &&
    ph.status === 'active' &&
    ph.task_type === 'visit_map' &&
    ph.target_id === mapId &&
    ph.progress < ph.required_count
  ) {
    db.prepare(
      `UPDATE character_paohuan SET progress = ?, status = 'ready', updated_at = ? WHERE character_id = ?`,
    ).run(ph.required_count, now, characterId);
  }
}

export function restAtInn(
  characterId: number,
  free = false,
): { character: CharacterView; fee: number; message: string } {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const baseFee = free || ch.level <= 10 ? 0 : ch.level * 8;
  const actualFee = Math.min(ch.silver, baseFee);
  db.prepare(
    'UPDATE characters SET hp = ?, mp = ?, max_hp = ?, max_mp = ?, silver = silver - ?, updated_at = ? WHERE id = ?',
  ).run(ch.maxHp, ch.maxMp, ch.maxHp, ch.maxMp, actualFee, Date.now(), characterId);
  db.prepare('UPDATE generals SET hp = max_hp, mp = max_mp WHERE character_id = ?').run(
    characterId,
  );
  const message =
    baseFee === 0
      ? '新手 10 级内免费在客栈歇息，主角与副将气血精力已全部回满！'
      : actualFee < baseFee
        ? `掌柜见你囊中羞涩只收了 ${actualFee} 两店钱，主角与副将气血精力已回满！`
        : `花费 ${actualFee} 银两在客栈美美歇息了一番，主角与副将气血精力已全部回满！`;
  return { character: getCharacterById(characterId)!, fee: actualFee, message };
}

export function grantEquipmentToCharacter(
  characterId: number,
  templateId: string,
  randomize = false,
  craftBoost = false,
): EquipmentView {
  const tpl = EQUIPMENT_TEMPLATES[templateId];
  if (!tpl) throw new Error('装备模板不存在');

  const rollMult = randomize
    ? craftBoost
      ? 0.96 + Math.random() * 0.34
      : 0.9 + Math.random() * 0.28
    : 1;
  const rollPct = Math.round(rollMult * 100);
  const roll = (val?: number) => {
    if (!val) return 0;
    if (!randomize) return val;
    return Math.max(1, Math.round(val * rollMult));
  };

  let resPhys = tpl.resPhys ?? 0;
  let resChaos = tpl.resChaos ?? 0;
  let resSeal = tpl.resSeal ?? 0;
  let resTrap = tpl.resTrap ?? 0;
  let resMagic = tpl.resMagic ?? 0;
  let name = tpl.name;
  let quality: EquipmentQuality = tpl.quality;

  // Dropped / dug / crafted gear has a chance to roll extra classic resistance affixes & quality upgrade
  const affixChance = craftBoost ? 0.65 : 0.35;
  if (randomize && Math.random() < affixChance) {
    const extra = 3 + Math.floor(Math.random() * (craftBoost ? 6 : 4));
    const pick = Math.floor(Math.random() * 5);
    if (pick === 0) resPhys += extra;
    else if (pick === 1) resChaos += extra;
    else if (pick === 2) resSeal += extra;
    else if (pick === 3) resTrap += extra;
    else resMagic += extra;
    if (rollPct >= 118) {
      name = `神工·${tpl.name}`;
      if (quality === 'common') quality = 'fine';
      else if (quality === 'fine') quality = 'rare';
      else if (quality === 'rare') quality = 'legend';
    } else {
      name = `极品·${tpl.name}`;
    }
  }

  const hpBonus = roll(tpl.hpBonus);
  const mpBonus = roll(tpl.mpBonus);
  const atkBonus = roll(tpl.atkBonus);
  const defBonus = roll(tpl.defBonus);
  const spdBonus = roll(tpl.spdBonus);
  const sellSilver = Math.max(25, Math.round(tpl.priceSilver * 0.22));
  const setId = TEMPLATE_SET_MAP[tpl.templateId] ?? null;

  const info = db
    .prepare(
      `INSERT INTO character_equipment (
        character_id, template_id, name, slot, quality, icon, level_req,
        hp_bonus, mp_bonus, atk_bonus, def_bonus, spd_bonus,
        res_phys, res_chaos, res_seal, res_trap, res_magic,
        sell_silver, equipped, set_id, roll_pct, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    )
    .run(
      characterId,
      tpl.templateId,
      name,
      tpl.slot,
      quality,
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
      setId,
      rollPct,
      Date.now(),
    );

  return {
    id: Number(info.lastInsertRowid),
    templateId: tpl.templateId,
    name,
    slot: tpl.slot,
    quality,
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
    setId,
    setName: setId ? EQUIPMENT_SETS[setId]?.name ?? null : null,
    rollPct,
  };
}

export function craftEquipment(
  characterId: number,
  recipeId: string,
): { equipment: EquipmentView; character: CharacterView; message: string } {
  const recipe = CRAFT_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) throw new Error('打造配方不存在');
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  if (ch.rebirth === 0 && ch.level < recipe.levelReq) {
    throw new Error(`需要 ${recipe.levelReq} 级才能开启【${recipe.name}】`);
  }
  if (ch.equipment.length >= 30) throw new Error('装备栏已满（最多 30 件），请先清理');
  if (ch.silver < recipe.silverCost) throw new Error(`银两不足，需要 ${recipe.silverCost} 两`);
  const ore = ch.inventory.find((i) => i.itemId === 'xuantie');
  if (!ore || ore.quantity < recipe.oreCost) {
    throw new Error(`玄铁矿不足，需要 ${recipe.oreCost} 枚（可在药铺杂货购买或战斗/挖宝掉落）`);
  }

  db.prepare('UPDATE characters SET silver = silver - ?, updated_at = ? WHERE id = ?').run(
    recipe.silverCost,
    Date.now(),
    characterId,
  );
  addItem(characterId, 'xuantie', -recipe.oreCost);

  const pickedTpl = recipe.pool[Math.floor(Math.random() * recipe.pool.length)];
  const eq = grantEquipmentToCharacter(characterId, pickedTpl, true, true);
  return {
    equipment: eq,
    character: getCharacterById(characterId)!,
    message: `铁锤落定，金光四射！成功打造【${eq.name}】（成色 ${eq.rollPct ?? 100}%）！`,
  };
}

export function reforgeEquipment(
  characterId: number,
  equipId: number,
): { equipment: EquipmentView; character: CharacterView; message: string } {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const target = ch.equipment.find((e) => e.id === equipId);
  if (!target) throw new Error('装备不存在');
  const tpl = EQUIPMENT_TEMPLATES[target.templateId];
  if (!tpl) throw new Error('装备模板不存在');

  const stone = ch.inventory.find((i) => i.itemId === 'jinglianshi');
  if (!stone || stone.quantity < 1) {
    throw new Error('缺少【精炼石】（可在药铺杂货购买或首领战/天玄塔获取）');
  }
  const silverCost = Math.max(300, Math.round(tpl.priceSilver * 0.15));
  if (ch.silver < silverCost) throw new Error(`重铸手续费不足，需要 ${silverCost} 银两`);

  db.prepare('UPDATE characters SET silver = silver - ?, updated_at = ? WHERE id = ?').run(
    silverCost,
    Date.now(),
    characterId,
  );
  addItem(characterId, 'jinglianshi', -1);

  const rollMult = 0.92 + Math.random() * 0.38;
  const rollPct = Math.round(rollMult * 100);
  const roll = (val?: number) => (val ? Math.max(1, Math.round(val * rollMult)) : 0);

  let resPhys = tpl.resPhys ?? 0;
  let resChaos = tpl.resChaos ?? 0;
  let resSeal = tpl.resSeal ?? 0;
  let resTrap = tpl.resTrap ?? 0;
  let resMagic = tpl.resMagic ?? 0;
  let name = tpl.name;
  let quality: EquipmentQuality = tpl.quality;

  if (Math.random() < 0.7) {
    const extra = 3 + Math.floor(Math.random() * 6);
    const pick = Math.floor(Math.random() * 5);
    if (pick === 0) resPhys += extra;
    else if (pick === 1) resChaos += extra;
    else if (pick === 2) resSeal += extra;
    else if (pick === 3) resTrap += extra;
    else resMagic += extra;
    if (rollPct >= 118) {
      name = `神工·${tpl.name}`;
      if (quality === 'common') quality = 'fine';
      else if (quality === 'fine') quality = 'rare';
      else if (quality === 'rare') quality = 'legend';
    } else {
      name = `极品·${tpl.name}`;
    }
  }

  db.prepare(
    `UPDATE character_equipment
     SET name = ?, quality = ?, hp_bonus = ?, mp_bonus = ?, atk_bonus = ?, def_bonus = ?, spd_bonus = ?,
         res_phys = ?, res_chaos = ?, res_seal = ?, res_trap = ?, res_magic = ?, roll_pct = ?
     WHERE id = ? AND character_id = ?`,
  ).run(
    name,
    quality,
    roll(tpl.hpBonus),
    roll(tpl.mpBonus),
    roll(tpl.atkBonus),
    roll(tpl.defBonus),
    roll(tpl.spdBonus),
    resPhys,
    resChaos,
    resSeal,
    resTrap,
    resMagic,
    rollPct,
    equipId,
    characterId,
  );

  const updated = getCharacterById(characterId)!;
  const newEq = updated.equipment.find((e) => e.id === equipId)!;
  return {
    equipment: newEq,
    character: updated,
    message: `重铸完成！【${newEq.name}】新成色 ${rollPct}%！`,
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
  if (ch.rebirth === 0 && ch.level < target.levelReq) {
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
    // Classic treasure pool scaled smoothly with character level tier
    const r2 = Math.random();
    let pool: string[];
    if (ch.level >= 48) {
      pool =
        r2 < 0.28
          ? ['fangtian_ji', 'taiji_fajian', 'tianlong_guan', 'qilin_baojia', 'tengyun_xue', 'bailong_ju', 'hanxue_ma']
          : ['zhangba_mao', 'zhuge_yushan', 'wuhou_jin', 'xuanwu_jia', 'lingbo_lv', 'zhuahuang_ma'];
    } else if (ch.level >= 32) {
      pool =
        r2 < 0.12
          ? ['fangtian_ji', 'taiji_fajian', 'qilin_baojia', 'bailong_ju']
          : r2 < 0.65
            ? ['zhangba_mao', 'zhuge_yushan', 'wuhou_jin', 'xuanwu_jia', 'lingbo_lv', 'zhuahuang_ma']
            : ['qinglong_dao', 'fengchi_kui', 'mingguang_kai', 'yunlong_xue', 'jueying_ma'];
    } else if (ch.level >= 20) {
      pool =
        r2 < 0.2
          ? ['chitu_ma', 'longdan_qiang', 'huangjin_jia', 'jueying_ma']
          : ['qinglong_dao', 'fengchi_kui', 'mingguang_kai', 'yunlong_xue', 'jueying_ma', 'dilu_ma'];
    } else if (r2 < 0.14) {
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
    const silver = 280 + ch.level * 45 + Math.floor(Math.random() * (720 + ch.level * 50));
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
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');

  if (tpl.priceGold && tpl.priceGold > 0) {
    const goldCost = tpl.priceGold * qty;
    if (ch.gold < goldCost) throw new Error(`金砖不足，需要 ${goldCost} 金砖`);
    db.prepare('UPDATE characters SET gold = gold - ?, updated_at = ? WHERE id = ?').run(
      goldCost,
      Date.now(),
      characterId,
    );
  } else {
    const cost = tpl.priceSilver * qty;
    if (ch.silver < cost) throw new Error(`银两不足，需要 ${cost} 银两`);
    db.prepare('UPDATE characters SET silver = silver - ?, updated_at = ? WHERE id = ?').run(
      cost,
      Date.now(),
      characterId,
    );
  }
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
  const rolled = rollGeneralBuild(templateId, 0);
  const { tpl, baseHp, baseMp, baseAtk, baseSpd, growth, rarity } = rolled;
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
  const stats = calcGeneralStatsAtLevel(
    { hp: baseHp, mp: baseMp, atk: baseAtk, spd: baseSpd },
    growth,
    lv,
  );
  const skillDef = SKILLS.find((s) => s.id === tpl.skillId);

  const info = db
    .prepare(
      `INSERT INTO generals (
        character_id, template_id, name, role_class, sprite_key, avatar_key,
        level, exp, hp, max_hp, mp, max_mp, atk, spd,
        base_hp, base_mp, base_atk, base_spd, growth, rebirth, rarity, skill_id,
        loyalty, slot, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 100, ?, ?)`,
    )
    .run(
      characterId,
      tpl.templateId,
      tpl.name,
      tpl.roleClass,
      tpl.spriteKey,
      tpl.avatarKey,
      lv,
      stats.maxHp,
      stats.maxHp,
      stats.maxMp,
      stats.maxMp,
      stats.atk,
      stats.spd,
      baseHp,
      baseMp,
      baseAtk,
      baseSpd,
      growth,
      rarity,
      tpl.skillId,
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
    expToNext: expRequiredForLevel(lv),
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    mp: stats.maxMp,
    maxMp: stats.maxMp,
    atk: stats.atk,
    spd: stats.spd,
    baseHp,
    baseMp,
    baseAtk,
    baseSpd,
    growth,
    rebirth: 0,
    rarity,
    skillId: tpl.skillId,
    skillName: skillDef?.name ?? '力劈华山',
    skill2Id: null,
    skill2Name: null,
    intimacy: 0,
    intimacyTitle: '初识',
    intimacyStatPct: 0,
    intimacyResistBonus: 0,
    loyalty: 100,
    slot: freeSlot,
  };
}

export function recruitGeneral(characterId: number, templateId: string): {
  general: GeneralView;
  character: CharacterView;
} {
  const tpl = GENERAL_TEMPLATES[templateId];
  if (!tpl || tpl.tavernDirect === false) throw new Error('该名将需使用「招贤令」寻访获得');
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  if (ch.generals.length >= 16) throw new Error('副将栏位已满（最多 16 名）');
  if (ch.silver < tpl.recruitCostSilver) throw new Error(`银两不足，需要 ${tpl.recruitCostSilver} 两`);

  db.prepare('UPDATE characters SET silver = silver - ?, updated_at = ? WHERE id = ?').run(
    tpl.recruitCostSilver,
    Date.now(),
    characterId,
  );
  const general = grantGeneralToCharacter(characterId, templateId, Math.max(1, ch.level - 1));
  return { general, character: getCharacterById(characterId)! };
}

export function drawGeneralWithToken(characterId: number): {
  general: GeneralView;
  character: CharacterView;
} {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  if (ch.generals.length >= 16) throw new Error('副将栏位已满（最多 16 名），请先解雇多余副将');
  const owned = ch.inventory.find((i) => i.itemId === 'jiangling');
  if (!owned || owned.quantity <= 0) throw new Error('行囊中没有招贤令（可在药铺购买或挖宝获得）');

  addItem(characterId, 'jiangling', -1);

  const roll = Math.random();
  let templateId: string;
  if (roll < 0.06) templateId = 'lvbu';
  else if (roll < 0.12) templateId = 'zhugeliang';
  else if (roll < 0.18) templateId = 'simayi';
  else if (roll < 0.25) templateId = 'zhouyu';
  else if (roll < 0.32) templateId = 'machao';
  else if (roll < 0.41) templateId = 'zhaoyun';
  else if (roll < 0.5) templateId = 'guanyu';
  else if (roll < 0.59) templateId = 'diaochan';
  else if (roll < 0.68) templateId = 'huatuo';
  else if (roll < 0.76) templateId = 'zhangfei';
  else if (roll < 0.83) templateId = 'huangzhong';
  else if (roll < 0.9) templateId = 'yuji';
  else if (roll < 0.95) templateId = 'huangyueying';
  else templateId = Math.random() < 0.5 ? 'guanping' : 'zhoucang';

  const general = grantGeneralToCharacter(characterId, templateId, Math.max(1, ch.level - 1));
  return { general, character: getCharacterById(characterId)! };
}

export function feedGeneralExpPill(characterId: number, generalId: number): CharacterView {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const g = ch.generals.find((x) => x.id === generalId);
  if (!g) throw new Error('副将不存在');
  const pill = ch.inventory.find((i) => i.itemId === 'jingyandan');
  if (!pill || pill.quantity <= 0) throw new Error('行囊中没有副将经验丹');

  addItem(characterId, 'jingyandan', -1);
  let lv = g.level;
  const pillExp = Math.round(360 + ch.level * 140 + (ch.level > 20 ? (ch.level - 20) * (ch.level - 20) * 12 : 0));
  let exp = g.exp + pillExp;
  const maxLv = Math.max(20, ch.level + 5);
  while (exp >= expRequiredForLevel(lv) && lv < maxLv) {
    exp -= expRequiredForLevel(lv);
    lv++;
  }
  const stats = calcGeneralStatsAtLevel(
    { hp: g.baseHp, mp: g.baseMp, atk: g.baseAtk, spd: g.baseSpd },
    g.growth,
    lv,
  );
  db.prepare(
    'UPDATE generals SET level = ?, exp = ?, hp = ?, max_hp = ?, mp = ?, max_mp = ?, atk = ?, spd = ?, intimacy = MIN(100, intimacy + 5) WHERE id = ?',
  ).run(lv, exp, stats.maxHp, stats.maxHp, stats.maxMp, stats.maxMp, stats.atk, stats.spd, g.id);
  return getCharacterById(characterId)!;
}

export function feedGeneralLoyalty(
  characterId: number,
  generalId: number,
  itemId: string,
): { character: CharacterView; message: string } {
  const tpl = ITEMS[itemId];
  if (!tpl || !tpl.loyaltyRestore) throw new Error('无效的忠诚度口粮道具');
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const g = ch.generals.find((x) => x.id === generalId);
  if (!g) throw new Error('副将不存在');
  if (g.loyalty >= 100) throw new Error(`${g.name} 忠诚度已满（100）`);
  const owned = ch.inventory.find((i) => i.itemId === itemId);
  if (!owned || owned.quantity <= 0) throw new Error(`行囊中没有【${tpl.name}】`);

  addItem(characterId, itemId, -1);
  db.prepare('UPDATE generals SET loyalty = MIN(100, loyalty + ?) WHERE id = ?').run(
    tpl.loyaltyRestore,
    generalId,
  );
  const updated = getCharacterById(characterId)!;
  const afterG = updated.generals.find((x) => x.id === generalId)!;
  return {
    character: updated,
    message: `喂食【${tpl.name}】成功！${g.name} 忠诚度提升至 ${afterG.loyalty}/100。`,
  };
}

export function adjustGeneralLoyalty(generalId: number, delta: number): void {
  db.prepare('UPDATE generals SET loyalty = MAX(0, MIN(100, loyalty + ?)) WHERE id = ?').run(
    delta,
    generalId,
  );
}

export function trainSkillWithSilver(
  characterId: number,
  skillId: string,
): { character: CharacterView; message: string } {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const skillDef = SKILLS.find(
    (s) => s.id === skillId && (s.roleClass === ch.roleClass || s.roleClass === 'all'),
  );
  if (!skillDef) throw new Error('本职业无法修炼该技能');
  const current = ch.skills.find((s) => s.skillId === skillId);
  const curProf = current?.proficiency ?? 0;
  if (curProf >= 2000) throw new Error(`【${skillDef.name}】已达 5 阶圆满！`);

  const tier = current?.tier ?? 1;
  const silverCost = 300 + tier * 280;
  if (ch.silver < silverCost) throw new Error(`银两不足，武馆点技需要 ${silverCost} 银两`);

  db.prepare('UPDATE characters SET silver = silver - ?, updated_at = ? WHERE id = ?').run(
    silverCost,
    Date.now(),
    characterId,
  );
  const profGain = 240;
  addSkillProficiency(characterId, skillId, profGain);
  const updated = getCharacterById(characterId)!;
  const afterSk = updated.skills.find((s) => s.skillId === skillId)!;
  return {
    character: updated,
    message: `消耗 ${silverCost} 银两在武馆潜心修习，【${skillDef.name}】熟练度 +${profGain}（当前 ${afterSk.tier} 阶 · ${afterSk.proficiency}）！`,
  };
}

export function learnGeneralSkillBook(
  characterId: number,
  generalId: number,
  bookItemId: string,
): { general: GeneralView; character: CharacterView; message: string } {
  const skillId = GENERAL_SKILL_BOOKS[bookItemId];
  if (!skillId) throw new Error('无效的副将技能书');
  const skillDef = SKILLS.find((s) => s.id === skillId);
  if (!skillDef) throw new Error('技能配置不存在');

  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const g = ch.generals.find((x) => x.id === generalId);
  if (!g) throw new Error('副将不存在');
  if (g.skillId === skillId || g.skill2Id === skillId) {
    throw new Error(`${g.name} 已掌握【${skillDef.name}】，无需重复学习`);
  }

  const owned = ch.inventory.find((i) => i.itemId === bookItemId);
  if (!owned || owned.quantity <= 0) {
    throw new Error(`行囊中没有【${ITEMS[bookItemId]?.name ?? bookItemId}】`);
  }

  addItem(characterId, bookItemId, -1);
  db.prepare('UPDATE generals SET skill2_id = ?, intimacy = MIN(100, intimacy + 8) WHERE id = ?').run(
    skillId,
    g.id,
  );
  const updated = getCharacterById(characterId)!;
  const updatedGen = updated.generals.find((x) => x.id === g.id)!;
  return {
    general: updatedGen,
    character: updated,
    message: `研习成功！${updatedGen.name} 习得秘籍技【${skillDef.name}】（默契度 +8）！`,
  };
}

export function addActiveGeneralsIntimacy(characterId: number, delta: number): void {
  if (delta <= 0) return;
  db.prepare(
    'UPDATE generals SET intimacy = MIN(100, intimacy + ?) WHERE character_id = ? AND slot IS NOT NULL',
  ).run(delta, characterId);
}

export function washGeneral(characterId: number, generalId: number): {
  general: GeneralView;
  character: CharacterView;
} {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const g = ch.generals.find((x) => x.id === generalId);
  if (!g) throw new Error('副将不存在');
  const pill = ch.inventory.find((i) => i.itemId === 'xisuidan');
  if (!pill || pill.quantity <= 0) throw new Error('行囊中没有洗髓丹');

  addItem(characterId, 'xisuidan', -1);
  const rolled = rollGeneralBuild(g.templateId, g.rebirth);
  const stats = calcGeneralStatsAtLevel(
    { hp: rolled.baseHp, mp: rolled.baseMp, atk: rolled.baseAtk, spd: rolled.baseSpd },
    rolled.growth,
    g.level,
  );
  db.prepare(
    `UPDATE generals
     SET base_hp = ?, base_mp = ?, base_atk = ?, base_spd = ?, growth = ?, rarity = ?,
         hp = ?, max_hp = ?, mp = ?, max_mp = ?, atk = ?, spd = ?
     WHERE id = ?`,
  ).run(
    rolled.baseHp,
    rolled.baseMp,
    rolled.baseAtk,
    rolled.baseSpd,
    rolled.growth,
    rolled.rarity,
    stats.maxHp,
    stats.maxHp,
    stats.maxMp,
    stats.maxMp,
    stats.atk,
    stats.spd,
    g.id,
  );
  const updated = getCharacterById(characterId)!;
  return {
    general: updated.generals.find((x) => x.id === generalId)!,
    character: updated,
  };
}

export function rebirthGeneral(characterId: number, generalId: number): CharacterView {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const g = ch.generals.find((x) => x.id === generalId);
  if (!g) throw new Error('副将不存在');
  if (g.rebirth >= 2) throw new Error('该副将已达最高 2 转境界');
  const reqLv = g.rebirth === 0 ? 20 : 40;
  if (g.level < reqLv) throw new Error(`需达到 ${reqLv} 级才可进行 ${g.rebirth + 1} 转`);

  const nextRebirth = g.rebirth + 1;
  const nextGrowth = Math.round((g.growth + 0.1) * 100) / 100;
  const nextBaseHp = Math.round(g.baseHp * 1.15);
  const nextBaseMp = Math.round(g.baseMp * 1.15);
  const nextBaseAtk = Math.round(g.baseAtk * 1.15);
  const nextBaseSpd = Math.round(g.baseSpd * 1.15);
  const nextRarity: EquipmentQuality = nextRebirth >= 2 ? 'legend' : 'rare';

  db.prepare(
    `UPDATE generals
     SET level = 1, exp = 0, rebirth = ?, growth = ?, rarity = ?,
         base_hp = ?, base_mp = ?, base_atk = ?, base_spd = ?,
         hp = ?, max_hp = ?, mp = ?, max_mp = ?, atk = ?, spd = ?
     WHERE id = ?`,
  ).run(
    nextRebirth,
    nextGrowth,
    nextRarity,
    nextBaseHp,
    nextBaseMp,
    nextBaseAtk,
    nextBaseSpd,
    nextBaseHp,
    nextBaseHp,
    nextBaseMp,
    nextBaseMp,
    nextBaseAtk,
    nextBaseSpd,
    g.id,
  );
  return getCharacterById(characterId)!;
}

export function dismissGeneral(characterId: number, generalId: number): {
  refundSilver: number;
  character: CharacterView;
} {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const g = ch.generals.find((x) => x.id === generalId);
  if (!g) throw new Error('副将不存在');
  if (g.slot !== null) throw new Error('请先将该副将卸下出战槽位再解雇');

  const tpl = GENERAL_TEMPLATES[g.templateId];
  const refundSilver = Math.max(80, Math.round((tpl?.recruitCostSilver ?? 300) * 0.25));
  db.prepare('DELETE FROM generals WHERE id = ? AND character_id = ?').run(generalId, characterId);
  db.prepare('UPDATE characters SET silver = silver + ?, updated_at = ? WHERE id = ?').run(
    refundSilver,
    Date.now(),
    characterId,
  );
  return { refundSilver, character: getCharacterById(characterId)! };
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
): { character: CharacterView; leveledUp: boolean; newLevel: number; appliedExp: number } {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');

  const realmMult = REALMS.find((r) => r.id === ch.realmId)?.expMultiplier ?? 1;
  const appliedExp = expGain > 0 ? Math.round(expGain * realmMult) : 0;

  let level = ch.level;
  let exp = ch.exp + appliedExp;
  let levelsGained = 0;

  while (exp >= expRequiredForLevel(level) && level < 140) {
    exp -= expRequiredForLevel(level);
    level++;
    levelsGained++;
  }

  const leveledUp = levelsGained > 0;
  const freePointsGain = levelsGained * 4;
  const resPointsGain = levelsGained * 1;
  const stats = calcRoleStats(ch.roleClass, level, ch.alloc, ch.rebirth);
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
    let gLv = g.level;
    let gExp = g.exp + Math.round(appliedExp * 0.85);
    while (gExp >= expRequiredForLevel(gLv) && gLv < level + 3) {
      gExp -= expRequiredForLevel(gLv);
      gLv++;
    }
    const gStats = calcGeneralStatsAtLevel(
      { hp: g.baseHp, mp: g.baseMp, atk: g.baseAtk, spd: g.baseSpd },
      g.growth,
      gLv,
    );
    db.prepare(
      `UPDATE generals SET level = ?, exp = ?, hp = ?, max_hp = ?, mp = ?, max_mp = ?, atk = ?, spd = ? WHERE id = ?`,
    ).run(gLv, gExp, gStats.maxHp, gStats.maxHp, gStats.maxMp, gStats.maxMp, gStats.atk, gStats.spd, g.id);
  }

  return {
    character: getCharacterById(characterId)!,
    leveledUp,
    newLevel: level,
    appliedExp,
  };
}

export function getRankings(realmId: string, sort: 'level' | 'silver' | 'gold'): RankEntry[] {
  const orderSql =
    sort === 'silver'
      ? 'silver DESC, rebirth DESC, level DESC'
      : sort === 'gold'
        ? 'gold DESC, rebirth DESC, level DESC'
        : 'rebirth DESC, level DESC, exp DESC';
  const rows = db
    .prepare(
      `SELECT id, name, role_class, level, rebirth, silver, gold FROM characters WHERE realm_id = ? ORDER BY ${orderSql} LIMIT 30`,
    )
    .all(realmId) as unknown as Array<{
    id: number;
    name: string;
    role_class: RoleClass;
    level: number;
    rebirth: number;
    silver: number;
    gold: number;
  }>;

  return rows.map((r, i) => ({
    rank: i + 1,
    id: r.id,
    name: r.name,
    roleClass: r.role_class,
    level: r.level,
    rebirth: r.rebirth ?? 0,
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
    restAtInn(characterId, true);
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

export function recordTowerClear(characterId: number, floor: number): string | null {
  const ch = getCharacterById(characterId);
  if (!ch) return null;
  if (floor <= ch.tower.highestFloor) {
    return `再次通关天玄塔第 ${floor} 层！`;
  }
  const nextFloor = Math.min(TOWER_MAX_FLOOR, floor);
  db.prepare('UPDATE characters SET tower_floor = ?, updated_at = ? WHERE id = ?').run(
    nextFloor,
    Date.now(),
    characterId,
  );

  const bonusParts: string[] = [];
  if (nextFloor === 5) {
    db.prepare('UPDATE characters SET gold = gold + 30 WHERE id = ?').run(characterId);
    addItem(characterId, 'jiangling', 1);
    bonusParts.push('金砖+30', '招贤令×1');
  } else if (nextFloor === 10) {
    db.prepare('UPDATE characters SET gold = gold + 60 WHERE id = ?').run(characterId);
    addItem(characterId, 'xisuidan', 2);
    const books = Object.keys(GENERAL_SKILL_BOOKS);
    const book = books[Math.floor(Math.random() * books.length)];
    addItem(characterId, book, 1);
    bonusParts.push('金砖+60', '洗髓丹×2', `${ITEMS[book].name}×1`);
  } else if (nextFloor === 15) {
    db.prepare('UPDATE characters SET gold = gold + 100 WHERE id = ?').run(characterId);
    addItem(characterId, 'baotu', 3);
    const latest = getCharacterById(characterId)!;
    if (latest.equipment.length < 30) {
      const pool = ['qixing_jian', 'zijin_guan', 'bagua_pao', 'jifeng_xue', 'dilu_ma'];
      const eq = grantEquipmentToCharacter(characterId, pool[Math.floor(Math.random() * pool.length)], true);
      bonusParts.push(`极品装备【${eq.name}】`);
    }
    bonusParts.push('金砖+100', '藏宝图×3');
  } else if (nextFloor === 20) {
    db.prepare('UPDATE characters SET gold = gold + 160 WHERE id = ?').run(characterId);
    const latest = getCharacterById(characterId)!;
    if (latest.equipment.length < 30) {
      const pool = ['chitu_ma', 'longdan_qiang', 'huangjin_jia'];
      const eq = grantEquipmentToCharacter(characterId, pool[Math.floor(Math.random() * pool.length)], true);
      bonusParts.push(`传世神兵【${eq.name}】`);
    }
    bonusParts.push('金砖+160');
  } else if (nextFloor === 25) {
    db.prepare('UPDATE characters SET gold = gold + 200 WHERE id = ?').run(characterId);
    addItem(characterId, 'jiangling', 2);
    const books = Object.keys(GENERAL_SKILL_BOOKS);
    const book = books[Math.floor(Math.random() * books.length)];
    addItem(characterId, book, 1);
    bonusParts.push('金砖+200', '招贤令×2', `${ITEMS[book].name}×1`);
  } else if (nextFloor === 30) {
    db.prepare('UPDATE characters SET gold = gold + 260 WHERE id = ?').run(characterId);
    addItem(characterId, 'xisuidan', 3);
    const latest = getCharacterById(characterId)!;
    if (latest.equipment.length < 30) {
      const pool = ['zhangba_mao', 'zhuge_yushan', 'wuhou_jin', 'xuanwu_jia', 'lingbo_lv', 'zhuahuang_ma'];
      const eq = grantEquipmentToCharacter(characterId, pool[Math.floor(Math.random() * pool.length)], true);
      bonusParts.push(`35级极品【${eq.name}】`);
    }
    bonusParts.push('金砖+260', '洗髓丹×3');
  } else if (nextFloor === 35) {
    db.prepare('UPDATE characters SET gold = gold + 320 WHERE id = ?').run(characterId);
    addItem(characterId, 'baotu', 4);
    addItem(characterId, 'jiangling', 2);
    bonusParts.push('金砖+320', '藏宝图×4', '招贤令×2');
  } else if (nextFloor === 40) {
    db.prepare('UPDATE characters SET gold = gold + 400 WHERE id = ?').run(characterId);
    const books = Object.keys(GENERAL_SKILL_BOOKS);
    for (let i = 0; i < 2; i++) {
      const book = books[Math.floor(Math.random() * books.length)];
      addItem(characterId, book, 1);
    }
    const latest = getCharacterById(characterId)!;
    if (latest.equipment.length < 30) {
      const pool = ['fangtian_ji', 'taiji_fajian', 'tianlong_guan', 'qilin_baojia', 'tengyun_xue', 'bailong_ju'];
      const eq = grantEquipmentToCharacter(characterId, pool[Math.floor(Math.random() * pool.length)], true);
      bonusParts.push(`50级传世【${eq.name}】`);
    }
    bonusParts.push('金砖+400', '随机技能书×2');
  } else if (nextFloor === 45) {
    db.prepare('UPDATE characters SET gold = gold + 500 WHERE id = ?').run(characterId);
    addItem(characterId, 'xisuidan', 4);
    const latest = getCharacterById(characterId)!;
    if (latest.equipment.length < 30) {
      const pool = ['fangtian_ji', 'taiji_fajian', 'tianlong_guan', 'qilin_baojia', 'tengyun_xue', 'bailong_ju'];
      const eq = grantEquipmentToCharacter(characterId, pool[Math.floor(Math.random() * pool.length)], true);
      bonusParts.push(`50级传世【${eq.name}】`);
    }
    bonusParts.push('金砖+500', '洗髓丹×4');
  } else if (nextFloor === 50) {
    db.prepare('UPDATE characters SET gold = gold + 800 WHERE id = ?').run(characterId);
    addItem(characterId, 'jiangling', 3);
    const latest = getCharacterById(characterId)!;
    if (latest.equipment.length < 30) {
      const pool = ['hanxue_ma', 'fangtian_ji', 'taiji_fajian'];
      const eq = grantEquipmentToCharacter(characterId, pool[Math.floor(Math.random() * pool.length)], true);
      bonusParts.push(`终极神品【${eq.name}】`);
    }
    bonusParts.push('金砖+800', '招贤令×3');
  }

  return bonusParts.length > 0
    ? `🏆 首通天玄塔第 ${nextFloor} 层！额外奖励：${bonusParts.join('、')}`
    : `🗼 成功登临天玄塔第 ${nextFloor} 层！`;
}

export function sweepTowerDaily(characterId: number): {
  character: CharacterView;
  message: string;
} {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  if (ch.tower.highestFloor <= 0) throw new Error('请先至少通关天玄塔第 1 层再扫荡');
  if (ch.tower.dailySwept) throw new Error('今日已领取过天玄塔扫荡俸禄，明日再来吧');

  const f = ch.tower.highestFloor;
  const exp = Math.round(f * 150 + (f > 20 ? (f - 20) * (f - 20) * 32 : 0));
  const silver = Math.round(f * 180 + (f > 20 ? (f - 20) * 140 : 0));
  db.prepare('UPDATE characters SET tower_sweep_date = ?, updated_at = ? WHERE id = ?').run(
    getTodayDateStr(),
    Date.now(),
    characterId,
  );
  const expRes = applyExpAndSilver(characterId, exp, silver);
  const parts: string[] = [`经验+${expRes.appliedExp}`, `银两+${silver}`];

  if (f >= 5) {
    const pillQty = f >= 35 ? 3 : f >= 20 ? 2 : 1;
    addItem(characterId, 'jingyandan', pillQty);
    parts.push(`副将经验丹×${pillQty}`);
  }
  if (f >= 10) {
    const mapQty = f >= 40 ? 2 : 1;
    addItem(characterId, 'baotu', mapQty);
    parts.push(`藏宝图×${mapQty}`);
  }
  if (f >= 30) {
    addItem(characterId, 'xisuidan', 1);
    parts.push('洗髓丹×1');
  }
  if (f >= 50) {
    addItem(characterId, 'jiangling', 1);
    parts.push('招贤令×1');
  }

  return {
    character: getCharacterById(characterId)!,
    message: `扫荡天玄塔（最高 ${f} 层）成功！获得 ${parts.join('、')}`,
  };
}

const CASINO_INTERVAL_MS: Record<CasinoGameType, number> = {
  dice: Math.max(10_000, Number(process.env.HXSG_CASINO_DICE_INTERVAL_MS || 180_000)),
  chibi: Math.max(10_000, Number(process.env.HXSG_CASINO_CHIBI_INTERVAL_MS || 300_000)),
};
const CASINO_LOCK_MS = 3_000;
const CASINO_INITIAL_HISTORY = 10;
const CASINO_BACKFILL_MAX = 15;
const CASINO_HISTORY_LIMIT = 20;
const CASINO_MAX_BETS_PER_ROUND = 10;

const DICE_CHOICE_LABELS: Record<CasinoDiceChoice, string> = {
  big: '大(11~18)',
  small: '小(3~10)',
  odd: '单数',
  even: '双数',
  baozi: '豹子',
};

const CHIBI_CHOICE_LABELS: Record<CasinoChibiChoice, string> = {
  wei: '魏军',
  wu: '吴军',
  shu: '蜀军',
};

const CHIBI_MULT_MAP: Record<CasinoChibiChoice, number> = {
  wei: 2.1,
  wu: 2.3,
  shu: 4.2,
};

const CHIBI_REPORT_MAP: Record<CasinoChibiChoice, string> = {
  wei: '曹军铁索横江，张辽率虎豹骑强登江岸，魏军大捷！',
  wu: '黄盖苦肉诈降，周瑜借东风火烧连营，东吴水师完胜！',
  shu: '诸葛亮奇谋设伏，赵云关羽华容道奇兵突袭，蜀军爆冷大胜！',
};

interface CasinoRoundRow {
  id: number;
  realm_id: string;
  game: CasinoGameType;
  round_no: number;
  status: 'open' | 'settled';
  opened_at: number;
  draw_at: number;
  settled_at: number | null;
  dice_1: number | null;
  dice_2: number | null;
  dice_3: number | null;
  dice_sum: number | null;
  is_baozi: number;
  chibi_winner: CasinoChibiChoice | null;
  chibi_report: string | null;
  total_bets: number;
  total_silver_bet: number;
  total_gold_bet: number;
  total_silver_payout: number;
  total_gold_payout: number;
}

interface CasinoBetRow {
  id: number;
  round_id: number;
  realm_id: string;
  game: CasinoGameType;
  round_no: number;
  character_id: number;
  character_name: string;
  choice: string;
  currency: CasinoCurrency;
  amount: number;
  status: 'pending' | 'won' | 'lost';
  payout: number;
  created_at: number;
  settled_at: number | null;
}

function rollDiceOutcome(): { d1: number; d2: number; d3: number; sum: number; isBaozi: boolean } {
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  const d3 = 1 + Math.floor(Math.random() * 6);
  return {
    d1,
    d2,
    d3,
    sum: d1 + d2 + d3,
    isBaozi: d1 === d2 && d2 === d3,
  };
}

function rollChibiOutcome(): { winner: CasinoChibiChoice; report: string } {
  const r = Math.random();
  const winner: CasinoChibiChoice = r < 0.42 ? 'wei' : r < 0.8 ? 'wu' : 'shu';
  return { winner, report: CHIBI_REPORT_MAP[winner] };
}

function insertSettledHistoricalRound(
  realmId: string,
  game: CasinoGameType,
  roundNo: number,
  openedAt: number,
  drawAt: number,
) {
  if (game === 'dice') {
    const out = rollDiceOutcome();
    db.prepare(
      `INSERT INTO casino_rounds (
        realm_id, game, round_no, status, opened_at, draw_at, settled_at,
        dice_1, dice_2, dice_3, dice_sum, is_baozi
      ) VALUES (?, 'dice', ?, 'settled', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(realmId, roundNo, openedAt, drawAt, drawAt, out.d1, out.d2, out.d3, out.sum, out.isBaozi ? 1 : 0);
  } else {
    const out = rollChibiOutcome();
    db.prepare(
      `INSERT INTO casino_rounds (
        realm_id, game, round_no, status, opened_at, draw_at, settled_at,
        chibi_winner, chibi_report
      ) VALUES (?, 'chibi', ?, 'settled', ?, ?, ?, ?, ?)`,
    ).run(realmId, roundNo, openedAt, drawAt, drawAt, out.winner, out.report);
  }
}

function syncCasinoGame(
  realmId: string,
  game: CasinoGameType,
  now = Date.now(),
): { announcements: string[] } {
  const intervalMs = CASINO_INTERVAL_MS[game];
  const slotStart = Math.floor(now / intervalMs) * intervalMs;
  const slotDraw = slotStart + intervalMs;
  const announcements: string[] = [];

  withTx(() => {
    let latest = db
      .prepare(
        'SELECT * FROM casino_rounds WHERE realm_id = ? AND game = ? ORDER BY round_no DESC LIMIT 1',
      )
      .get(realmId, game) as CasinoRoundRow | undefined;

    // Fast path: current round is still open and not due yet
    if (latest && latest.status === 'open' && latest.draw_at > now) {
      return;
    }

    // Bootstrap fresh DB with recent continuous history so the board is immediately alive
    if (!latest) {
      let roundNo = 0;
      for (let i = CASINO_INITIAL_HISTORY; i >= 1; i--) {
        roundNo += 1;
        const openedAt = slotStart - i * intervalMs;
        insertSettledHistoricalRound(realmId, game, roundNo, openedAt, openedAt + intervalMs);
      }
      db.prepare(
        `INSERT INTO casino_rounds (realm_id, game, round_no, status, opened_at, draw_at)
         VALUES (?, ?, ?, 'open', ?, ?)`,
      ).run(realmId, game, roundNo + 1, slotStart, slotDraw);
      return;
    }

    // Settle overdue open round and distribute payouts atomically
    if (latest.status === 'open' && latest.draw_at <= now) {
      const pendingBets = db
        .prepare("SELECT * FROM casino_bets WHERE round_id = ? AND status = 'pending' ORDER BY id ASC")
        .all(latest.id) as unknown as CasinoBetRow[];

      let totalSilverPayout = 0;
      let totalGoldPayout = 0;
      const bigWinners: string[] = [];

      if (game === 'dice') {
        const out = rollDiceOutcome();
        for (const bet of pendingBets) {
          let won = false;
          let mult = 0;
          if (bet.choice === 'baozi') {
            won = out.isBaozi;
            mult = 16;
          } else if (!out.isBaozi) {
            if (bet.choice === 'big') won = out.sum >= 11;
            else if (bet.choice === 'small') won = out.sum <= 10;
            else if (bet.choice === 'odd') won = out.sum % 2 === 1;
            else if (bet.choice === 'even') won = out.sum % 2 === 0;
            mult = 2;
          }
          const payout = won ? Math.round(bet.amount * mult) : 0;
          db.prepare('UPDATE casino_bets SET status = ?, payout = ?, settled_at = ? WHERE id = ?').run(
            won ? 'won' : 'lost',
            payout,
            now,
            bet.id,
          );
          if (payout > 0) {
            const col = bet.currency === 'gold' ? 'gold' : 'silver';
            db.prepare(`UPDATE characters SET ${col} = ${col} + ?, updated_at = ? WHERE id = ?`).run(
              payout,
              now,
              bet.character_id,
            );
            if (bet.currency === 'gold') totalGoldPayout += payout;
            else totalSilverPayout += payout;

            const isBig =
              bet.choice === 'baozi' ||
              (bet.currency === 'gold' ? payout >= 100 : payout >= 2000);
            if (isBig) {
              const unit = bet.currency === 'gold' ? '金砖' : '银两';
              bigWinners.push(`「${bet.character_name}」喜赢 ${payout} ${unit}`);
            }
          }
        }

        db.prepare(
          `UPDATE casino_rounds
           SET status = 'settled', settled_at = ?,
               dice_1 = ?, dice_2 = ?, dice_3 = ?, dice_sum = ?, is_baozi = ?,
               total_silver_payout = ?, total_gold_payout = ?
           WHERE id = ?`,
        ).run(
          now,
          out.d1,
          out.d2,
          out.d3,
          out.sum,
          out.isBaozi ? 1 : 0,
          totalSilverPayout,
          totalGoldPayout,
          latest.id,
        );

        if (bigWinners.length > 0) {
          const tag = out.isBaozi
            ? `【豹子 ${out.d1}·${out.d2}·${out.d3}】`
            : `[${out.d1}·${out.d2}·${out.d3}] ${out.sum}点(${out.sum >= 11 ? '大' : '小'}/${out.sum % 2 === 1 ? '单' : '双'})`;
          announcements.push(
            `【许昌赌坊】猜大小第 ${latest.round_no} 期开盅 ${tag}！${bigWinners.slice(0, 3).join('、')}！`,
          );
        }
      } else {
        const out = rollChibiOutcome();
        const mult = CHIBI_MULT_MAP[out.winner];
        for (const bet of pendingBets) {
          const won = bet.choice === out.winner;
          const payout = won ? Math.round(bet.amount * mult) : 0;
          db.prepare('UPDATE casino_bets SET status = ?, payout = ?, settled_at = ? WHERE id = ?').run(
            won ? 'won' : 'lost',
            payout,
            now,
            bet.id,
          );
          if (payout > 0) {
            const col = bet.currency === 'gold' ? 'gold' : 'silver';
            db.prepare(`UPDATE characters SET ${col} = ${col} + ?, updated_at = ? WHERE id = ?`).run(
              payout,
              now,
              bet.character_id,
            );
            if (bet.currency === 'gold') totalGoldPayout += payout;
            else totalSilverPayout += payout;

            const isBig =
              out.winner === 'shu' ||
              (bet.currency === 'gold' ? payout >= 100 : payout >= 2000);
            if (isBig) {
              const unit = bet.currency === 'gold' ? '金砖' : '银两';
              bigWinners.push(`「${bet.character_name}」喜赢 ${payout} ${unit}`);
            }
          }
        }

        db.prepare(
          `UPDATE casino_rounds
           SET status = 'settled', settled_at = ?,
               chibi_winner = ?, chibi_report = ?,
               total_silver_payout = ?, total_gold_payout = ?
           WHERE id = ?`,
        ).run(now, out.winner, out.report, totalSilverPayout, totalGoldPayout, latest.id);

        if (bigWinners.length > 0) {
          announcements.push(
            `【许昌赌坊】赤壁押注第 ${latest.round_no} 期【${CHIBI_CHOICE_LABELS[out.winner]}】胜出！${bigWinners.slice(0, 3).join('、')}！`,
          );
        }
      }

      latest = { ...latest, status: 'settled', settled_at: now };
    }

    // Backfill missed slots if server was paused, capped to CASINO_BACKFILL_MAX
    let roundNo = latest.round_no;
    if (latest.draw_at < slotStart) {
      const missed = Math.floor((slotStart - latest.draw_at) / intervalMs);
      const count = Math.min(missed, CASINO_BACKFILL_MAX);
      const startAt = slotStart - count * intervalMs;
      for (let i = 0; i < count; i++) {
        roundNo += 1;
        const t = startAt + i * intervalMs;
        insertSettledHistoricalRound(realmId, game, roundNo, t, t + intervalMs);
      }
    }

    // Open the live current round
    db.prepare(
      `INSERT INTO casino_rounds (realm_id, game, round_no, status, opened_at, draw_at)
       VALUES (?, ?, ?, 'open', ?, ?)`,
    ).run(realmId, game, roundNo + 1, slotStart, slotDraw);
  });

  return { announcements };
}

export function tickAllCasinoRounds(
  now = Date.now(),
): Array<{ realmId: string; message: string }> {
  const out: Array<{ realmId: string; message: string }> = [];
  for (const realm of REALMS.filter((r) => !r.hidden)) {
    for (const game of ['dice', 'chibi'] as const) {
      const res = syncCasinoGame(realm.id, game, now);
      for (const message of res.announcements) {
        out.push({ realmId: realm.id, message });
      }
    }
  }
  return out;
}

function toCasinoBetView(b: CasinoBetRow): CasinoBetView {
  return {
    id: b.id,
    roundId: b.round_id,
    game: b.game,
    roundNo: b.round_no,
    choice: b.choice,
    currency: b.currency,
    amount: b.amount,
    status: b.status,
    payout: b.payout,
    createdAt: b.created_at,
    settledAt: b.settled_at,
  };
}

function toCasinoRoundView(
  r: CasinoRoundRow,
  extras?: {
    poolByChoice?: Record<string, { silver: number; gold: number; count: number }>;
    mySummary?: {
      count: number;
      silverBet: number;
      goldBet: number;
      silverPayout: number;
      goldPayout: number;
    };
  },
): CasinoRoundView {
  const intervalSec = Math.round(CASINO_INTERVAL_MS[r.game] / 1000);
  const lockBeforeSec = Math.round(CASINO_LOCK_MS / 1000);
  const view: CasinoRoundView = {
    id: r.id,
    realmId: r.realm_id,
    game: r.game,
    roundNo: r.round_no,
    status: r.status,
    openedAt: r.opened_at,
    drawAt: r.draw_at,
    settledAt: r.settled_at,
    intervalSec,
    lockBeforeSec,
    totalBets: r.total_bets,
    totalSilverBet: r.total_silver_bet,
    totalGoldBet: r.total_gold_bet,
    totalSilverPayout: r.total_silver_payout,
    totalGoldPayout: r.total_gold_payout,
  };
  if (r.game === 'dice' && r.dice_1 !== null && r.dice_2 !== null && r.dice_3 !== null) {
    view.dice = [r.dice_1, r.dice_2, r.dice_3];
    view.sum = r.dice_sum ?? r.dice_1 + r.dice_2 + r.dice_3;
    view.isBaozi = Boolean(r.is_baozi);
  }
  if (r.game === 'chibi' && r.chibi_winner) {
    view.chibiWinner = r.chibi_winner;
    view.chibiReport = r.chibi_report ?? CHIBI_REPORT_MAP[r.chibi_winner];
  }
  if (extras?.poolByChoice) {
    view.poolByChoice = extras.poolByChoice;
  }
  if (extras?.mySummary) {
    view.myBetCount = extras.mySummary.count;
    view.mySilverBet = extras.mySummary.silverBet;
    view.myGoldBet = extras.mySummary.goldBet;
    view.mySilverPayout = extras.mySummary.silverPayout;
    view.myGoldPayout = extras.mySummary.goldPayout;
  }
  return view;
}

function buildCasinoGameState(
  realmId: string,
  characterId: number,
  game: CasinoGameType,
): CasinoGameStateView {
  const currentRow = db
    .prepare(
      "SELECT * FROM casino_rounds WHERE realm_id = ? AND game = ? AND status = 'open' ORDER BY round_no DESC LIMIT 1",
    )
    .get(realmId, game) as unknown as CasinoRoundRow;

  const historyRows = db
    .prepare(
      "SELECT * FROM casino_rounds WHERE realm_id = ? AND game = ? AND status = 'settled' ORDER BY round_no DESC LIMIT ?",
    )
    .all(realmId, game, CASINO_HISTORY_LIMIT) as unknown as CasinoRoundRow[];

  const currentBetsAll = db
    .prepare('SELECT choice, currency, amount FROM casino_bets WHERE round_id = ?')
    .all(currentRow.id) as unknown as Array<{
    choice: string;
    currency: CasinoCurrency;
    amount: number;
  }>;

  const poolByChoice: Record<string, { silver: number; gold: number; count: number }> = {};
  for (const b of currentBetsAll) {
    if (!poolByChoice[b.choice]) poolByChoice[b.choice] = { silver: 0, gold: 0, count: 0 };
    poolByChoice[b.choice].count += 1;
    if (b.currency === 'gold') poolByChoice[b.choice].gold += b.amount;
    else poolByChoice[b.choice].silver += b.amount;
  }

  const myCurrentRows = db
    .prepare('SELECT * FROM casino_bets WHERE round_id = ? AND character_id = ? ORDER BY id DESC')
    .all(currentRow.id, characterId) as unknown as CasinoBetRow[];

  const myRecentRows = db
    .prepare(
      'SELECT * FROM casino_bets WHERE character_id = ? AND game = ? ORDER BY id DESC LIMIT 25',
    )
    .all(characterId, game) as unknown as CasinoBetRow[];

  // Aggregate player's bets per historical round
  const myByRound = new Map<
    number,
    { count: number; silverBet: number; goldBet: number; silverPayout: number; goldPayout: number }
  >();
  if (historyRows.length > 0) {
    const placeholders = historyRows.map(() => '?').join(',');
    const histMyBets = db
      .prepare(
        `SELECT round_id, currency, amount, payout FROM casino_bets
         WHERE character_id = ? AND round_id IN (${placeholders})`,
      )
      .all(characterId, ...historyRows.map((r) => r.id)) as unknown as Array<{
      round_id: number;
      currency: CasinoCurrency;
      amount: number;
      payout: number;
    }>;
    for (const b of histMyBets) {
      const cur = myByRound.get(b.round_id) ?? {
        count: 0,
        silverBet: 0,
        goldBet: 0,
        silverPayout: 0,
        goldPayout: 0,
      };
      cur.count += 1;
      if (b.currency === 'gold') {
        cur.goldBet += b.amount;
        cur.goldPayout += b.payout;
      } else {
        cur.silverBet += b.amount;
        cur.silverPayout += b.payout;
      }
      myByRound.set(b.round_id, cur);
    }
  }

  // Top winners from the most recent settled round that had winners (fallback: latest settled)
  const latestWithWin =
    historyRows.find((r) => r.total_silver_payout > 0 || r.total_gold_payout > 0) ?? historyRows[0];
  let lastRoundTopWinners: CasinoWinnerEntry[] = [];
  if (latestWithWin) {
    const winnerRows = db
      .prepare(
        `SELECT character_id, character_name, choice, currency, amount, payout, round_no
         FROM casino_bets
         WHERE round_id = ? AND status = 'won'
         ORDER BY (CASE WHEN currency = 'gold' THEN payout * 50 ELSE payout END) DESC
         LIMIT 5`,
      )
      .all(latestWithWin.id) as unknown as Array<{
      character_id: number;
      character_name: string;
      choice: string;
      currency: CasinoCurrency;
      amount: number;
      payout: number;
      round_no: number;
    }>;
    lastRoundTopWinners = winnerRows.map((w) => ({
      characterId: w.character_id,
      characterName: w.character_name,
      choice: w.choice,
      currency: w.currency,
      payout: w.payout,
      netProfit: w.payout - w.amount,
      roundNo: w.round_no,
    }));
  }

  // Today's top winners leaderboard in this realm & game
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const lbRows = db
    .prepare(
      `SELECT character_id, character_name,
              SUM(CASE WHEN currency = 'silver' THEN payout ELSE 0 END) AS silver_won,
              SUM(CASE WHEN currency = 'gold' THEN payout ELSE 0 END) AS gold_won,
              COUNT(*) AS win_count
       FROM casino_bets
       WHERE realm_id = ? AND game = ? AND status = 'won' AND settled_at >= ?
       GROUP BY character_id, character_name
       ORDER BY (silver_won + gold_won * 50) DESC
       LIMIT 10`,
    )
    .all(realmId, game, todayStart.getTime()) as unknown as Array<{
    character_id: number;
    character_name: string;
    silver_won: number;
    gold_won: number;
    win_count: number;
  }>;

  const todayLeaderboard: CasinoLeaderboardEntry[] = lbRows.map((row, idx) => ({
    rank: idx + 1,
    characterId: row.character_id,
    characterName: row.character_name,
    totalSilverWon: row.silver_won ?? 0,
    totalGoldWon: row.gold_won ?? 0,
    winCount: row.win_count ?? 0,
  }));

  return {
    game,
    intervalSec: Math.round(CASINO_INTERVAL_MS[game] / 1000),
    lockBeforeSec: Math.round(CASINO_LOCK_MS / 1000),
    currentRound: toCasinoRoundView(currentRow, { poolByChoice }),
    history: historyRows.map((r) => toCasinoRoundView(r, { mySummary: myByRound.get(r.id) })),
    myCurrentBets: myCurrentRows.map(toCasinoBetView),
    myRecentBets: myRecentRows.map(toCasinoBetView),
    lastRoundTopWinners,
    todayLeaderboard,
  };
}

export function getCasinoState(
  realmId: string,
  characterId: number,
): { state: CasinoStateView; character: CharacterView; announcements: string[] } {
  const now = Date.now();
  const a1 = syncCasinoGame(realmId, 'dice', now).announcements;
  const a2 = syncCasinoGame(realmId, 'chibi', now).announcements;
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  return {
    state: {
      serverNow: Date.now(),
      dice: buildCasinoGameState(realmId, characterId, 'dice'),
      chibi: buildCasinoGameState(realmId, characterId, 'chibi'),
    },
    character: ch,
    announcements: [...a1, ...a2],
  };
}

function placeCasinoBet(
  characterId: number,
  game: CasinoGameType,
  choice: string,
  currency: CasinoCurrency,
  rawAmount: number,
): CasinoBetPlacementResult & { announcements: string[] } {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  if (game === 'dice') {
    if (!['big', 'small', 'odd', 'even', 'baozi'].includes(choice)) {
      throw new Error('无效的骰子押注类型');
    }
  } else {
    if (!['wei', 'wu', 'shu'].includes(choice)) {
      throw new Error('无效的赤壁押注阵营（仅支持魏/吴/蜀）');
    }
  }
  if (currency !== 'silver' && currency !== 'gold') {
    throw new Error('无效的押注货币（仅支持银两或金砖）');
  }
  const amount = Math.floor(rawAmount);
  const minBet = currency === 'gold' ? 10 : 50;
  const maxBet = currency === 'gold' ? 2000 : 50000;
  if (!Number.isFinite(amount) || amount < minBet || amount > maxBet) {
    throw new Error(`单注范围：${minBet} ~ ${maxBet} ${currency === 'gold' ? '金砖' : '银两'}`);
  }

  const now = Date.now();
  const syncRes = syncCasinoGame(ch.realmId, game, now);

  const insertedBet = withTx(() => {
    const round = db
      .prepare(
        "SELECT * FROM casino_rounds WHERE realm_id = ? AND game = ? AND status = 'open' ORDER BY round_no DESC LIMIT 1",
      )
      .get(ch.realmId, game) as CasinoRoundRow | undefined;
    if (!round) throw new Error('当前赌局暂未开盘，请稍后重试');
    if (round.draw_at - now <= CASINO_LOCK_MS) {
      throw new Error('本期已封盘开奖中，请稍候下注下期');
    }

    const myRoundCount = (
      db
        .prepare('SELECT COUNT(*) AS cnt FROM casino_bets WHERE round_id = ? AND character_id = ?')
        .get(round.id, characterId) as { cnt: number }
    ).cnt;
    if (myRoundCount >= CASINO_MAX_BETS_PER_ROUND) {
      throw new Error(`每期最多下注 ${CASINO_MAX_BETS_PER_ROUND} 笔，请等待本期开奖`);
    }

    const col = currency === 'gold' ? 'gold' : 'silver';
    const liveRow = db
      .prepare(`SELECT ${col} AS bal FROM characters WHERE id = ?`)
      .get(characterId) as { bal: number } | undefined;
    if (!liveRow || liveRow.bal < amount) {
      throw new Error(`${currency === 'gold' ? '金砖' : '银两'}不足`);
    }

    db.prepare(`UPDATE characters SET ${col} = ${col} - ?, updated_at = ? WHERE id = ?`).run(
      amount,
      now,
      characterId,
    );

    const betInfo = db
      .prepare(
        `INSERT INTO casino_bets (
          round_id, realm_id, game, round_no, character_id, character_name,
          choice, currency, amount, status, payout, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?)`,
      )
      .run(
        round.id,
        ch.realmId,
        game,
        round.round_no,
        characterId,
        ch.name,
        choice,
        currency,
        amount,
        now,
      );

    const poolCol = currency === 'gold' ? 'total_gold_bet' : 'total_silver_bet';
    db.prepare(
      `UPDATE casino_rounds SET total_bets = total_bets + 1, ${poolCol} = ${poolCol} + ? WHERE id = ?`,
    ).run(amount, round.id);

    return db
      .prepare('SELECT * FROM casino_bets WHERE id = ?')
      .get(Number(betInfo.lastInsertRowid)) as unknown as CasinoBetRow;
  });

  const label =
    game === 'dice'
      ? DICE_CHOICE_LABELS[choice as CasinoDiceChoice]
      : CHIBI_CHOICE_LABELS[choice as CasinoChibiChoice];
  const unit = currency === 'gold' ? '金砖' : '银两';
  const full = getCasinoState(ch.realmId, characterId);
  return {
    bet: toCasinoBetView(insertedBet),
    state: full.state,
    character: full.character,
    announcements: [...syncRes.announcements, ...full.announcements],
    message: `已下注第 ${insertedBet.round_no} 期【${label}】${amount} ${unit}，静候开奖！`,
  };
}

export function playCasinoDice(
  characterId: number,
  opts: {
    betType: CasinoDiceChoice;
    currency: CasinoCurrency;
    amount: number;
  },
): CasinoBetPlacementResult & { announcements: string[] } {
  return placeCasinoBet(characterId, 'dice', opts.betType, opts.currency, opts.amount);
}

export function playCasinoChibi(
  characterId: number,
  opts: {
    pick: CasinoChibiChoice;
    currency: CasinoCurrency;
    amount: number;
  },
): CasinoBetPlacementResult & { announcements: string[] } {
  return placeCasinoBet(characterId, 'chibi', opts.pick, opts.currency, opts.amount);
}

function withTx<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const res = fn();
    db.exec('COMMIT');
    return res;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback error
    }
    throw err;
  }
}

export function bankTransfer(
  characterId: number,
  action:
    | 'deposit_silver'
    | 'withdraw_silver'
    | 'deposit_gold'
    | 'withdraw_gold'
    | 'gold_to_silver'
    | 'silver_to_gold',
  rawAmount: number,
): { character: CharacterView; message: string } {
  const amount = Math.floor(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('请输入大于 0 的数量');
  }
  return withTx(() => {
    const ch = getCharacterById(characterId);
    if (!ch) throw new Error('角色不存在');
    const now = Date.now();

    if (action === 'deposit_silver') {
      if (ch.silver < amount) throw new Error('随身银两不足');
      db.prepare(
        'UPDATE characters SET silver = silver - ?, bank_silver = bank_silver + ?, updated_at = ? WHERE id = ?',
      ).run(amount, amount, now, characterId);
      return { character: getCharacterById(characterId)!, message: `已存入钱庄 ${amount} 银两` };
    }
    if (action === 'withdraw_silver') {
      if (ch.bank.silver < amount) throw new Error('钱庄银两余额不足');
      db.prepare(
        'UPDATE characters SET silver = silver + ?, bank_silver = bank_silver - ?, updated_at = ? WHERE id = ?',
      ).run(amount, amount, now, characterId);
      return { character: getCharacterById(characterId)!, message: `已从钱庄取出 ${amount} 银两` };
    }
    if (action === 'deposit_gold') {
      if (ch.gold < amount) throw new Error('随身金砖不足');
      db.prepare(
        'UPDATE characters SET gold = gold - ?, bank_gold = bank_gold + ?, updated_at = ? WHERE id = ?',
      ).run(amount, amount, now, characterId);
      return { character: getCharacterById(characterId)!, message: `已存入钱庄 ${amount} 金砖` };
    }
    if (action === 'withdraw_gold') {
      if (ch.bank.gold < amount) throw new Error('钱庄金砖余额不足');
      db.prepare(
        'UPDATE characters SET gold = gold + ?, bank_gold = bank_gold - ?, updated_at = ? WHERE id = ?',
      ).run(amount, amount, now, characterId);
      return { character: getCharacterById(characterId)!, message: `已从钱庄取出 ${amount} 金砖` };
    }
    if (action === 'gold_to_silver') {
      if (ch.gold < amount) throw new Error('随身金砖不足');
      const silverGain = amount * 500;
      db.prepare(
        'UPDATE characters SET gold = gold - ?, silver = silver + ?, updated_at = ? WHERE id = ?',
      ).run(amount, silverGain, now, characterId);
      return {
        character: getCharacterById(characterId)!,
        message: `兑换成功！${amount} 金砖 → ${silverGain} 银两`,
      };
    }
    const silverCost = amount * 550;
    if (ch.silver < silverCost) throw new Error(`银两不足，兑换 ${amount} 金砖需 ${silverCost} 银两`);
    db.prepare(
      'UPDATE characters SET silver = silver - ?, gold = gold + ?, updated_at = ? WHERE id = ?',
    ).run(silverCost, amount, now, characterId);
    return {
      character: getCharacterById(characterId)!,
      message: `兑换成功！${silverCost} 银两 → ${amount} 金砖`,
    };
  });
}

interface MarketRow {
  id: number;
  realm_id: string;
  seller_id: number;
  seller_name: string;
  kind: MarketListingKind;
  title: string;
  summary: string;
  payload_json: string;
  currency: 'silver' | 'gold';
  price: number;
  status: string;
  created_at: number;
}

function toMarketView(r: MarketRow): MarketListingView {
  return {
    id: r.id,
    realmId: r.realm_id,
    sellerId: r.seller_id,
    sellerName: r.seller_name,
    kind: r.kind,
    title: r.title,
    summary: r.summary,
    currency: r.currency,
    price: r.price,
    createdAt: r.created_at,
  };
}

export function getMarketListings(
  realmId: string,
  kind: 'all' | MarketListingKind = 'all',
): MarketListingView[] {
  const rows =
    kind === 'all'
      ? (db
          .prepare(
            `SELECT * FROM market_listings WHERE realm_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 80`,
          )
          .all(realmId) as unknown as MarketRow[])
      : (db
          .prepare(
            `SELECT * FROM market_listings WHERE realm_id = ? AND status = 'active' AND kind = ? ORDER BY created_at DESC LIMIT 80`,
          )
          .all(realmId, kind) as unknown as MarketRow[]);
  return rows.map(toMarketView);
}

export function createMarketListing(
  characterId: number,
  opts: {
    kind: MarketListingKind;
    refId: string | number;
    quantity?: number;
    currency: 'silver' | 'gold';
    price: number;
  },
): { listing: MarketListingView; character: CharacterView; message: string } {
  const currency = opts.currency === 'gold' ? 'gold' : 'silver';
  const price = Math.floor(opts.price);
  if (!Number.isFinite(price) || price < 1 || price > 999_999) {
    throw new Error('定价范围需在 1 ~ 999,999 之间');
  }

  return withTx(() => {
    const ch = getCharacterById(characterId);
    if (!ch) throw new Error('角色不存在');
    const activeCount = (
      db
        .prepare(`SELECT COUNT(*) AS cnt FROM market_listings WHERE seller_id = ? AND status = 'active'`)
        .get(characterId) as { cnt: number }
    ).cnt;
    if (activeCount >= 10) throw new Error('每人最多同时寄售 10 件商品');

    let title = '';
    let summary = '';
    let payload: unknown;
    const now = Date.now();

    if (opts.kind === 'item') {
      const itemId = String(opts.refId);
      const qty = Math.max(1, Math.min(99, Math.floor(opts.quantity ?? 1)));
      const tpl = ITEMS[itemId];
      if (!tpl) throw new Error('道具不存在');
      const owned = ch.inventory.find((i) => i.itemId === itemId);
      if (!owned || owned.quantity < qty) throw new Error('行囊中该道具数量不足');
      addItem(characterId, itemId, -qty);
      title = `${tpl.name} ×${qty}`;
      summary = tpl.desc;
      payload = { itemId, quantity: qty };
    } else if (opts.kind === 'equipment') {
      const equipId = Number(opts.refId);
      const row = db
        .prepare('SELECT * FROM character_equipment WHERE id = ? AND character_id = ?')
        .get(equipId, characterId) as EquipmentRow | undefined;
      if (!row) throw new Error('装备不存在');
      if (row.equipped) throw new Error('请先卸下装备再上架寄售');
      db.prepare('DELETE FROM character_equipment WHERE id = ? AND character_id = ?').run(
        equipId,
        characterId,
      );
      const statParts: string[] = [];
      if (row.atk_bonus) statParts.push(`攻+${row.atk_bonus}`);
      if (row.hp_bonus) statParts.push(`血+${row.hp_bonus}`);
      if (row.mp_bonus) statParts.push(`精+${row.mp_bonus}`);
      if (row.def_bonus) statParts.push(`防+${row.def_bonus}`);
      if (row.spd_bonus) statParts.push(`速+${row.spd_bonus}`);
      if (row.res_phys) statParts.push(`抗物+${row.res_phys}%`);
      if (row.res_chaos) statParts.push(`抗乱+${row.res_chaos}%`);
      if (row.res_seal) statParts.push(`抗封+${row.res_seal}%`);
      if (row.res_trap) statParts.push(`抗围+${row.res_trap}%`);
      if (row.res_magic) statParts.push(`抗法+${row.res_magic}%`);
      title = `[Lv.${row.level_req}] ${row.name}`;
      summary = statParts.join(' · ') || '经典装备';
      payload = {
        template_id: row.template_id,
        name: row.name,
        slot: row.slot,
        quality: row.quality,
        icon: row.icon,
        level_req: row.level_req,
        hp_bonus: row.hp_bonus,
        mp_bonus: row.mp_bonus,
        atk_bonus: row.atk_bonus,
        def_bonus: row.def_bonus,
        spd_bonus: row.spd_bonus,
        res_phys: row.res_phys,
        res_chaos: row.res_chaos,
        res_seal: row.res_seal,
        res_trap: row.res_trap,
        res_magic: row.res_magic,
        sell_silver: row.sell_silver,
      };
    } else if (opts.kind === 'general') {
      const genId = Number(opts.refId);
      const row = db
        .prepare('SELECT * FROM generals WHERE id = ? AND character_id = ?')
        .get(genId, characterId) as GeneralRow | undefined;
      if (!row) throw new Error('副将不存在');
      if (row.slot !== null) throw new Error('请先卸下出战副将再上架寄售');
      db.prepare('DELETE FROM generals WHERE id = ? AND character_id = ?').run(genId, characterId);
      const sk1 = SKILLS.find((s) => s.id === row.skill_id)?.name ?? '力劈华山';
      const sk2 = row.skill2_id ? SKILLS.find((s) => s.id === row.skill2_id)?.name : null;
      title = `${row.name} Lv.${row.level}${row.rebirth > 0 ? ` [${row.rebirth}转]` : ''}`;
      summary = `成长 ${row.growth.toFixed(2)} · 技:${sk1}${sk2 ? `/${sk2}` : ''} · 血${row.max_hp} 攻${row.atk} 速${row.spd}`;
      payload = {
        template_id: row.template_id,
        name: row.name,
        role_class: row.role_class,
        sprite_key: row.sprite_key,
        avatar_key: GENERAL_TEMPLATES[row.template_id]?.avatarKey || row.avatar_key,
        level: row.level,
        exp: row.exp,
        hp: row.max_hp,
        max_hp: row.max_hp,
        mp: row.max_mp,
        max_mp: row.max_mp,
        atk: row.atk,
        spd: row.spd,
        base_hp: row.base_hp,
        base_mp: row.base_mp,
        base_atk: row.base_atk,
        base_spd: row.base_spd,
        growth: row.growth,
        rebirth: row.rebirth,
        rarity: row.rarity,
        skill_id: row.skill_id,
        skill2_id: row.skill2_id,
        intimacy: row.intimacy ?? 0,
      };
    } else {
      throw new Error('无效的寄售类型');
    }

    const info = db
      .prepare(
        `INSERT INTO market_listings (
          realm_id, seller_id, seller_name, kind, title, summary, payload_json,
          currency, price, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      )
      .run(
        ch.realmId,
        ch.id,
        ch.name,
        opts.kind,
        title,
        summary,
        JSON.stringify(payload),
        currency,
        price,
        now,
        now,
      );

    const inserted = db
      .prepare('SELECT * FROM market_listings WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as unknown as MarketRow;
    const unit = currency === 'gold' ? '金砖' : '银两';
    return {
      listing: toMarketView(inserted),
      character: getCharacterById(characterId)!,
      message: `已成功上架【${title}】，标价 ${price} ${unit}！`,
    };
  });
}

function deliverMarketPayload(recipientId: number, kind: MarketListingKind, payloadJson: string) {
  const data = JSON.parse(payloadJson) as Record<string, unknown>;
  const now = Date.now();
  if (kind === 'item') {
    addItem(recipientId, String(data.itemId), Number(data.quantity));
    return;
  }
  if (kind === 'equipment') {
    const cnt = (
      db
        .prepare('SELECT COUNT(*) AS cnt FROM character_equipment WHERE character_id = ?')
        .get(recipientId) as { cnt: number }
    ).cnt;
    if (cnt >= 30) throw new Error('装备栏已满（最多 30 件），无法接收该装备');
    db.prepare(
      `INSERT INTO character_equipment (
        character_id, template_id, name, slot, quality, icon, level_req,
        hp_bonus, mp_bonus, atk_bonus, def_bonus, spd_bonus,
        res_phys, res_chaos, res_seal, res_trap, res_magic,
        sell_silver, equipped, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    ).run(
      recipientId,
      String(data.template_id),
      String(data.name),
      String(data.slot),
      String(data.quality),
      String(data.icon),
      Number(data.level_req),
      Number(data.hp_bonus),
      Number(data.mp_bonus),
      Number(data.atk_bonus),
      Number(data.def_bonus),
      Number(data.spd_bonus),
      Number(data.res_phys),
      Number(data.res_chaos),
      Number(data.res_seal),
      Number(data.res_trap),
      Number(data.res_magic),
      Number(data.sell_silver),
      now,
    );
    return;
  }
  const gCnt = (
    db.prepare('SELECT COUNT(*) AS cnt FROM generals WHERE character_id = ?').get(recipientId) as {
      cnt: number;
    }
  ).cnt;
  if (gCnt >= 16) throw new Error('副将栏已满（最多 16 名），无法接收该副将');
  db.prepare(
    `INSERT INTO generals (
      character_id, template_id, name, role_class, sprite_key, avatar_key,
      level, exp, hp, max_hp, mp, max_mp, atk, spd,
      base_hp, base_mp, base_atk, base_spd, growth, rebirth, rarity, skill_id, skill2_id, intimacy,
      slot, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).run(
    recipientId,
    String(data.template_id),
    String(data.name),
    String(data.role_class),
    String(data.sprite_key),
    GENERAL_TEMPLATES[String(data.template_id)]?.avatarKey || String(data.avatar_key),
    Number(data.level),
    Number(data.exp),
    Number(data.hp),
    Number(data.max_hp),
    Number(data.mp),
    Number(data.max_mp),
    Number(data.atk),
    Number(data.spd),
    Number(data.base_hp),
    Number(data.base_mp),
    Number(data.base_atk),
    Number(data.base_spd),
    Number(data.growth),
    Number(data.rebirth),
    String(data.rarity),
    String(data.skill_id),
    data.skill2_id ? String(data.skill2_id) : null,
    Number(data.intimacy ?? 0),
    now,
  );
}

export function buyMarketListing(
  buyerId: number,
  listingId: number,
): { character: CharacterView; message: string; tradeAnnouncement: string } {
  return withTx(() => {
    const buyer = getCharacterById(buyerId);
    if (!buyer) throw new Error('角色不存在');
    const row = db
      .prepare('SELECT * FROM market_listings WHERE id = ? AND realm_id = ?')
      .get(listingId, buyer.realmId) as unknown as MarketRow | undefined;
    if (!row || row.status !== 'active') throw new Error('该商品已被购走或已下架');
    if (row.seller_id === buyerId) throw new Error('不能购买自己寄售的商品，如需取回请点「下架」');

    const col = row.currency === 'gold' ? 'gold' : 'silver';
    const bankCol = row.currency === 'gold' ? 'bank_gold' : 'bank_silver';
    const balance = row.currency === 'gold' ? buyer.gold : buyer.silver;
    if (balance < row.price) {
      throw new Error(`${row.currency === 'gold' ? '金砖' : '银两'}不足`);
    }

    deliverMarketPayload(buyerId, row.kind, row.payload_json);

    const now = Date.now();
    const sellerProceeds = Math.max(1, Math.floor(row.price * 0.95));
    db.prepare(`UPDATE characters SET ${col} = ${col} - ?, updated_at = ? WHERE id = ?`).run(
      row.price,
      now,
      buyerId,
    );
    db.prepare(`UPDATE characters SET ${bankCol} = ${bankCol} + ?, updated_at = ? WHERE id = ?`).run(
      sellerProceeds,
      now,
      row.seller_id,
    );
    db.prepare(
      `UPDATE market_listings SET status = 'sold', buyer_id = ?, buyer_name = ?, updated_at = ? WHERE id = ?`,
    ).run(buyerId, buyer.name, now, listingId);

    const unit = row.currency === 'gold' ? '金砖' : '银两';
    sendSystemMail(
      buyer.realmId,
      row.seller_id,
      row.seller_name,
      `集市成交：${row.title}`,
      `恭喜！【${buyer.name}】以 ${row.price} ${unit} 购买了你寄售的【${row.title}】。扣除 5% 税费后，实得 ${sellerProceeds} ${unit} 已自动存入你的许昌钱庄金库！`,
    );

    return {
      character: getCharacterById(buyerId)!,
      message: `购买成功！【${row.title}】已存入行囊/营帐（花费 ${row.price} ${unit}）`,
      tradeAnnouncement: `【集市成交】${buyer.name} 以 ${row.price}${unit} 拍下了 ${row.seller_name} 寄售的【${row.title}】（货款已入卖家钱庄）！`,
    };
  });
}

export function cancelMarketListing(
  sellerId: number,
  listingId: number,
): { character: CharacterView; message: string } {
  return withTx(() => {
    const seller = getCharacterById(sellerId);
    if (!seller) throw new Error('角色不存在');
    const row = db
      .prepare('SELECT * FROM market_listings WHERE id = ? AND seller_id = ?')
      .get(listingId, sellerId) as unknown as MarketRow | undefined;
    if (!row || row.status !== 'active') throw new Error('该商品已售出或已下架');

    deliverMarketPayload(sellerId, row.kind, row.payload_json);
    db.prepare(`UPDATE market_listings SET status = 'cancelled', updated_at = ? WHERE id = ?`).run(
      Date.now(),
      listingId,
    );

    return {
      character: getCharacterById(sellerId)!,
      message: `已下架并取回【${row.title}】`,
    };
  });
}

export function sendSystemMail(
  realmId: string,
  recipientId: number,
  recipientName: string,
  subject: string,
  body: string,
  attachSilver = 0,
  attachGold = 0,
): void {
  db.prepare(
    `INSERT INTO mails (
      realm_id, sender_id, sender_name, recipient_id, recipient_name,
      subject, body, attach_silver, attach_gold, claimed, is_read, created_at
    ) VALUES (?, 0, '系统飞鸽', ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(
    realmId,
    recipientId,
    recipientName,
    subject.slice(0, 60),
    body.slice(0, 500),
    Math.max(0, Math.floor(attachSilver)),
    Math.max(0, Math.floor(attachGold)),
    attachSilver > 0 || attachGold > 0 ? 0 : 1,
    Date.now(),
  );
}

interface MailRow {
  id: number;
  sender_id: number;
  sender_name: string;
  recipient_id: number;
  recipient_name: string;
  subject: string;
  body: string;
  attach_silver: number;
  attach_gold: number;
  claimed: number;
  is_read: number;
  created_at: number;
}

export function getMails(characterId: number): MailView[] {
  const rows = db
    .prepare('SELECT * FROM mails WHERE recipient_id = ? ORDER BY created_at DESC LIMIT 50')
    .all(characterId) as unknown as MailRow[];
  return rows.map((r) => ({
    id: r.id,
    senderId: r.sender_id,
    senderName: r.sender_name,
    recipientId: r.recipient_id,
    recipientName: r.recipient_name,
    subject: r.subject,
    body: r.body,
    attachSilver: r.attach_silver,
    attachGold: r.attach_gold,
    claimed: Boolean(r.claimed),
    isRead: Boolean(r.is_read),
    createdAt: r.created_at,
  }));
}

export function sendPlayerMail(
  senderId: number,
  opts: {
    recipientName: string;
    subject: string;
    body: string;
    attachSilver?: number;
    attachGold?: number;
  },
): { character: CharacterView; message: string } {
  const recName = opts.recipientName.trim();
  const subject = opts.subject.trim() || '飞鸽传书';
  const body = opts.body.trim();
  if (!recName) throw new Error('请输入收件人角色名');
  if (!body) throw new Error('信件内容不能为空');

  const attachSilver = Math.max(0, Math.floor(opts.attachSilver ?? 0));
  const attachGold = Math.max(0, Math.floor(opts.attachGold ?? 0));

  return withTx(() => {
    const sender = getCharacterById(senderId);
    if (!sender) throw new Error('角色不存在');
    const recipient = db
      .prepare('SELECT id, name FROM characters WHERE realm_id = ? AND name = ?')
      .get(sender.realmId, recName) as { id: number; name: string } | undefined;
    if (!recipient) throw new Error(`同区未找到角色【${recName}】`);
    if (recipient.id === senderId) throw new Error('不能给自己发飞鸽传书');
    if (sender.silver < attachSilver) throw new Error('随身银两不足以附寄');
    if (sender.gold < attachGold) throw new Error('随身金砖不足以附寄');

    const now = Date.now();
    if (attachSilver > 0 || attachGold > 0) {
      db.prepare(
        'UPDATE characters SET silver = silver - ?, gold = gold - ?, updated_at = ? WHERE id = ?',
      ).run(attachSilver, attachGold, now, senderId);
    }

    db.prepare(
      `INSERT INTO mails (
        realm_id, sender_id, sender_name, recipient_id, recipient_name,
        subject, body, attach_silver, attach_gold, claimed, is_read, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    ).run(
      sender.realmId,
      sender.id,
      sender.name,
      recipient.id,
      recipient.name,
      subject.slice(0, 60),
      body.slice(0, 500),
      attachSilver,
      attachGold,
      attachSilver > 0 || attachGold > 0 ? 0 : 1,
      now,
    );

    const giftText =
      attachSilver > 0 || attachGold > 0
        ? `（附寄 ${[attachSilver > 0 ? `${attachSilver}银` : '', attachGold > 0 ? `${attachGold}金` : ''].filter(Boolean).join('+')}）`
        : '';
    return {
      character: getCharacterById(senderId)!,
      message: `飞鸽已发出！寄给【${recipient.name}】${giftText}`,
    };
  });
}

export function markMailRead(characterId: number, mailId: number): CharacterView {
  db.prepare('UPDATE mails SET is_read = 1 WHERE id = ? AND recipient_id = ?').run(
    mailId,
    characterId,
  );
  return getCharacterById(characterId)!;
}

export function claimMailAttachment(
  characterId: number,
  mailId: number,
): { character: CharacterView; message: string } {
  return withTx(() => {
    const row = db
      .prepare('SELECT * FROM mails WHERE id = ? AND recipient_id = ?')
      .get(mailId, characterId) as unknown as MailRow | undefined;
    if (!row) throw new Error('邮件不存在');
    if (row.claimed || (row.attach_silver <= 0 && row.attach_gold <= 0)) {
      throw new Error('该信件没有可领取的附件');
    }
    db.prepare('UPDATE mails SET claimed = 1, is_read = 1 WHERE id = ?').run(mailId);
    db.prepare(
      'UPDATE characters SET silver = silver + ?, gold = gold + ?, updated_at = ? WHERE id = ?',
    ).run(row.attach_silver, row.attach_gold, Date.now(), characterId);
    const parts: string[] = [];
    if (row.attach_silver > 0) parts.push(`银两 +${row.attach_silver}`);
    if (row.attach_gold > 0) parts.push(`金砖 +${row.attach_gold}`);
    return {
      character: getCharacterById(characterId)!,
      message: `已领取飞鸽附件：${parts.join('、')}`,
    };
  });
}

export function deleteMail(
  characterId: number,
  mailId: number,
): { character: CharacterView; message: string } {
  const row = db
    .prepare('SELECT id, claimed, attach_silver, attach_gold FROM mails WHERE id = ? AND recipient_id = ?')
    .get(mailId, characterId) as
    | { id: number; claimed: number; attach_silver: number; attach_gold: number }
    | undefined;
  if (!row) throw new Error('邮件不存在');
  if (!row.claimed && (row.attach_silver > 0 || row.attach_gold > 0)) {
    throw new Error('请先领取附件再删除信件');
  }
  db.prepare('DELETE FROM mails WHERE id = ? AND recipient_id = ?').run(mailId, characterId);
  return {
    character: getCharacterById(characterId)!,
    message: '信件已删除',
  };
}

export function recordArenaOutcome(
  challengerId: number,
  targetId: number,
  won: boolean,
): { exp: number; silver: number; summary: string } {
  const ch = getCharacterById(challengerId);
  const target = getCharacterById(targetId);
  if (!ch || !target) return { exp: 0, silver: 0, summary: '擂台切磋结束' };

  const today = getTodayDateStr();
  let exp = 0;
  let silver = 0;
  let summary = '';

  if (won) {
    const usedToday = 5 - ch.arena.dailyRewardsLeft;
    const canReward = ch.arena.dailyRewardsLeft > 0;
    if (canReward) {
      exp = 80 + target.level * 25;
      silver = 120 + target.level * 30;
    }
    db.prepare(
      `UPDATE characters
       SET arena_wins = arena_wins + 1,
           arena_daily_rewards = ?,
           arena_reward_date = ?,
           updated_at = ?
       WHERE id = ?`,
    ).run(canReward ? usedToday + 1 : usedToday, today, Date.now(), challengerId);
    db.prepare('UPDATE characters SET arena_losses = arena_losses + 1 WHERE id = ?').run(targetId);

    sendSystemMail(
      ch.realmId,
      target.id,
      target.name,
      `擂台战报：${ch.name} 切磋挑战`,
      `【${ch.name}】(Lv.${ch.level}) 在许昌演武擂台向你的离线镜像发起了切磋，经过一番激战你的镜像惜败（你的随身财物与气血无任何损失，可随时到排行榜回敬切磋！）。`,
    );
    summary = canReward
      ? `⚔ 擂台切磋大胜【${target.name}】！今日有奖切磋剩余 ${Math.max(0, ch.arena.dailyRewardsLeft - 1)}/5 次`
      : `⚔ 擂台切磋大胜【${target.name}】！（今日有奖次数已满，计入胜场战绩）`;
  } else {
    db.prepare('UPDATE characters SET arena_losses = arena_losses + 1 WHERE id = ?').run(
      challengerId,
    );
    db.prepare('UPDATE characters SET arena_wins = arena_wins + 1 WHERE id = ?').run(targetId);
    sendSystemMail(
      ch.realmId,
      target.id,
      target.name,
      `擂台捷报：成功击退 ${ch.name}`,
      `【${ch.name}】(Lv.${ch.level}) 在许昌演武擂台挑战你的离线镜像，被你的精锐阵容成功击退！`,
    );
    summary = `擂台切磋惜败于【${target.name}】的镜像阵容，再接再厉！`;
  }

  return { exp, silver, summary };
}

// ============================================================
// Stage 2: Daily Low-Burden Loops (Keju 5Q / Escort 1x / World Boss 1x)
// ============================================================

const KEJU_DAILY_TOTAL = 5;

function getDailyKejuQuestions(dateStr: string, characterId: number) {
  // Deterministic Fisher-Yates seeded by dateStr + characterId
  let seed = characterId * 2654435761;
  for (let i = 0; i < dateStr.length; i++) {
    seed = ((seed << 5) - seed + dateStr.charCodeAt(i)) | 0;
  }
  const indices = KEJU_QUESTIONS.map((_, idx) => idx);
  let state = Math.abs(seed) || 1337;
  for (let i = indices.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  return indices.slice(0, KEJU_DAILY_TOTAL).map((idx) => KEJU_QUESTIONS[idx]);
}

function calcEscortReward(level: number) {
  const lv = Math.max(1, level);
  const exp = Math.round(700 + lv * 520 + (lv > 15 ? Math.pow(lv - 15, 1.65) * 180 : 0));
  const silver = Math.round(950 + lv * 135);
  const gold = 30;
  return { exp, silver, gold };
}

function buildDailyState(row: CharacterRow): DailyStateView {
  const today = getTodayDateStr();
  const kejuSameDay = row.keju_date === today;
  const answered = kejuSameDay ? Math.min(KEJU_DAILY_TOTAL, Math.max(0, row.keju_answered ?? 0)) : 0;
  const correct = kejuSameDay ? Math.min(answered, Math.max(0, row.keju_correct ?? 0)) : 0;
  const completed = answered >= KEJU_DAILY_TOTAL;
  const questions = getDailyKejuQuestions(today, row.id);
  const nextQ = !completed ? questions[answered] : null;

  const escortSameDay = row.escort_date === today;
  const rawEscortStatus = escortSameDay ? (row.escort_status ?? 'idle') : 'idle';
  const escortCompleted = rawEscortStatus === 'done';
  const escortStatus: 'idle' | 'active' | 'ready' =
    rawEscortStatus === 'active' || rawEscortStatus === 'ready' ? rawEscortStatus : 'idle';
  const escortOriginId = escortSameDay && escortStatus !== 'idle' ? (row.escort_origin_map_id ?? undefined) : undefined;
  const escortTargetId = escortSameDay && escortStatus !== 'idle' ? (row.escort_target_map_id ?? undefined) : undefined;
  const escortRew = calcEscortReward(row.level);

  const wb = getCurrentWorldBoss();
  const claimedToday = row.world_boss_date === today;

  return {
    keju: {
      totalQuestions: KEJU_DAILY_TOTAL,
      answered,
      correct,
      completed,
      currentQuestion: nextQ
        ? {
            index: answered,
            question: nextQ.question,
            options: nextQ.options,
          }
        : null,
    },
    escort: {
      completedToday: escortCompleted,
      status: escortStatus,
      originMapId: escortOriginId,
      originMapName: escortOriginId ? (MAPS[escortOriginId]?.name ?? escortOriginId) : undefined,
      targetMapId: escortTargetId,
      targetMapName: escortTargetId ? (MAPS[escortTargetId]?.name ?? escortTargetId) : undefined,
      rewardExp: escortRew.exp,
      rewardSilver: escortRew.silver,
      rewardGold: escortRew.gold,
    },
    worldBoss: {
      hourKey: wb.hourKey,
      bossId: wb.boss.id,
      bossName: wb.boss.name,
      title: wb.boss.title,
      desc: wb.boss.desc,
      mapId: wb.mapId,
      mapName: wb.mapName,
      claimedToday,
      nextRefreshMinutes: wb.nextRefreshMinutes,
    },
  };
}

export function answerKejuQuestion(
  characterId: number,
  optionIndex: number,
): {
  correct: boolean;
  correctAnswerText: string;
  explanation: string;
  finished: boolean;
  message: string;
  broadcast?: string;
  character: CharacterView;
} {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
    throw new Error('无效的答案选项');
  }
  if (ch.daily.keju.completed) {
    throw new Error('今日科举 5 题已全部作答完毕，明日再来吧');
  }

  const today = getTodayDateStr();
  const questions = getDailyKejuQuestions(today, characterId);
  const qIdx = ch.daily.keju.answered;
  const q = questions[qIdx];
  if (!q) throw new Error('题目不存在');

  const isCorrect = optionIndex === q.answerIndex;
  const nextAnswered = qIdx + 1;
  const nextCorrect = ch.daily.keju.correct + (isCorrect ? 1 : 0);

  const lv = ch.level;
  const fullExp = Math.round(180 + lv * 150 + (lv > 15 ? Math.pow(lv - 15, 1.55) * 65 : 0));
  const fullSilver = Math.round(220 + lv * 60);
  const expGain = isCorrect ? fullExp : Math.round(fullExp * 0.35);
  const silverGain = isCorrect ? fullSilver : Math.round(fullSilver * 0.35);

  db.prepare(
    `UPDATE characters
     SET keju_date = ?, keju_answered = ?, keju_correct = ?, updated_at = ?
     WHERE id = ?`,
  ).run(today, nextAnswered, nextCorrect, Date.now(), characterId);

  const expRes = applyExpAndSilver(characterId, expGain, silverGain);

  const parts: string[] = [
    isCorrect ? `回答正确！` : `回答有误（正确答案：${q.options[q.answerIndex]}）。`,
    `经验+${expRes.appliedExp}、银两+${silverGain}`,
  ];

  const finished = nextAnswered >= KEJU_DAILY_TOTAL;
  let broadcast: string | undefined;

  if (finished) {
    if (nextCorrect === KEJU_DAILY_TOTAL) {
      db.prepare('UPDATE characters SET gold = gold + 50, updated_at = ? WHERE id = ?').run(
        Date.now(),
        characterId,
      );
      addItem(characterId, 'jiangling', 1);
      addItem(characterId, 'xisuidan', 1);
      addItem(characterId, 'baotu', 1);
      parts.push('🏆 金榜状元（5/5 全对）加赠：金砖+50、招贤令×1、洗髓丹×1、藏宝图×1！');
      broadcast = `【科举发榜】恭贺 ${ch.name} 在每日科举文试中 5 题全对高中状元，获赐招贤令与洗髓丹！`;
    } else if (nextCorrect >= 3) {
      db.prepare('UPDATE characters SET gold = gold + 30, updated_at = ? WHERE id = ?').run(
        Date.now(),
        characterId,
      );
      addItem(characterId, 'jingyandan', 2);
      addItem(characterId, 'baotu', 1);
      parts.push(`📜 科举进士（答对 ${nextCorrect}/5）加赠：金砖+30、副将经验丹×2、藏宝图×1！`);
    } else {
      db.prepare('UPDATE characters SET gold = gold + 15, updated_at = ? WHERE id = ?').run(
        Date.now(),
        characterId,
      );
      addItem(characterId, 'jingyandan', 1);
      parts.push(`📜 科举举人（答对 ${nextCorrect}/5）加赠：金砖+15、副将经验丹×1！`);
    }
  }

  return {
    correct: isCorrect,
    correctAnswerText: q.options[q.answerIndex],
    explanation: q.explanation,
    finished,
    message: parts.join(' '),
    broadcast,
    character: getCharacterById(characterId)!,
  };
}

export function startDailyEscort(characterId: number): {
  character: CharacterView;
  message: string;
} {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  if (ch.daily.escort.completedToday) {
    throw new Error('今日运镖（每日 1 趟）已完成，明日再来接镖吧');
  }
  if (ch.daily.escort.status !== 'idle') {
    throw new Error('你已有一趟进行中的押镖任务');
  }

  const today = getTodayDateStr();
  const originMapId = MAPS[ch.mapId]?.isSafe ? ch.mapId : 'xuchang';
  let targetMapId: string;
  if (originMapId === 'xuchang') {
    targetMapId = ch.level >= 22 ? 'jingzhou' : 'luoyang';
  } else {
    targetMapId = 'xuchang';
  }

  db.prepare(
    `UPDATE characters
     SET escort_date = ?, escort_status = 'active',
         escort_origin_map_id = ?, escort_target_map_id = ?, updated_at = ?
     WHERE id = ?`,
  ).run(today, originMapId, targetMapId, Date.now(), characterId);

  const targetName = MAPS[targetMapId]?.name ?? targetMapId;
  return {
    character: getCharacterById(characterId)!,
    message: `已接下皇家重镖！请先击退途中劫匪，随后将镖车护送至【${targetName}】交付领赏！`,
  };
}

export function markEscortBanditCleared(characterId: number): string | null {
  const ch = getCharacterById(characterId);
  if (!ch || ch.daily.escort.status !== 'active') return null;
  db.prepare(
    `UPDATE characters SET escort_status = 'ready', updated_at = ? WHERE id = ?`,
  ).run(Date.now(), characterId);
  const targetName = ch.daily.escort.targetMapName ?? '目标城池';
  return `🚚 已击退劫镖山贼！快前往【${targetName}】交付镖车领取今日运镖大奖！`;
}

export function claimDailyEscort(characterId: number): {
  character: CharacterView;
  message: string;
} {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  if (ch.daily.escort.completedToday) {
    throw new Error('今日运镖奖励已领取');
  }
  if (ch.daily.escort.status === 'idle') {
    throw new Error('请先接取今日运镖任务');
  }
  if (ch.daily.escort.status === 'active') {
    throw new Error('途中仍有黑风寨劫匪拦路，请先迎战击退劫匪！');
  }
  const targetMapId = ch.daily.escort.targetMapId ?? 'luoyang';
  const targetName = MAPS[targetMapId]?.name ?? targetMapId;
  if (ch.mapId !== targetMapId) {
    throw new Error(`请先移动至【${targetName}】再交付镖车`);
  }

  const rew = calcEscortReward(ch.level);
  db.prepare(
    `UPDATE characters
     SET escort_status = 'done', gold = gold + ?, updated_at = ?
     WHERE id = ?`,
  ).run(rew.gold, Date.now(), characterId);

  const expRes = applyExpAndSilver(characterId, rew.exp, rew.silver);
  addItem(characterId, 'baotu', 2);
  addItem(characterId, 'jingyandan', 2);

  return {
    character: getCharacterById(characterId)!,
    message: `🚚 顺利护送重镖抵达【${targetName}】！获赏 经验+${expRes.appliedExp}、银两+${rew.silver}、金砖+${rew.gold}、藏宝图×2、副将经验丹×2！`,
  };
}

export function recordWorldBossVictory(
  characterId: number,
  bossId: string,
): { summary: string; broadcast?: string } {
  const ch = getCharacterById(characterId);
  if (!ch) return { summary: '击退整点名将' };
  const boss = WORLD_BOSS_ROSTER.find((b) => b.id === bossId) ?? WORLD_BOSS_ROSTER[0];
  const today = getTodayDateStr();

  if (ch.daily.worldBoss.claimedToday) {
    return {
      summary: `⚔ 再次切磋击败【${boss.title}·${boss.name}】（今日整点星宿首杀大奖已领取）`,
    };
  }

  const lv = ch.level;
  const bonusExp = Math.round(900 + lv * 640 + (lv > 15 ? Math.pow(lv - 15, 1.7) * 220 : 0));
  const bonusSilver = Math.round(1050 + lv * 155);
  const bonusGold = 45;

  db.prepare(
    `UPDATE characters
     SET world_boss_date = ?, gold = gold + ?, updated_at = ?
     WHERE id = ?`,
  ).run(today, bonusGold, Date.now(), characterId);

  const expRes = applyExpAndSilver(characterId, bonusExp, bonusSilver);
  addItem(characterId, 'xisuidan', 1);

  const parts: string[] = [
    `经验+${expRes.appliedExp}`,
    `银两+${bonusSilver}`,
    `金砖+${bonusGold}`,
    '洗髓丹×1',
  ];

  if (Math.random() < 0.5) {
    const books = Object.keys(GENERAL_SKILL_BOOKS);
    const bookId = books[Math.floor(Math.random() * books.length)];
    addItem(characterId, bookId, 1);
    parts.push(`${ITEMS[bookId].name}×1`);
  } else {
    addItem(characterId, 'jiangling', 2);
    parts.push('招贤令×2');
  }

  const latest = getCharacterById(characterId)!;
  if (Math.random() < 0.5 && latest.equipment.length < 30) {
    const pool =
      lv >= 48
        ? ['fangtian_ji', 'taiji_fajian', 'tianlong_guan', 'qilin_baojia', 'tengyun_xue', 'bailong_ju']
        : lv >= 33
          ? ['zhangba_mao', 'zhuge_yushan', 'wuhou_jin', 'xuanwu_jia', 'lingbo_lv', 'zhuahuang_ma']
          : lv >= 20
            ? ['qinglong_dao', 'fengchi_kui', 'mingguang_kai', 'yunlong_xue', 'jueying_ma']
            : ['longdan_qiang', 'huangjin_jia', 'chitu_ma', 'qixing_jian', 'dilu_ma'];
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const eq = grantEquipmentToCharacter(characterId, picked, true);
    parts.push(`极品战利品【${eq.name}】`);
  }

  return {
    summary: `🌟 今日整点杀星首杀【${boss.title}·${boss.name}】！加赠：${parts.join('、')}`,
    broadcast: `【整点杀星】豪杰 ${ch.name}(Lv.${ch.level}) 孤身击破【${boss.title}·${boss.name}】，满载重赏凯旋！`,
  };
}

// ===== 4.7 Social: Player Inspect & Friends =====
export function inspectPlayer(
  viewerCharacterId: number,
  targetCharacterId: number,
  onlineIds: Set<number>,
): PlayerInspectView {
  const viewer = getCharacterById(viewerCharacterId);
  if (!viewer) throw new Error('当前角色不存在');
  const target = getCharacterById(targetCharacterId);
  if (!target || target.realmId !== viewer.realmId) throw new Error('未找到该侠士');

  const isFriend = Boolean(
    db
      .prepare('SELECT id FROM friends WHERE character_id = ? AND friend_character_id = ?')
      .get(viewerCharacterId, targetCharacterId),
  );
  const map = MAPS[target.mapId] ?? MAPS.xuchang;

  return {
    id: target.id,
    name: target.name,
    roleClass: target.roleClass,
    gender: target.gender,
    portrait: target.portrait,
    level: target.level,
    rebirth: target.rebirth,
    mapId: target.mapId,
    mapName: map.name,
    online: onlineIds.has(target.id),
    isFriend,
    maxHp: target.maxHp,
    maxMp: target.maxMp,
    atk: target.atk,
    def: target.def,
    spd: target.spd,
    arenaWins: target.arena.wins,
    arenaLosses: target.arena.losses,
    towerFloor: target.tower.highestFloor,
    setBonuses: target.setBonuses,
    equippedItems: target.equipment.filter((e) => e.equipped),
    activeGenerals: target.generals
      .filter((g) => g.slot !== null)
      .map((g) => ({
        id: g.id,
        name: g.name,
        roleClass: g.roleClass,
        avatarKey: g.avatarKey,
        level: g.level,
        rebirth: g.rebirth,
        rarity: g.rarity,
        growth: g.growth,
        atk: g.atk,
        maxHp: g.maxHp,
        spd: g.spd,
      })),
  };
}

export function getFriends(characterId: number, onlineIds: Set<number>): FriendView[] {
  const rows = db
    .prepare(
      `SELECT f.friend_character_id, f.created_at, c.name, c.role_class, c.level, c.rebirth, c.map_id, c.gender, c.portrait
       FROM friends f
       JOIN characters c ON c.id = f.friend_character_id
       WHERE f.character_id = ?
       ORDER BY f.created_at DESC`,
    )
    .all(characterId) as unknown as Array<{
    friend_character_id: number;
    created_at: number;
    name: string;
    role_class: RoleClass;
    level: number;
    rebirth: number;
    map_id: string;
    gender: Gender;
    portrait: string;
  }>;

  return rows
    .map((r) => {
      const meta = ROLE_CLASS_META[r.role_class];
      const portrait =
        r.gender === 'female' && r.portrait === meta.portrait ? meta.femalePortrait : r.portrait;
      return {
        characterId: r.friend_character_id,
        name: r.name,
        roleClass: r.role_class,
        level: r.level,
        rebirth: r.rebirth ?? 0,
        mapId: r.map_id,
        mapName: (MAPS[r.map_id] ?? MAPS.xuchang).name,
        online: onlineIds.has(r.friend_character_id),
        portrait,
        createdAt: r.created_at,
      };
    })
    .sort((a, b) => Number(b.online) - Number(a.online) || b.level - a.level);
}

export function addFriend(
  characterId: number,
  target: { targetCharacterId?: number; targetName?: string },
  onlineIds: Set<number>,
): { friends: FriendView[]; character: CharacterView; message: string } {
  const me = getCharacterById(characterId);
  if (!me) throw new Error('角色不存在');

  let targetRow: { id: number; name: string } | undefined;
  if (target.targetCharacterId) {
    targetRow = db
      .prepare('SELECT id, name FROM characters WHERE id = ? AND realm_id = ?')
      .get(target.targetCharacterId, me.realmId) as { id: number; name: string } | undefined;
  } else if (target.targetName?.trim()) {
    targetRow = db
      .prepare('SELECT id, name FROM characters WHERE name = ? AND realm_id = ?')
      .get(target.targetName.trim(), me.realmId) as { id: number; name: string } | undefined;
  }
  if (!targetRow) throw new Error('未找到该名号的玩家');
  if (targetRow.id === characterId) throw new Error('不能添加自己为好友');

  const cnt = (
    db.prepare('SELECT COUNT(*) AS cnt FROM friends WHERE character_id = ?').get(characterId) as {
      cnt: number;
    }
  ).cnt;
  if (cnt >= 50) throw new Error('好友数量已达上限（50人）');

  const existed = db
    .prepare('SELECT id FROM friends WHERE character_id = ? AND friend_character_id = ?')
    .get(characterId, targetRow.id);
  if (existed) throw new Error(`【${targetRow.name}】已在你的好友列表中`);

  db.prepare(
    'INSERT INTO friends (realm_id, character_id, friend_character_id, created_at) VALUES (?, ?, ?, ?)',
  ).run(me.realmId, characterId, targetRow.id, Date.now());

  return {
    friends: getFriends(characterId, onlineIds),
    character: getCharacterById(characterId)!,
    message: `已将【${targetRow.name}】加为好友！`,
  };
}

export function removeFriend(
  characterId: number,
  friendCharacterId: number,
  onlineIds: Set<number>,
): { friends: FriendView[]; character: CharacterView; message: string } {
  db.prepare('DELETE FROM friends WHERE character_id = ? AND friend_character_id = ?').run(
    characterId,
    friendCharacterId,
  );
  return {
    friends: getFriends(characterId, onlineIds),
    character: getCharacterById(characterId)!,
    message: '已移除该好友。',
  };
}
