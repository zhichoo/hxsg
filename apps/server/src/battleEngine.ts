import crypto from 'node:crypto';
import {
  calcControlChance,
  calcDamage,
  ENEMY_GROUPS,
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
} from '@hxsg/shared';
import {
  addItem,
  addSkillProficiency,
  applyExpAndSilver,
  getCharacterById,
  grantGeneralToCharacter,
} from './gameService.js';

interface ActiveBattle extends BattleState {
  characterId: number;
  enemyGroupId: string;
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
  const group = ENEMY_GROUPS[enemyGroupId];
  if (!group) throw new Error('怪物群不存在');
  if (ch.hp <= 0) throw new Error('气血不足，请先回客栈休息或吃药');

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
      name: g.name,
      level: g.level,
      roleClass: g.roleClass,
      spriteKey: g.spriteKey,
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
      resist: { phys: 5, chaos: 10, seal: 10, trap: 10, magic: 5 },
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
        phys: Math.min(25, e.level * 1),
        chaos: Math.min(35, e.level * 2),
        seal: Math.min(35, e.level * 2),
        trap: Math.min(30, e.level * 2),
        magic: Math.min(25, e.level * 1),
      },
    });
  });

  const battle: ActiveBattle = {
    battleId: crypto.randomUUID(),
    characterId,
    enemyGroupId,
    mapId: map.id,
    mapName: map.name,
    battleBg: map.battleBg,
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
  const group = ENEMY_GROUPS[battle.enemyGroupId];

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
        const tplId = group.capturableTemplateId;
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
      // Enemy AI
      const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      const useControl = actor.roleClass === 'wenren' && actor.mp >= 20 && Math.random() < 0.35;
      const useSkill = actor.roleClass !== 'wushi' && actor.mp >= 20 && Math.random() < 0.35;

      if (useControl) {
        actor.mp -= 20;
        const kind: ControlKind = Math.random() < 0.5 ? 'chaos' : 'seal';
        const resPct = target.resist?.[kind] ?? 0;
        const hit = Math.random() < calcControlChance(0.55, 0, resPct);
        if (hit) applyStatus(target, kind, 2);
        logs.push({
          actorUid: actor.uid,
          actorName: actor.name,
          action: 'skill',
          skillName: kind === 'chaos' ? '妖言惑众' : '定身咒',
          effect: kind,
          targets: [
            {
              uid: target.uid,
              name: target.name,
              damage: 0,
              appliedStatus: hit ? kind : undefined,
              resisted: !hit,
            },
          ],
          message: hit
            ? `${actor.name} 施展诡计，使 ${target.name} 陷入【${STATUS_LABEL[kind]}】！`
            : `${actor.name} 企图控制 ${target.name}，被高抗性成功抵挡！`,
        });
      } else if (useSkill) {
        actor.mp -= 20;
        const { damage, crit } = calcDamage(actor.atk, target.defending, 1.25, {
          resistPct: target.resist?.magic,
          targetTrapped: hasStatus(target, 'trap'),
        });
        target.hp = Math.max(0, target.hp - damage);
        if (target.hp === 0) target.alive = false;
        logs.push({
          actorUid: actor.uid,
          actorName: actor.name,
          action: 'skill',
          skillName: actor.roleClass === 'yiren' ? '落雷术' : '火计',
          effect: actor.roleClass === 'yiren' ? 'lei' : 'fire',
          targets: [{ uid: target.uid, name: target.name, damage, crit, killed: !target.alive }],
          message: `${actor.name} 施放法术袭击 ${target.name}，造成 ${damage} 点伤害！`,
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
    const exp = group.expReward;
    const silver = group.silverReward;
    const dropRoll = Math.random();
    let droppedItem: { itemId: string; name: string; quantity: number } | undefined;
    if (dropRoll < 0.35) {
      const dropId = dropRoll < 0.2 ? 'jinchuang' : 'ningshen';
      addItem(characterId, dropId, 1);
      droppedItem = { itemId: dropId, name: ITEMS[dropId].name, quantity: 1 };
    }
    const res = applyExpAndSilver(characterId, exp, silver, mainUnit.hp, mainUnit.mp);
    updatedChar = res.character;
    battle.rewards = {
      exp,
      silver,
      leveledUp: res.leveledUp,
      newLevel: res.newLevel,
      droppedItem,
      capturedGeneral,
    };
    activeBattles.delete(characterId);
  } else if (playersLeft === 0) {
    battle.status = 'defeat';
    updatedChar = applyExpAndSilver(
      characterId,
      0,
      0,
      Math.max(10, Math.round(mainUnit.maxHp * 0.25)),
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
  const { characterId: _c, enemyGroupId: _e, ...rest } = b;
  return rest;
}
