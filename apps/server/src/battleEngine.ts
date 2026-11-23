import crypto from 'node:crypto';
import {
  calcDamage,
  ENEMY_GROUPS,
  GENERAL_TEMPLATES,
  ITEMS,
  MAPS,
  ROLE_CLASS_META,
  SKILLS,
  type BattleActionLog,
  type BattleState,
  type BattleUnit,
  type CharacterView,
} from '@hxsg/shared';
import {
  addItem,
  applyExpAndSilver,
  getCharacterById,
  grantGeneralToCharacter,
} from './gameService.js';

interface ActiveBattle extends BattleState {
  characterId: number;
  enemyGroupId: string;
}

const activeBattles = new Map<number, ActiveBattle>();

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
    },
  ];

  // Add active slot generals (up to 3)
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

  // Build turn order sorted by speed DESC
  const aliveActors = battle.units.filter((u) => u.alive).sort((a, b) => b.spd - a.spd);

  let fled = false;
  let capturedGeneral: { name: string; growth: number } | undefined;

  for (const actor of aliveActors) {
    if (!actor.alive) continue;
    const aliveEnemies = battle.units.filter((u) => u.side === 'enemy' && u.alive);
    const alivePlayers = battle.units.filter((u) => u.side === 'player' && u.alive);
    if (aliveEnemies.length === 0 || alivePlayers.length === 0) break;

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
        } else {
          logs.push({
            actorUid: actor.uid,
            actorName: actor.name,
            action: 'flee',
            targets: [],
            message: `${actor.name} 试图逃跑，却被敌军拦住了去路！`,
          });
          continue;
        }
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
        const target =
          aliveEnemies.find((e) => e.uid === cmd.targetUid) ?? aliveEnemies[0];
        const tplId = group.capturableTemplateId;
        const hpRatio = target.hp / target.maxHp;
        const chance = tplId ? Math.min(0.75, 0.25 + (1 - hpRatio) * 0.55) : 0;
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
          if (skill.effect === 'heal') {
            const healVal = Math.round(actor.maxHp * 0.42);
            actor.hp = Math.min(actor.maxHp, actor.hp + healVal);
            logs.push({
              actorUid: actor.uid,
              actorName: actor.name,
              action: 'skill',
              skillId: skill.id,
              skillName: skill.name,
              effect: 'heal',
              targets: [{ uid: actor.uid, name: actor.name, damage: 0, heal: healVal }],
              message: `${actor.name} 施展【${skill.name}】，恢复气血 ${healVal}！`,
            });
            continue;
          }
          const targets = skill.aoe
            ? aliveEnemies
            : [aliveEnemies.find((e) => e.uid === cmd.targetUid) ?? aliveEnemies[0]];
          const targetResults = targets.map((t) => {
            const { damage, crit } = calcDamage(actor.atk, t.defending, skill.power);
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
            targets: targetResults,
            message: `${actor.name} 施展【${skill.name}】，造成总计 ${targetResults.reduce((s, r) => s + r.damage, 0)} 点伤害！`,
          });
          continue;
        }
      }

      // Default: normal attack
      const target = aliveEnemies.find((e) => e.uid === cmd.targetUid) ?? aliveEnemies[0];
      const { damage, crit } = calcDamage(actor.atk, target.defending, 1);
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
      // Allied general auto-attack
      const target = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      const { damage, crit } = calcDamage(actor.atk, target.defending, 1.05);
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
      const useSkill = actor.roleClass !== 'wushi' && actor.mp >= 20 && Math.random() < 0.35;
      if (useSkill) {
        actor.mp -= 20;
        const { damage, crit } = calcDamage(actor.atk, target.defending, 1.25);
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
        const { damage, crit } = calcDamage(actor.atk, target.defending, 0.92);
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
    // Revive with 20% HP back at safety
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
