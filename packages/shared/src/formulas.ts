import { ROLE_CLASS_META } from './gameData.js';
import type { RoleClass } from './types.js';

export const SKILL_TIER_THRESHOLDS = [0, 200, 700, 1800, 4000, 10000];

export function expRequiredForLevel(level: number): number {
  return Math.floor(80 * Math.pow(level, 1.55) + 40 * level);
}

export function getSkillTier(proficiency: number): { tier: number; nextTierProf: number } {
  const p = Math.max(0, Math.min(10000, proficiency));
  if (p >= 4000) return { tier: 5, nextTierProf: 10000 };
  if (p >= 1800) return { tier: 4, nextTierProf: 4000 };
  if (p >= 700) return { tier: 3, nextTierProf: 1800 };
  if (p >= 200) return { tier: 2, nextTierProf: 700 };
  return { tier: 1, nextTierProf: 200 };
}

export function getSkillMaxTargets(aoe: boolean, proficiency: number): number {
  if (!aoe) return 1;
  const { tier } = getSkillTier(proficiency);
  // Classic HXSG progression: 1阶打2个, 2阶打3个, 3阶打4个, 4阶以上打5个(全屏)
  return Math.min(5, tier + 1);
}

export function getSkillPowerMultiplier(basePower: number, proficiency: number, intPts = 0): number {
  const profBonus = 1 + Math.min(0.65, proficiency / 4500);
  const intBonus = 1 + intPts * 0.012;
  return basePower * profBonus * intBonus;
}

export function calcRoleStats(
  roleClass: RoleClass,
  level: number,
  alloc: { vit?: number; str?: number; int?: number; agi?: number } = {},
) {
  const m = ROLE_CLASS_META[roleClass];
  const lv = Math.max(1, level);
  const vit = Math.max(0, alloc.vit ?? 0);
  const str = Math.max(0, alloc.str ?? 0);
  const intel = Math.max(0, alloc.int ?? 0);
  const agi = Math.max(0, alloc.agi ?? 0);

  const hpGain = roleClass === 'wushi' ? 24 : roleClass === 'yiren' ? 19 : 18;
  const mpGain = roleClass === 'wushi' ? 8 : 20;
  const atkGain = roleClass === 'wushi' ? 6 : roleClass === 'yiren' ? 5 : 4;
  const defGain = roleClass === 'wushi' ? 3 : 2;
  const spdGain = roleClass === 'wenren' ? 4 : roleClass === 'yiren' ? 3 : 2;

  return {
    maxHp: m.baseHp + (lv - 1) * hpGain + vit * 18,
    maxMp: m.baseMp + (lv - 1) * mpGain + intel * 16,
    atk: m.baseAtk + (lv - 1) * atkGain + str * 3 + (roleClass !== 'wushi' ? Math.round(intel * 1.5) : 0),
    def: m.baseDef + (lv - 1) * defGain + vit * 1,
    spd: m.baseSpd + (lv - 1) * spdGain + agi * 3,
  };
}

export function calcDamage(
  attackerAtk: number,
  targetDefending: boolean,
  powerMultiplier = 1,
  opts: { resistPct?: number; targetTrapped?: boolean } = {},
): { damage: number; crit: boolean } {
  const variance = 0.9 + Math.random() * 0.22;
  const crit = Math.random() < 0.14;
  let dmg = attackerAtk * powerMultiplier * variance * (crit ? 1.55 : 1);
  if (targetDefending) {
    dmg *= 0.5;
  }
  if (opts.targetTrapped) {
    dmg *= 1.25;
  }
  const resist = Math.max(0, Math.min(75, opts.resistPct ?? 0));
  dmg *= 1 - resist / 100;
  return {
    damage: Math.max(1, Math.round(dmg)),
    crit,
  };
}

export function calcControlChance(
  baseRate: number,
  proficiency: number,
  targetResistPct: number,
): number {
  const profBonus = Math.min(0.25, proficiency / 8000);
  const raw = baseRate + profBonus - targetResistPct / 100;
  return Math.max(0.08, Math.min(0.95, raw));
}
