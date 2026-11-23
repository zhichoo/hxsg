import crypto from 'node:crypto';
import {
  buildTowerEnemyGroup,
  calcControlChance,
  calcDamage,
  ENEMY_GROUPS,
  GENERAL_SKILL_BOOKS,
  getSkillMaxTargets,
  getSkillPowerMultiplier,
  getSkillTier,
  ITEMS,
  MAPS,
  ROLE_CLASS_META,
  SKILLS,
  type BattleActionLog,
  type BattleState,
  type BattleUnit,
  type CharacterView,
  type ControlKind,
  type EnemyGroupDef,
} from '@hxsg/shared';
import {
  addActiveGeneralsIntimacy,
  addItem,
  addSkillProficiency,
  applyExpAndSilver,
  getCharacterById,
  grantEquipmentToCharacter,
  grantGeneralToCharacter,
  recordArenaOutcome,
  recordQuestBattleVictory,
  recordTowerClear,
} from './gameService.js';

function resolveEnemyGroup(enemyGroupId: string): EnemyGroupDef | undefined {
  if (enemyGroupId.startsWith('tower_')) {
    const floor = Number(enemyGroupId.slice(6));
    if (Number.isInteger(floor) && floor >= 1 && floor <= 20) {
      return buildTowerEnemyGroup(floor);
    }
    return undefined;
  }
  return ENEMY_GROUPS[enemyGroupId];
}

interface ActiveBattle extends BattleState {
  characterId: number;
  enemyGroupId: string;
  arenaTargetId?: number;
}

const activeBattles = new Map<number, ActiveBattle>();

const STATUS_LABEL: Record<ControlKind, string> = {
  chaos: '混乱',
  seal: '封印',
  trap: '围困',
};

function hasStatus(u: BattleUnit, kind: ControlKind): boolean {
  return u.statuses.some((s) => s.kind === kind && s.turns > 0);
}

function applyStatus(u: BattleUnit, kind: ControlKind, turns: number) {
  const existing = u.statuses.find((s) => s.kind === kind);
  if (existing) existing.turns = Math.max(existing.turns, turns);
  else u.statuses.push({ kind, turns });
}

function tickStatuses(units: BattleUnit[]) {
  for (const u of units) {
    u.statuses = u.statuses
      .map((s) => ({ ...s, turns: s.turns - 1 }))
      .filter((s) => s.turns > 0);
  }
}

export function getActiveBattle(characterId: number): BattleState | null {
  return activeBattles.get(characterId) ?? null;
}

export function startBattle(characterId: number, enemyGroupId: string): BattleState {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  const group = resolveEnemyGroup(enemyGroupId);
  if (!group) throw new Error('怪物群不存在');
  if (ch.hp <= 0) throw new Error('气血不足，请先回客栈休息或吃药');

  const isTower = enemyGroupId.startsWith('tower_');
  const map = MAPS[ch.mapId] ?? MAPS.xuchang_jiao;
  const meta = ROLE_CLASS_META[ch.roleClass];
  const playerSprite = ch.gender === 'female' ? meta.femaleSprite : meta.maleSprite;

  const units: BattleUnit[] = [
    {
      uid: `p_main_${ch.id}`,
      side: 'player',
      isMainRole: true,
      name: ch.name,
      level: ch.level,
      roleClass: ch.roleClass,
      spriteKey: playerSprite,
      hp: Math.max(1, ch.hp),
      maxHp: ch.maxHp,
      mp: ch.mp,
      maxMp: ch.maxMp,
      atk: ch.atk,
      spd: ch.spd,
      alive: true,
      defending: false,
      position: 0,
      statuses: [],
      resist: {
        phys: ch.resist.phys,
        chaos: ch.resist.chaos,
        seal: ch.resist.seal,
        trap: ch.resist.trap,
        magic: ch.resist.magic,
      },
    },
  ];

  const activeGenerals = ch.generals
    .filter((g) => g.slot !== null)
    .sort((a, b) => (a.slot ?? 9) - (b.slot ?? 9));
  activeGenerals.forEach((g, idx) => {
    units.push({
      uid: `p_gen_${g.id}`,
      side: 'player',
      isMainRole: false,
      name: g.rebirth > 0 ? `${g.name}[${g.rebirth}转]` : g.name,
      level: g.level,
      roleClass: g.roleClass,
      spriteKey: g.spriteKey,
      skillId: g.skillId,
      skill2Id: g.skill2Id ?? undefined,
      intimacy: g.intimacy,
      hp: Math.max(1, g.hp),
      maxHp: g.maxHp,
      mp: g.mp,
      maxMp: g.maxMp,
      atk: g.atk,
      spd: g.spd,
      alive: true,
      defending: false,
      position: idx + 1,
      statuses: [],
      resist: {
        phys: Math.min(75, 5 + g.rebirth * 6 + g.intimacyResistBonus),
        chaos: Math.min(75, 10 + g.rebirth * 8 + g.intimacyResistBonus),
        seal: Math.min(75, 10 + g.rebirth * 8 + g.intimacyResistBonus),
        trap: Math.min(75, 10 + g.rebirth * 8 + g.intimacyResistBonus),
        magic: Math.min(75, 5 + g.rebirth * 6 + g.intimacyResistBonus),
      },
    });
  });

  group.enemies.forEach((e, idx) => {
    units.push({
      uid: `e_${idx}`,
      side: 'enemy',
      isMainRole: false,
      name: e.name,
      level: e.level,
      roleClass: e.roleClass,
      spriteKey: e.spriteKey,
      hp: e.hp,
      maxHp: e.hp,
      mp: e.mp,
      maxMp: e.mp,
      atk: e.atk,
      spd: e.spd,
      alive: true,
      defending: false,
      position: idx,
      statuses: [],
      resist: {
        phys: Math.min(40, e.level * 1.5),
        chaos: Math.min(45, e.level * 2),
        seal: Math.min(45, e.level * 2),
        trap: Math.min(40, e.level * 2),
        magic: Math.min(40, e.level * 1.5),
      },
    });
  });

  const battle: ActiveBattle = {
    battleId: crypto.randomUUID(),
    characterId,
    enemyGroupId,
    mapId: map.id,
    mapName: isTower ? '天玄塔' : map.name,
    battleBg: isTower ? 'f_bg7' : map.battleBg,
    enemyGroupName: group.name,
    round: 1,
    status: 'ongoing',
    deadlineAt: Date.now() + 60_000,
    units,
    lastLogs: [],
  };

  activeBattles.set(characterId, battle);
  return stripInternal(battle);
}

export function startArenaBattle(characterId: number, targetCharacterId: number): BattleState {
  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');
  if (characterId === targetCharacterId) throw new Error('不能挑战自己');
  const target = getCharacterById(targetCharacterId);
  if (!target || target.realmId !== ch.realmId) throw new Error('同区未找到该切磋对手');
  if (ch.hp <= 0) throw new Error('气血不足，请先回客栈休息或吃药');

  const meta = ROLE_CLASS_META[ch.roleClass];
  const playerSprite = ch.gender === 'female' ? meta.femaleSprite : meta.maleSprite;
  const targetMeta = ROLE_CLASS_META[target.roleClass];
  const targetSprite = target.gender === 'female' ? targetMeta.femaleSprite : targetMeta.maleSprite;

  const units: BattleUnit[] = [
    {
      uid: `p_main_${ch.id}`,
      side: 'player',
      isMainRole: true,
      name: ch.name,
      level: ch.level,
      roleClass: ch.roleClass,
      spriteKey: playerSprite,
      hp: Math.max(1, ch.hp),
      maxHp: ch.maxHp,
      mp: ch.mp,
      maxMp: ch.maxMp,
      atk: ch.atk,
      spd: ch.spd,
      alive: true,
      defending: false,
      position: 0,
      statuses: [],
      resist: {
        phys: ch.resist.phys,
        chaos: ch.resist.chaos,
        seal: ch.resist.seal,
        trap: ch.resist.trap,
        magic: ch.resist.magic,
      },
    },
  ];

  ch.generals
    .filter((g) => g.slot !== null)
    .sort((a, b) => (a.slot ?? 9) - (b.slot ?? 9))
    .forEach((g, idx) => {
      units.push({
        uid: `p_gen_${g.id}`,
        side: 'player',
        isMainRole: false,
        name: g.rebirth > 0 ? `${g.name}[${g.rebirth}转]` : g.name,
        level: g.level,
        roleClass: g.roleClass,
        spriteKey: g.spriteKey,
        skillId: g.skillId,
        skill2Id: g.skill2Id ?? undefined,
        intimacy: g.intimacy,
        hp: Math.max(1, g.hp),
        maxHp: g.maxHp,
        mp: g.mp,
        maxMp: g.maxMp,
        atk: g.atk,
        spd: g.spd,
        alive: true,
        defending: false,
        position: idx + 1,
        statuses: [],
        resist: {
          phys: Math.min(75, 5 + g.rebirth * 6 + g.intimacyResistBonus),
          chaos: Math.min(75, 10 + g.rebirth * 8 + g.intimacyResistBonus),
          seal: Math.min(75, 10 + g.rebirth * 8 + g.intimacyResistBonus),
          trap: Math.min(75, 10 + g.rebirth * 8 + g.intimacyResistBonus),
          magic: Math.min(75, 5 + g.rebirth * 6 + g.intimacyResistBonus),
        },
      });
    });

  // Mirror enemy main character
  units.push({
    uid: `e_main_${target.id}`,
    side: 'enemy',
    isMainRole: false,
    name: `【镜像】${target.name}`,
    level: target.level,
    roleClass: target.roleClass,
    spriteKey: targetSprite,
    hp: target.maxHp,
    maxHp: target.maxHp,
    mp: target.maxMp,
    maxMp: target.maxMp,
    atk: target.atk,
    spd: target.spd,
    alive: true,
    defending: false,
    position: 0,
    statuses: [],
    resist: {
      phys: target.resist.phys,
      chaos: target.resist.chaos,
      seal: target.resist.seal,
      trap: target.resist.trap,
      magic: target.resist.magic,
    },
  });

  // Mirror enemy active generals
  target.generals
    .filter((g) => g.slot !== null)
    .sort((a, b) => (a.slot ?? 9) - (b.slot ?? 9))
    .forEach((g, idx) => {
      units.push({
        uid: `e_gen_${g.id}`,
        side: 'enemy',
        isMainRole: false,
        name: g.rebirth > 0 ? `${g.name}[${g.rebirth}转]` : g.name,
        level: g.level,
        roleClass: g.roleClass,
        spriteKey: g.spriteKey,
        skillId: g.skillId,
        skill2Id: g.skill2Id ?? undefined,
        hp: g.maxHp,
        maxHp: g.maxHp,
        mp: g.maxMp,
        maxMp: g.maxMp,
        atk: g.atk,
        spd: g.spd,
        alive: true,
        defending: false,
        position: idx + 1,
        statuses: [],
        resist: {
          phys: Math.min(75, 5 + g.rebirth * 6 + g.intimacyResistBonus),
          chaos: Math.min(75, 10 + g.rebirth * 8 + g.intimacyResistBonus),
          seal: Math.min(75, 10 + g.rebirth * 8 + g.intimacyResistBonus),
          trap: Math.min(75, 10 + g.rebirth * 8 + g.intimacyResistBonus),
          magic: Math.min(75, 5 + g.rebirth * 6 + g.intimacyResistBonus),
        },
      });
    });

  const battle: ActiveBattle = {
    battleId: crypto.randomUUID(),
    characterId,
    enemyGroupId: 'arena',
    arenaTargetId: target.id,
    mapId: ch.mapId,
    mapName: '许昌演武擂台',
    battleBg: 'f_bg6',
    enemyGroupName: `${target.name}（镜像）`,
    round: 1,
    status: 'ongoing',
    deadlineAt: Date.now() + 60_000,
    units,
    lastLogs: [],
  };

  activeBattles.set(characterId, battle);
  return stripInternal(battle);
}

export interface PlayerBattleCommand {
  action: 'attack' | 'skill' | 'defend' | 'item' | 'capture' | 'flee';
  targetUid?: string;
  skillId?: string;
  itemId?: string;
}

export function performBattleAction(
  characterId: number,
  cmd: PlayerBattleCommand,
): { battle: BattleState; character: CharacterView } {
  const battle = activeBattles.get(characterId);
  if (!battle || battle.status !== 'ongoing') {
    throw new Error('当前没有进行中的战斗');
  }

  const ch = getCharacterById(characterId);
  if (!ch) throw new Error('角色不存在');

  const logs: BattleActionLog[] = [];
  for (const u of battle.units) u.defending = false;

  const mainUnit = battle.units.find((u) => u.isMainRole)!;
  const group = battle.arenaTargetId ? undefined : resolveEnemyGroup(battle.enemyGroupId);

  const aliveActors = battle.units.filter((u) => u.alive).sort((a, b) => b.spd - a.spd);

  let fled = false;
  let capturedGeneral: { name: string; growth: number } | undefined;

  for (const actor of aliveActors) {
    if (!actor.alive) continue;
    const aliveEnemies = battle.units.filter((u) => u.side === 'enemy' && u.alive);
    const alivePlayers = battle.units.filter((u) => u.side === 'player' && u.alive);
    if (aliveEnemies.length === 0 || alivePlayers.length === 0) break;

    // 1. Check Seal (封): skips entire turn
    if (hasStatus(actor, 'seal')) {
      logs.push({
        actorUid: actor.uid,
        actorName: actor.name,
        action: 'status',
        effect: 'seal',
        targets: [],
        message: `${actor.name} 处于【封印】状态，本回合无法行动！`,
      });
      continue;
    }

    // 2. Check Chaos (乱): attacks any random living unit (friend or foe!)
    if (hasStatus(actor, 'chaos')) {
      const others = battle.units.filter((u) => u.alive && u.uid !== actor.uid);
      const target = others[Math.floor(Math.random() * others.length)];
      if (target) {
        const { damage, crit } = calcDamage(actor.atk, target.defending, 0.95, {
          resistPct: target.resist?.phys,
          targetTrapped: hasStatus(target, 'trap'),
        });
        target.hp = Math.max(0, target.hp - damage);
        if (target.hp === 0) target.alive = false;
        logs.push({
          actorUid: actor.uid,
          actorName: actor.name,
          action: 'status',
          effect: 'chaos',
          targets: [{ uid: target.uid, name: target.name, damage, crit, killed: !target.alive }],
          message: `${actor.name} 陷入【混乱】，胡乱攻击了 ${target.name}，造成 ${damage} 点伤害！`,
        });
      }
      continue;
    }

    if (actor.uid === mainUnit.uid) {
      if (cmd.action === 'flee') {
        if (Math.random() < 0.8) {
          fled = true;
          logs.push({
            actorUid: actor.uid,
            actorName: actor.name,
            action: 'flee',
            targets: [],
            message: `${actor.name} 脚底抹油，成功脱离战场！`,
          });
          break;
        }
        logs.push({
          actorUid: actor.uid,
          actorName: actor.name,
          action: 'flee',
          targets: [],
          message: `${actor.name} 试图逃跑，却被敌军拦住了去路！`,
        });
        continue;
      }

      if (cmd.action === 'defend') {
        actor.defending = true;
        logs.push({
          actorUid: actor.uid,
          actorName: actor.name,
          action: 'defend',
          targets: [],
          message: `${actor.name} 凝神防御，本回合所受伤害减半。`,
        });
        continue;
      }

      if (cmd.action === 'item' && cmd.itemId) {
        const tpl = ITEMS[cmd.itemId];
        const owned = ch.inventory.find((i) => i.itemId === cmd.itemId);
        if (tpl && owned && owned.quantity > 0) {
          addItem(characterId, cmd.itemId, -1);
          const hpAdd = tpl.hpRestore ?? 0;
          const mpAdd = tpl.mpRestore ?? 0;
          actor.hp = Math.min(actor.maxHp, actor.hp + hpAdd);
          actor.mp = Math.min(actor.maxMp, actor.mp + mpAdd);
          logs.push({
            actorUid: actor.uid,
            actorName: actor.name,
            action: 'item',
            effect: 'heal',
            targets: [{ uid: actor.uid, name: actor.name, damage: 0, heal: hpAdd }],
            message: `${actor.name} 服用【${tpl.name}】，恢复气血 ${hpAdd} / 精力 ${mpAdd}！`,
          });
          continue;
        }
      }

      if (cmd.action === 'capture') {
        const target = aliveEnemies.find((e) => e.uid === cmd.targetUid) ?? aliveEnemies[0];
        if (battle.arenaTargetId) {
          logs.push({
            actorUid: actor.uid,
            actorName: actor.name,
            action: 'capture',
            targets: [{ uid: target.uid, name: target.name, damage: 0 }],
            message: '擂台切磋点到为止，不可招降他人副将！',
          });
          continue;
        }
        const tplId = group?.capturableTemplateId;
        const hpRatio = target.hp / target.maxHp;
        const chance = tplId ? Math.min(0.78, 0.25 + (1 - hpRatio) * 0.55) : 0;
        if (tplId && Math.random() < chance && ch.generals.length < 12) {
          target.hp = 0;
          target.alive = false;
          const g = grantGeneralToCharacter(characterId, tplId, target.level);
          capturedGeneral = { name: g.name, growth: g.growth };
          logs.push({
            actorUid: actor.uid,
            actorName: actor.name,
            action: 'capture',
            targets: [{ uid: target.uid, name: target.name, damage: 0, captured: true, killed: true }],
            message: `${actor.name} 招降成功！【${g.name}】已收入副将营中！`,
          });
        } else {
          logs.push({
            actorUid: actor.uid,
            actorName: actor.name,
            action: 'capture',
            targets: [{ uid: target.uid, name: target.name, damage: 0 }],
            message: `${actor.name} 试图招降 ${target.name}，但对方宁死不屈！`,
          });
        }
        continue;
      }

      if (cmd.action === 'skill' && cmd.skillId) {
        const skill = SKILLS.find((s) => s.id === cmd.skillId);
        if (skill && actor.mp >= skill.mpCost) {
          actor.mp -= skill.mpCost;
          const skillProg = ch.skills.find((s) => s.skillId === skill.id);
          const curProf = skillProg?.proficiency ?? 0;
          const profGain = 20 + Math.floor(Math.random() * 12);
          addSkillProficiency(characterId, skill.id, profGain);
          const { tier } = getSkillTier(curProf);

          if (skill.kind === 'heal') {
            const healMult = getSkillPowerMultiplier(0.4, curProf, ch.alloc.int);
            const healVal = Math.round(actor.maxHp * Math.min(0.85, healMult));
            actor.hp = Math.min(actor.maxHp, actor.hp + healVal);
            logs.push({
              actorUid: actor.uid,
              actorName: actor.name,
              action: 'skill',
              skillId: skill.id,
              skillName: skill.name,
              effect: 'heal',
              proficiencyGain: profGain,
              targets: [{ uid: actor.uid, name: actor.name, damage: 0, heal: healVal }],
              message: `${actor.name} 施展【${skill.name}】，恢复气血 ${healVal}（熟练度 +${profGain}）！`,
            });
            continue;
          }

          const maxTargets = getSkillMaxTargets(skill.aoe, curProf);
          const primary = aliveEnemies.find((e) => e.uid === cmd.targetUid) ?? aliveEnemies[0];
          const targets = skill.aoe
            ? [primary, ...aliveEnemies.filter((e) => e.uid !== primary.uid)].slice(0, maxTargets)
            : [primary];

          if (skill.kind === 'control' && skill.controlKind) {
            const kind = skill.controlKind;
            const turns = skill.controlTurns ?? 2;
            const targetResults = targets.map((t) => {
              const resPct = t.resist?.[kind] ?? 0;
              const chance = calcControlChance(skill.baseControlRate ?? 0.68, curProf, resPct);
              const hit = Math.random() < chance;
              if (hit) applyStatus(t, kind, turns);
              return {
                uid: t.uid,
                name: t.name,
                damage: 0,
                appliedStatus: hit ? kind : undefined,
                resisted: !hit,
              };
            });
            const hitCount = targetResults.filter((r) => r.appliedStatus).length;
            logs.push({
              actorUid: actor.uid,
              actorName: actor.name,
              action: 'skill',
              skillId: skill.id,
              skillName: skill.name,
              effect: skill.effect,
              proficiencyGain: profGain,
              targets: targetResults,
              message: `${actor.name} 施展【${skill.name}】(${tier}阶)，命中 ${hitCount}/${targets.length} 名敌军【${STATUS_LABEL[kind]}】（熟练度 +${profGain}）！`,
            });
            continue;
          }

          if (skill.kind === 'multi_hit') {
            const hits = (skill.hitCount ?? 2) + (tier >= 3 ? 1 : 0);
            const power = getSkillPowerMultiplier(skill.power, curProf, 0);
            let totalDmg = 0;
            let anyCrit = false;
            for (let h = 0; h < hits && primary.alive; h++) {
              const { damage, crit } = calcDamage(actor.atk, primary.defending, power, {
                resistPct: primary.resist?.phys,
                targetTrapped: hasStatus(primary, 'trap'),
              });
              primary.hp = Math.max(0, primary.hp - damage);
              if (primary.hp === 0) primary.alive = false;
              totalDmg += damage;
              anyCrit = anyCrit || crit;
            }
            logs.push({
              actorUid: actor.uid,
              actorName: actor.name,
              action: 'skill',
              skillId: skill.id,
              skillName: skill.name,
              effect: skill.effect,
              proficiencyGain: profGain,
              targets: [
                {
                  uid: primary.uid,
                  name: primary.name,
                  damage: totalDmg,
                  crit: anyCrit,
                  killed: !primary.alive,
                },
              ],
              message: `${actor.name} 施展【${skill.name}】连击 ${hits} 次，对 ${primary.name} 造成 ${totalDmg} 点伤害（熟练度 +${profGain}）！`,
            });
            continue;
          }

          // Standard / AOE damage skill
          const power = getSkillPowerMultiplier(
            skill.power,
            curProf,
            skill.damageType === 'magic' ? ch.alloc.int : 0,
          );
          const targetResults = targets.map((t) => {
            const resistPct =
              skill.damageType === 'magic' ? t.resist?.magic : t.resist?.phys;
            const { damage, crit } = calcDamage(actor.atk, t.defending, power, {
              resistPct,
              targetTrapped: hasStatus(t, 'trap'),
            });
            t.hp = Math.max(0, t.hp - damage);
            if (t.hp === 0) t.alive = false;
            return { uid: t.uid, name: t.name, damage, crit, killed: !t.alive };
          });
          logs.push({
            actorUid: actor.uid,
            actorName: actor.name,
            action: 'skill',
            skillId: skill.id,
            skillName: skill.name,
            effect: skill.effect,
            proficiencyGain: profGain,
            targets: targetResults,
            message: `${actor.name} 施展【${skill.name}】(${tier}阶)，命中 ${targets.length} 人共造成 ${targetResults.reduce((s, r) => s + r.damage, 0)} 点伤害（熟练度 +${profGain}）！`,
          });
          continue;
        }
      }

      // Check Trap (围): cannot perform normal physical attack
      if (hasStatus(actor, 'trap')) {
        logs.push({
          actorUid: actor.uid,
          actorName: actor.name,
          action: 'status',
          effect: 'trap',
          targets: [],
          message: `${actor.name} 处于【围困】状态，无法普攻！`,
        });
        continue;
      }

      const target = aliveEnemies.find((e) => e.uid === cmd.targetUid) ?? aliveEnemies[0];
      const { damage, crit } = calcDamage(actor.atk, target.defending, 1, {
        resistPct: target.resist?.phys,
        targetTrapped: hasStatus(target, 'trap'),
      });
      target.hp = Math.max(0, target.hp - damage);
      if (target.hp === 0) target.alive = false;
      logs.push({
        actorUid: actor.uid,
        actorName: actor.name,
        action: 'attack',
        effect: 'slash',
        targets: [{ uid: target.uid, name: target.name, damage, crit, killed: !target.alive }],
        message: `${actor.name} 攻击 ${target.name}${crit ? '（暴击！）' : ''}，造成 ${damage} 点伤害！`,
      });
    } else if (actor.side === 'player') {
      // Allied general: supports both innate skill (slot 1) & learned skill book (slot 2)
      const knownSkills = [actor.skillId, actor.skill2Id]
        .filter((id): id is string => Boolean(id))
        .map((id) => SKILLS.find((s) => s.id === id))
        .filter((s): s is NonNullable<typeof s> => Boolean(s));

      // Smart heal if general learned 妙手回春 and any ally is wounded (< 55% HP)
      const healSkill = knownSkills.find((s) => s.kind === 'heal' && actor.mp >= s.mpCost);
      const injuredAlly = [...alivePlayers]
        .filter((p) => p.hp / p.maxHp < 0.55)
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];

      if (healSkill && injuredAlly && Math.random() < 0.72) {
        actor.mp -= healSkill.mpCost;
        const healVal = Math.max(30, Math.round(injuredAlly.maxHp * 0.34));
        injuredAlly.hp = Math.min(injuredAlly.maxHp, injuredAlly.hp + healVal);
        logs.push({
          actorUid: actor.uid,
          actorName: actor.name,
          action: 'skill',
          skillId: healSkill.id,
          skillName: healSkill.name,
          effect: 'heal',
          targets: [{ uid: injuredAlly.uid, name: injuredAlly.name, damage: 0, heal: healVal }],
          message: `副将 ${actor.name} 施展【${healSkill.name}】，为 ${injuredAlly.name} 恢复气血 ${healVal} 点！`,
        });
        continue;
      }

      const castableSkills = knownSkills.filter((s) => s.kind !== 'heal' && actor.mp >= s.mpCost);
      const castChance = 0.48 + (actor.intimacy ?? 0) * 0.0018;
      const sigSkill =
        castableSkills.length > 0 && Math.random() < castChance
          ? castableSkills[Math.floor(Math.random() * castableSkills.length)]
          : undefined;
      if (sigSkill) {
        actor.mp -= sigSkill.mpCost;
        if (sigSkill.kind === 'control' && sigSkill.controlKind) {
          const kind = sigSkill.controlKind;
          const targets = aliveEnemies.slice(0, 2);
          const targetResults = targets.map((t) => {
            const hit = Math.random() < calcControlChance(sigSkill.baseControlRate ?? 0.65, 200, t.resist?.[kind] ?? 0);
            if (hit) applyStatus(t, kind, sigSkill.controlTurns ?? 2);
            return { uid: t.uid, name: t.name, damage: 0, appliedStatus: hit ? kind : undefined, resisted: !hit };
          });
          logs.push({
            actorUid: actor.uid,
            actorName: actor.name,
            action: 'skill',
            skillId: sigSkill.id,
            skillName: sigSkill.name,
            effect: sigSkill.effect,
            targets: targetResults,
            message: `副将 ${actor.name} 施展【${sigSkill.name}】控场！`,
          });
          continue;
        }
        const targets = sigSkill.aoe
          ? aliveEnemies.slice(0, 3)
          : [aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)]];
        const hits = sigSkill.kind === 'multi_hit' ? sigSkill.hitCount ?? 2 : 1;
        const targetResults = targets.map((t) => {
          let totalDmg = 0;
          let anyCrit = false;
          for (let h = 0; h < hits && t.alive; h++) {
            const { damage, crit } = calcDamage(actor.atk, t.defending, sigSkill.power, {
              resistPct: sigSkill.damageType === 'magic' ? t.resist?.magic : t.resist?.phys,
              targetTrapped: hasStatus(t, 'trap'),
            });
            t.hp = Math.max(0, t.hp - damage);
            if (t.hp === 0) t.alive = false;
            totalDmg += damage;
            anyCrit = anyCrit || crit;
          }
          return { uid: t.uid, name: t.name, damage: totalDmg, crit: anyCrit, killed: !t.alive };
        });
        logs.push({
          actorUid: actor.uid,
          actorName: actor.name,
          action: 'skill',
          skillId: sigSkill.id,
          skillName: sigSkill.name,
          effect: sigSkill.effect,
          targets: targetResults,
          message: `副将 ${actor.name} 施展【${sigSkill.name}】，造成 ${targetResults.reduce((s, r) => s + r.damage, 0)} 点伤害！`,
        });
        continue;
      }

      if (hasStatus(actor, 'trap')) {
        logs.push({
          actorUid: actor.uid,
          actorName: actor.name,
          action: 'status',
          effect: 'trap',
          targets: [],
          message: `副将 ${actor.name} 被【围困】，本回合无法普攻！`,
        });
        continue;
      }
      const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      const { damage, crit } = calcDamage(actor.atk, target.defending, 1.05, {
        resistPct: target.resist?.phys,
        targetTrapped: hasStatus(target, 'trap'),
      });
      target.hp = Math.max(0, target.hp - damage);
      if (target.hp === 0) target.alive = false;
      logs.push({
        actorUid: actor.uid,
        actorName: actor.name,
        action: 'attack',
        effect: 'slash',
        targets: [{ uid: target.uid, name: target.name, damage, crit, killed: !target.alive }],
        message: `副将 ${actor.name} 出击 ${target.name}，造成 ${damage} 点伤害！`,
      });
    } else {
      // Enemy AI (smarter high-level & boss AOE / control / heavy cleave)
      const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      const isStrong = actor.level >= 10 || battle.enemyGroupId.startsWith('boss_') || battle.enemyGroupId.startsWith('tower_');
      const useControl = actor.roleClass === 'wenren' && actor.mp >= 20 && Math.random() < (isStrong ? 0.42 : 0.32);
      const useMagic = actor.roleClass !== 'wushi' && actor.mp >= 20 && Math.random() < (isStrong ? 0.48 : 0.35);
      const useWushiSkill = actor.roleClass === 'wushi' && isStrong && actor.mp >= 20 && Math.random() < 0.38;

      if (useControl) {
        actor.mp -= 20;
        const kind: ControlKind = Math.random() < 0.5 ? 'chaos' : 'seal';
        const ctrlTargets = isStrong && alivePlayers.length >= 2 ? alivePlayers.slice(0, 2) : [target];
        const targetResults = ctrlTargets.map((t) => {
          const resPct = t.resist?.[kind] ?? 0;
          const hit = Math.random() < calcControlChance(isStrong ? 0.62 : 0.52, 0, resPct);
          if (hit) applyStatus(t, kind, 2);
          return {
            uid: t.uid,
            name: t.name,
            damage: 0,
            appliedStatus: hit ? kind : undefined,
            resisted: !hit,
          };
        });
        const hitNames = targetResults.filter((r) => r.appliedStatus).map((r) => r.name);
        logs.push({
          actorUid: actor.uid,
          actorName: actor.name,
          action: 'skill',
          skillName: kind === 'chaos' ? '妖言惑众' : '定身咒',
          effect: kind,
          targets: targetResults,
          message:
            hitNames.length > 0
              ? `${actor.name} 施展诡计，使 ${hitNames.join('、')} 陷入【${STATUS_LABEL[kind]}】！`
              : `${actor.name} 企图控场，被我军高抗性成功抵挡！`,
        });
      } else if (useMagic) {
        actor.mp -= 20;
        const aoeTargets = isStrong && alivePlayers.length >= 2 ? alivePlayers.slice(0, 3) : [target];
        const mult = aoeTargets.length > 1 ? 0.92 : 1.28;
        const targetResults = aoeTargets.map((t) => {
          const { damage, crit } = calcDamage(actor.atk, t.defending, mult, {
            resistPct: t.resist?.magic,
            targetTrapped: hasStatus(t, 'trap'),
          });
          t.hp = Math.max(0, t.hp - damage);
          if (t.hp === 0) t.alive = false;
          return { uid: t.uid, name: t.name, damage, crit, killed: !t.alive };
        });
        logs.push({
          actorUid: actor.uid,
          actorName: actor.name,
          action: 'skill',
          skillName: actor.roleClass === 'yiren' ? (aoeTargets.length > 1 ? '天雷破阵' : '落雷术') : '烈火焚营',
          effect: actor.roleClass === 'yiren' ? 'lei' : 'fire',
          targets: targetResults,
          message: `${actor.name} 施放法术袭击 ${aoeTargets.length > 1 ? `我军 ${aoeTargets.length} 人` : target.name}，共造成 ${targetResults.reduce((s, r) => s + r.damage, 0)} 点伤害！`,
        });
      } else if (useWushiSkill) {
        actor.mp -= 20;
        const cleaveTargets = alivePlayers.length >= 2 && Math.random() < 0.5 ? alivePlayers.slice(0, 2) : [target];
        const mult = cleaveTargets.length > 1 ? 0.96 : 1.38;
        const targetResults = cleaveTargets.map((t) => {
          const { damage, crit } = calcDamage(actor.atk, t.defending, mult, {
            resistPct: t.resist?.phys,
            targetTrapped: hasStatus(t, 'trap'),
          });
          t.hp = Math.max(0, t.hp - damage);
          if (t.hp === 0) t.alive = false;
          return { uid: t.uid, name: t.name, damage, crit, killed: !t.alive };
        });
        logs.push({
          actorUid: actor.uid,
          actorName: actor.name,
          action: 'skill',
          skillName: cleaveTargets.length > 1 ? '横扫千军' : '破军重斩',
          effect: cleaveTargets.length > 1 ? 'fg' : 'slash',
          targets: targetResults,
          message: `${actor.name} 发动猛技【${cleaveTargets.length > 1 ? '横扫千军' : '破军重斩'}】，共造成 ${targetResults.reduce((s, r) => s + r.damage, 0)} 点伤害！`,
        });
      } else {
        if (hasStatus(actor, 'trap')) {
          logs.push({
            actorUid: actor.uid,
            actorName: actor.name,
            action: 'status',
            effect: 'trap',
            targets: [],
            message: `${actor.name} 被【围困】，动弹不得！`,
          });
          continue;
        }
        const { damage, crit } = calcDamage(actor.atk, target.defending, 0.92, {
          resistPct: target.resist?.phys,
          targetTrapped: hasStatus(target, 'trap'),
        });
        target.hp = Math.max(0, target.hp - damage);
        if (target.hp === 0) target.alive = false;
        logs.push({
          actorUid: actor.uid,
          actorName: actor.name,
          action: 'attack',
          effect: 'slash',
          targets: [{ uid: target.uid, name: target.name, damage, crit, killed: !target.alive }],
          message: `${actor.name} 攻击 ${target.name}，造成 ${damage} 点伤害！`,
        });
      }
    }
  }

  // Decrement status durations at end of round
  tickStatuses(battle.units);
  battle.lastLogs = logs;

  const enemiesLeft = battle.units.filter((u) => u.side === 'enemy' && u.alive).length;
  const playersLeft = battle.units.filter((u) => u.side === 'player' && u.alive).length;

  let updatedChar = getCharacterById(characterId)!;

  if (fled) {
    battle.status = 'fled';
    updatedChar = applyExpAndSilver(characterId, 0, 0, mainUnit.hp, mainUnit.mp).character;
    activeBattles.delete(characterId);
  } else if (enemiesLeft === 0) {
    battle.status = 'victory';
    if (battle.arenaTargetId) {
      const arenaRes = recordArenaOutcome(characterId, battle.arenaTargetId, true);
      const res = applyExpAndSilver(
        characterId,
        arenaRes.exp,
        arenaRes.silver,
        Math.max(mainUnit.hp, Math.round(mainUnit.maxHp * 0.6)),
        mainUnit.mp,
      );
      updatedChar = res.character;
      battle.rewards = {
        exp: arenaRes.exp,
        silver: arenaRes.silver,
        leveledUp: res.leveledUp,
        newLevel: res.newLevel,
        questUpdates: [arenaRes.summary],
      };
      activeBattles.delete(characterId);
    } else {
      const exp = group?.expReward ?? 60;
      const silver = group?.silverReward ?? 60;
      const dropRoll = Math.random();
      let droppedItem: { itemId: string; name: string; quantity: number } | undefined;
      if (battle.enemyGroupId.startsWith('boss_') && dropRoll < 0.35) {
        const bookIds = Object.keys(GENERAL_SKILL_BOOKS);
        const bookId = bookIds[Math.floor(Math.random() * bookIds.length)];
        addItem(characterId, bookId, 1);
        droppedItem = { itemId: bookId, name: ITEMS[bookId].name, quantity: 1 };
      } else if (dropRoll < 0.42) {
        const dropId =
          dropRoll < 0.14 ? 'baotu' : dropRoll < 0.28 ? 'jinchuang' : 'ningshen';
        addItem(characterId, dropId, 1);
        droppedItem = { itemId: dropId, name: ITEMS[dropId].name, quantity: 1 };
      }

      // Classic equipment / mount drop roll
      let droppedEquipment:
        | { name: string; quality: 'common' | 'fine' | 'rare' | 'legend'; slot: 'weapon' | 'helmet' | 'armor' | 'boots' | 'mount' }
        | undefined;
      if (Math.random() < 0.28 && ch.equipment.length < 30) {
        let pool: string[];
        if (
          battle.enemyGroupId === 'yiling_wujun' ||
          battle.enemyGroupId === 'boss_luxun' ||
          battle.enemyGroupId === 'wuzhang_sima' ||
          battle.enemyGroupId === 'boss_simayi'
        ) {
          pool =
            battle.enemyGroupId === 'boss_simayi'
              ? ['fangtian_ji', 'taiji_fajian', 'tianlong_guan', 'qilin_baojia', 'tengyun_xue', 'bailong_ju', 'hanxue_ma']
              : ['zhangba_mao', 'zhuge_yushan', 'wuhou_jin', 'xuanwu_jia', 'lingbo_lv', 'zhuahuang_ma', 'fangtian_ji', 'taiji_fajian', 'qilin_baojia', 'bailong_ju'];
        } else if (
          battle.enemyGroupId === 'yizhou_chuanjun' ||
          battle.enemyGroupId === 'boss_zhangren' ||
          battle.enemyGroupId === 'hanzhong_weijun' ||
          battle.enemyGroupId === 'boss_xiahouyuan'
        ) {
          pool = ['zhangba_mao', 'zhuge_yushan', 'wuhou_jin', 'xuanwu_jia', 'lingbo_lv', 'zhuahuang_ma', 'qinglong_dao', 'jueying_ma'];
        } else if (
          battle.enemyGroupId === 'jiangling_caojun' ||
          battle.enemyGroupId === 'boss_caoren'
        ) {
          pool = ['qinglong_dao', 'fengchi_kui', 'mingguang_kai', 'yunlong_xue', 'jueying_ma', 'chitu_ma'];
        } else if (
          battle.enemyGroupId === 'luoyang_weidui' ||
          battle.enemyGroupId === 'hulao_xiliang' ||
          battle.enemyGroupId === 'boss_huaxiong' ||
          battle.enemyGroupId === 'guandu_yuanjun' ||
          battle.enemyGroupId === 'boss_yanliang' ||
          battle.enemyGroupId === 'chibi_shuijun' ||
          battle.enemyGroupId === 'boss_caojun'
        ) {
          pool = ['qixing_jian', 'zijin_guan', 'bagua_pao', 'jifeng_xue', 'dilu_ma', 'chitu_ma', 'longdan_qiang'];
        } else if (
          battle.enemyGroupId === 'changshe_daoshi' ||
          battle.enemyGroupId === 'boss_zhangjiao'
        ) {
          pool = ['bailian_dao', 'tiekui', 'suozi_jia', 'tayun_lv', 'wuzhui_ma'];
        } else {
          pool = ['qingtong_qiang', 'taomu_jian', 'bujin_mao', 'cubu_yi', 'caoxie', 'huangbiao_ma'];
        }
        const picked = pool[Math.floor(Math.random() * pool.length)];
        const eq = grantEquipmentToCharacter(characterId, picked, true);
        droppedEquipment = { name: eq.name, quality: eq.quality, slot: eq.slot };
      }

      addActiveGeneralsIntimacy(characterId, 2);
      const questUpdates = recordQuestBattleVictory(characterId, battle.enemyGroupId);
      if (battle.enemyGroupId.startsWith('tower_')) {
        const floor = Number(battle.enemyGroupId.slice(6));
        const towerMsg = recordTowerClear(characterId, floor);
        if (towerMsg) questUpdates.push(towerMsg);
      }
      const res = applyExpAndSilver(characterId, exp, silver, mainUnit.hp, mainUnit.mp);
      updatedChar = res.character;
      battle.rewards = {
        exp,
        silver,
        leveledUp: res.leveledUp,
        newLevel: res.newLevel,
        droppedItem,
        droppedEquipment,
        capturedGeneral,
        questUpdates: questUpdates.length > 0 ? questUpdates : undefined,
      };
      activeBattles.delete(characterId);
    }
  } else if (playersLeft === 0) {
    battle.status = 'defeat';
    if (battle.arenaTargetId) {
      recordArenaOutcome(characterId, battle.arenaTargetId, false);
    }
    updatedChar = applyExpAndSilver(
      characterId,
      0,
      0,
      Math.max(10, Math.round(mainUnit.maxHp * (battle.arenaTargetId ? 0.5 : 0.25))),
      mainUnit.mp,
    ).character;
    activeBattles.delete(characterId);
  } else {
    battle.round++;
    battle.deadlineAt = Date.now() + 60_000;
    updatedChar = applyExpAndSilver(characterId, 0, 0, mainUnit.hp, mainUnit.mp).character;
  }

  return {
    battle: stripInternal(battle),
    character: updatedChar,
  };
}

function stripInternal(b: ActiveBattle): BattleState {
  const { characterId: _c, enemyGroupId: _e, arenaTargetId: _a, ...rest } = b;
  return rest;
}
