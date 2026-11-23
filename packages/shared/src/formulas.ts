import { ROLE_CLASS_META } from './gameData.js';
import type { RoleClass } from './types.js';

export function expRequiredForLevel(level: number): number {
  return Math.floor(80 * Math.pow(level, 1.55) + 40 * level);
}

export function calcRoleStats(roleClass: RoleClass, level: number) {
  const m = ROLE_CLASS_META[roleClass];
  const lv = Math.max(1, level);
  const hpGain = roleClass === 'wushi' ? 28 : roleClass === 'yiren' ? 20 : 18;
  const mpGain = roleClass === 'wushi' ? 8 : 22;
  const atkGain = roleClass === 'wushi' ? 7 : roleClass === 'yiren' ? 6 : 5;
  const defGain = roleClass === 'wushi' ? 4 : 3;
  const spdGain = roleClass === 'wenren' ? 5 : roleClass === 'yiren' ? 4 : 3;

  return {
    maxHp: m.baseHp + (lv - 1) * hpGain,
    maxMp: m.baseMp + (lv - 1) * mpGain,
    atk: m.baseAtk + (lv - 1) * atkGain,
    def: m.baseDef + (lv - 1) * defGain,
    spd: m.baseSpd + (lv - 1) * spdGain,
  };
}

export function calcDamage(
  attackerAtk: number,
  targetDefending: boolean,
  powerMultiplier = 1,
): { damage: number; crit: boolean } {
  const variance = 0.9 + Math.random() * 0.22;
  const crit = Math.random() < 0.14;
  let dmg = attackerAtk * powerMultiplier * variance * (crit ? 1.55 : 1);
  if (targetDefending) {
    dmg *= 0.5;
  }
  return {
    damage: Math.max(1, Math.round(dmg)),
    crit,
  };
}
