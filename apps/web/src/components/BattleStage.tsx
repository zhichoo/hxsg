import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SKILLS,
  type BattleActionLog,
  type BattleState,
  type BattleStatusKind,
  type BattleUnit,
  type CharacterView,
  type ChatChannel,
  type ChatMessage,
} from '@hxsg/shared';
import { getCachedAssetImage, loadAssetImage } from '../platform/host';
import { AssetBg, AssetImg } from './AssetImg';
import { ChatDock } from './ChatDock';

interface GeneralCommandInput {
  unitUid: string;
  action: 'attack' | 'skill' | 'defend' | 'item';
  targetUid?: string;
  skillId?: string;
  itemId?: string;
}

interface HeroCommandInput {
  action: 'attack' | 'skill' | 'defend' | 'item' | 'capture' | 'flee';
  targetUid?: string;
  skillId?: string;
  itemId?: string;
}

interface BattleStageProps {
  battle: BattleState;
  character: CharacterView;
  messages: ChatMessage[];
  onSendChat: (channel: ChatChannel, content: string, recipientName?: string) => void;
  onAction: (cmd: HeroCommandInput & { generalCommands?: GeneralCommandInput[] }) => Promise<void>;
  onExitBattle: () => void;
  onNotify: (msg: string) => void;
}

interface FloatingNum {
  uid: string;
  kind: 'damage' | 'heal' | 'miss' | 'text';
  value?: number;
  crit?: boolean;
  subText?: string;
  text?: string;
  color: string;
  createdAt: number;
}

interface ActiveDash {
  actorUid: string;
  targetUid: string;
  startedAt: number;
  dashMs: number;
  strikeMs: number;
  returnMs: number;
  hits: number;
}

interface ActiveFx {
  uid: string;
  effect:
    | 'lei'
    | 'fire'
    | 'wind_rain'
    | 'fg'
    | 'slash'
    | 'heal'
    | 'chaos'
    | 'seal'
    | 'trap'
    | 'poison'
    | 'buff_atk'
    | 'buff_spd'
    | 'revive'
    | 'cast_gold'
    | 'cast_purple';
  startedAt: number;
  duration: number;
}

interface SkillCallout {
  uid: string;
  label: string;
  color: string;
  startedAt: number;
  duration: number;
}

const FX_PRELOAD_LIST = [
  'f_sd.png',
  'fire.png',
  'fg.png',
  'fg2.png',
  'fg3.png',
  'pi_fl.png',
  'dead_fl.png',
  'blood.png',
  'smoke.png',
  'f_stat.png',
  'dead_1.png',
  'num.png',
  'num2.png',
  'wz.png',
  'yz.png',
];

// Pixel-verified per-class rig anchors for official HXSG 3-part character sprites (_h/_b/_f)
const CLASS_SPRITE_RIG = {
  // 武士 (r1 / r1n / n1 / n1n): legs 37x10, body 60x15, head 21x21 (supports 1x Web & Nx hi-DPI MAPP)
  '1': {
    legIdle: [0, 18] as const,
    legAtk: [18, 19] as const,
    bodyIdle: [0, 22, -13] as const,
    bodyAtk: [22, 38, -9] as const,
    bodyY: -19,
    headY: -36,
    headYAtk: -35,
    baseLegsW: 37,
    baseBodyW: 60,
  },
  // 文人 (r2 / r2n / n2 / n2n): legs 28x9, body 61x16, head 21x21
  '2': {
    legIdle: [0, 14] as const,
    legAtk: [14, 14] as const,
    bodyIdle: [0, 23, -10] as const,
    bodyAtk: [23, 38, -10] as const,
    bodyY: -17,
    headY: -34,
    headYAtk: -33,
    baseLegsW: 28,
    baseBodyW: 61,
  },
  // 异人 (r3 / r3n / n3 / n3n): legs 28x8, body 67x15, head 21x21
  '3': {
    legIdle: [0, 14] as const,
    legAtk: [14, 14] as const,
    bodyIdle: [0, 31, -11] as const,
    bodyAtk: [31, 36, -11] as const,
    bodyY: -18,
    headY: -34,
    headYAtk: -31,
    baseLegsW: 28,
    baseBodyW: 67,
  },
};

function getSpriteRig(spriteKey: string) {
  if (spriteKey.includes('2')) return CLASS_SPRITE_RIG['2'];
  if (spriteKey.includes('3')) return CLASS_SPRITE_RIG['3'];
  return CLASS_SPRITE_RIG['1'];
}

type SpriteFrame = readonly [number, number, number, number];

// Exact tRNS-verified frame rectangles from official HXSG PNG sprite sheets
const SPRITE_FRAMES = {
  // 3-frame vertical thunderbolt (f_sd.png 96x71)
  thunder: [
    [0, 0, 36, 71],
    [36, 0, 33, 71],
    [69, 0, 27, 71],
  ] as readonly SpriteFrame[],
  // 3-frame pixel flame (fire.png 66x44)
  fire: [
    [0, 0, 25, 44],
    [25, 0, 20, 44],
    [45, 0, 21, 44],
  ] as readonly SpriteFrame[],
  // Clean right-side blue starburst hit spark (fg.png 92x68 -> x=27..92)
  starburst: [[27, 0, 65, 68]] as readonly SpriteFrame[],
  // 4-frame golden light pillar (fg2.png 104x28, pixel-verified cuts)
  goldLight: [
    [0, 0, 24, 28],
    [26, 0, 28, 28],
    [54, 0, 22, 28],
    [78, 0, 25, 28],
  ] as readonly SpriteFrame[],
  // 5-frame purple magic aura (fg3.png 166x33, pixel-verified zero-gap cuts)
  purpleAura: [
    [0, 0, 39, 33],
    [40, 0, 37, 33],
    [78, 0, 34, 33],
    [114, 0, 24, 33],
    [139, 0, 27, 33],
  ] as readonly SpriteFrame[],
  // 3-frame ice-blue energy wave (pi_fl.png 86x35)
  blueWave: [
    [0, 0, 30, 35],
    [30, 0, 32, 35],
    [62, 0, 24, 35],
  ] as readonly SpriteFrame[],
  // 4-frame luminous spirit flame (dead_fl.png 111x43)
  spiritFlame: [
    [0, 0, 31, 43],
    [31, 0, 30, 43],
    [61, 0, 32, 43],
    [93, 0, 18, 43],
  ] as readonly SpriteFrame[],
  // 2-frame red hit blood splash (blood.png 38x22)
  blood: [
    [0, 0, 22, 22],
    [23, 0, 15, 22],
  ] as readonly SpriteFrame[],
  // 3-frame dash dust puff (smoke.png 60x12)
  smoke: [
    [0, 0, 20, 12],
    [22, 0, 17, 12],
    [41, 0, 17, 12],
  ] as readonly SpriteFrame[],
};

// Exact pixel-verified digit rectangles in official num.png (damage) & num2.png (heal)
const NUM_GLYPHS_DMG: Record<string, SpriteFrame> = {
  '0': [0, 0, 36, 50],
  '1': [50, 0, 22, 50],
  '2': [86, 0, 36, 50],
  '3': [126, 0, 36, 50],
  '4': [162, 0, 36, 50],
  '5': [198, 0, 36, 50],
  '6': [243, 0, 36, 50],
  '7': [284, 0, 36, 50],
  '8': [324, 0, 36, 50],
  '9': [365, 0, 36, 50],
  '-': [405, 0, 41, 50],
};

const NUM_GLYPHS_HEAL: Record<string, SpriteFrame> = {
  '0': [0, 0, 36, 50],
  '1': [50, 0, 22, 50],
  '2': [86, 0, 36, 50],
  '3': [126, 0, 36, 50],
  '4': [162, 0, 36, 50],
  '5': [203, 0, 36, 50],
  '6': [243, 0, 36, 50],
  '7': [279, 0, 36, 50],
  '8': [324, 0, 36, 50],
  '9': [365, 0, 36, 50],
  '-': [405, 0, 41, 50],
};

// Official status glyphs in f_stat.png (118x19): 封 围 攻 乱 毒 速 隐 固
const STAT_SPRITE_RECT: Partial<Record<BattleStatusKind, SpriteFrame>> = {
  seal: [0, 0, 15, 19],
  trap: [15, 0, 15, 19],
  atk_up: [30, 0, 15, 19],
  chaos: [45, 0, 15, 19],
  poison: [60, 0, 15, 19],
  spd_up: [75, 0, 14, 19],
};

const STATUS_BADGE: Record<BattleStatusKind, { label: string; bg: string }> = {
  chaos: { label: '乱', bg: '#9e198b' },
  seal: { label: '封', bg: '#136ea8' },
  trap: { label: '围', bg: '#8f5b0d' },
  poison: { label: '毒', bg: '#1e7a2c' },
  atk_up: { label: '攻', bg: '#b82a14' },
  spd_up: { label: '速', bg: '#107a8f' },
  def_down: { label: '破', bg: '#6e3a10' },
};

function getUnitCoords(u: BattleUnit, w: number, h: number): { x: number; y: number } {
  if (u.side === 'enemy') {
    const enemySlots = [
      { x: w * 0.14, y: h * 0.44 },
      { x: w * 0.27, y: h * 0.58 },
      { x: w * 0.14, y: h * 0.73 },
      { x: w * 0.27, y: h * 0.86 },
      { x: w * 0.2, y: h * 0.58 },
    ];
    return enemySlots[u.position % enemySlots.length];
  }
  const playerSlots = [
    { x: w * 0.86, y: h * 0.58 },
    { x: w * 0.73, y: h * 0.44 },
    { x: w * 0.73, y: h * 0.73 },
    { x: w * 0.86, y: h * 0.86 },
  ];
  return playerSlots[u.position % playerSlots.length];
}

export function BattleStage({
  battle,
  character,
  messages,
  onSendChat,
  onAction,
  onExitBattle,
  onNotify,
}: BattleStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ w: 380, h: 300, dpr: 2 });

  const [selectedTargetUid, setSelectedTargetUid] = useState<string | undefined>(undefined);
  const [subMenu, setSubMenu] = useState<'none' | 'skill' | 'item'>('none');
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [autoBattle, setAutoBattle] = useState(false);
  const [autoGenerals, setAutoGenerals] = useState(false);
  const [battleSpeed, setBattleSpeed] = useState<1 | 2>(1);
  const [stepIdx, setStepIdx] = useState(0);
  const [queuedHeroCmd, setQueuedHeroCmd] = useState<HeroCommandInput | null>(null);
  const [queuedGeneralCmds, setQueuedGeneralCmds] = useState<GeneralCommandInput[]>([]);
  const [lastRoundCmd, setLastRoundCmd] = useState<{
    hero: HeroCommandInput;
    generals: GeneralCommandInput[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const [isReplaying, setIsReplaying] = useState(false);
  const battleSpeedRef = useRef<1 | 2>(1);
  battleSpeedRef.current = battleSpeed;

  const fxRef = useRef<ActiveFx[]>([]);
  const floatsRef = useRef<FloatingNum[]>([]);
  const calloutsRef = useRef<SkillCallout[]>([]);
  const dashesRef = useRef<ActiveDash[]>([]);
  const hurtRef = useRef<Map<string, number>>(new Map());
  const dyingUntilRef = useRef<Map<string, number>>(new Map());
  const lungeRef = useRef<Map<string, number>>(new Map());
  const imgCacheRef = useRef<Map<string, HTMLImageElement | null>>(new Map());
  const timeoutFiredRoundRef = useRef<number>(0);

  // Preload all official FX sprites on mount so even the VERY FIRST cast has crisp instant visuals
  useEffect(() => {
    for (const file of FX_PRELOAD_LIST) {
      if (!imgCacheRef.current.has(file)) {
        void loadAssetImage(file).then((img) => {
          imgCacheRef.current.set(file, img);
        });
      }
    }
  }, []);

  const aliveEnemies = useMemo(
    () => battle.units.filter((u) => u.side === 'enemy' && u.alive),
    [battle.units],
  );
  const aliveAllies = useMemo(
    () => battle.units.filter((u) => u.side === 'player' && u.alive).sort((a, b) => a.position - b.position),
    [battle.units],
  );
  const deadAlliedGenerals = useMemo(
    () => battle.units.filter((u) => u.side === 'player' && !u.isMainRole && !u.alive),
    [battle.units],
  );

  const controllableUnits = useMemo(() => {
    if (autoGenerals || autoBattle) {
      return aliveAllies.filter((u) => u.isMainRole);
    }
    return aliveAllies;
  }, [aliveAllies, autoGenerals, autoBattle]);

  const activeUnit = controllableUnits[stepIdx] ?? controllableUnits[0];
  const isCommandingHero = !activeUnit || activeUnit.isMainRole;

  const activeSkills = useMemo(() => {
    if (isCommandingHero) {
      return SKILLS.filter((s) => s.roleClass === character.roleClass || s.roleClass === 'all');
    }
    const ids = [activeUnit.skillId, activeUnit.skill2Id].filter((id): id is string => Boolean(id));
    return ids
      .map((id) => SKILLS.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
  }, [isCommandingHero, character.roleClass, activeUnit]);

  const consumables = useMemo(
    () => character.inventory.filter((i) => i.type === 'consumable' && i.quantity > 0),
    [character.inventory],
  );

  // Reset turn command queue cleanly on each new round or battle
  useEffect(() => {
    setStepIdx(0);
    setQueuedHeroCmd(null);
    setQueuedGeneralCmds([]);
    setSubMenu('none');
    setPendingItemId(null);
  }, [battle.battleId, battle.round]);

  // Sync canvas buffer strictly to actual CSS size * dpr
  useEffect(() => {
    const el = stageRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.max(240, Math.round(rect.width));
      const h = Math.max(200, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      sizeRef.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!aliveEnemies.some((e) => e.uid === selectedTargetUid)) {
      setSelectedTargetUid(aliveEnemies[0]?.uid);
    }
  }, [aliveEnemies, selectedTargetUid]);

  // Trigger authentic classic HXSG sequential choreography:
  // - Melee strikes charge directly to target, slash with blood + starburst, then return
  // - Magic/skills flash caster aura first, then strike targets with pixel sprite VFX & pixel numbers
  useEffect(() => {
    if (!battle.lastLogs.length) return;
    const now = performance.now();
    const spd = battleSpeedRef.current === 2 ? 0.52 : 1;
    const ms = (v: number) => Math.round(v * spd);
    let cursor = 0;

    const stMap: Record<BattleStatusKind, { text: string; color: string }> = {
      chaos: { text: '混乱!', color: '#ff7cf0' },
      seal: { text: '封印!', color: '#7ce2ff' },
      trap: { text: '围困!', color: '#ffd26b' },
      poison: { text: '中毒!', color: '#7dff7a' },
      atk_up: { text: '攻↑', color: '#ff8a5c' },
      spd_up: { text: '速↑', color: '#70f3ff' },
      def_down: { text: '破甲!', color: '#ffb35c' },
    };

    battle.lastLogs.forEach((log: BattleActionLog) => {
      const startAt = now + cursor;

      if (log.skillName) {
        const callColor =
          log.effect === 'lei' || log.effect === 'wind_rain'
            ? '#8cefff'
            : log.effect === 'fire'
              ? '#ffae5c'
              : log.effect === 'heal'
                ? '#8cff9e'
                : log.effect === 'chaos' || log.effect === 'seal' || log.effect === 'trap'
                  ? '#f39eff'
                  : '#ffe875';
        calloutsRef.current.push({
          uid: log.actorUid,
          label: `【${log.skillName}】`,
          color: callColor,
          startedAt: startAt,
          duration: ms(1050),
        });
      }

      const isMelee =
        (log.action === 'attack' ||
          log.skillId === 'liandao' ||
          log.skillId === 'lianji' ||
          log.skillId === 'pojia') &&
        log.targets.length > 0;

      if (isMelee) {
        const primary = log.targets[0];
        const hits = log.skillId === 'lianji' ? 2 : 1;
        const dashMs = ms(230);
        const strikeMs = ms(hits > 1 ? 540 : 330);
        const returnMs = ms(210);

        dashesRef.current.push({
          actorUid: log.actorUid,
          targetUid: primary.uid,
          startedAt: startAt,
          dashMs,
          strikeMs,
          returnMs,
          hits,
        });

        for (let hIdx = 0; hIdx < hits; hIdx++) {
          const hitAt = startAt + dashMs + ms(40 + hIdx * 240);
          if (primary.damage > 0) {
            hurtRef.current.set(primary.uid, hitAt);
          }
          if (primary.killed && hIdx === hits - 1) {
            dyingUntilRef.current.set(primary.uid, hitAt + ms(450));
          }
          fxRef.current.push({
            uid: primary.uid,
            effect: 'slash',
            startedAt: hitAt,
            duration: ms(420),
          });
          if (primary.damage > 0) {
            const perHitDmg =
              hits === 1
                ? primary.damage
                : hIdx === 0
                  ? Math.floor(primary.damage / 2)
                  : primary.damage - Math.floor(primary.damage / 2);
            const subText =
              hIdx === hits - 1 && primary.appliedStatus
                ? stMap[primary.appliedStatus].text
                : undefined;
            floatsRef.current.push({
              uid: primary.uid,
              kind: 'damage',
              value: perHitDmg,
              crit: primary.crit,
              subText,
              color: primary.crit ? '#ffea4f' : '#ff4b4b',
              createdAt: hitAt + ms(25),
            });
          } else if (primary.resisted) {
            floatsRef.current.push({
              uid: primary.uid,
              kind: 'miss',
              color: '#ffe46b',
              createdAt: hitAt + ms(25),
            });
          }
        }
        cursor += dashMs + strikeMs + returnMs + ms(110);
        return;
      }

      // Non-melee action: caster startup pose + cast aura -> target impact
      lungeRef.current.set(log.actorUid, startAt);
      if (log.action === 'skill') {
        const isPurpleCast =
          log.effect === 'chaos' ||
          log.effect === 'seal' ||
          log.effect === 'trap' ||
          log.skillId === 'wudu';
        fxRef.current.push({
          uid: log.actorUid,
          effect: isPurpleCast ? 'cast_purple' : 'cast_gold',
          startedAt: startAt,
          duration: ms(380),
        });
      }

      const impactBase = startAt + ms(log.action === 'skill' ? 260 : 110);
      log.targets.forEach((t, tIdx) => {
        const impactAt = impactBase + ms(tIdx * 85);
        if (t.damage > 0) {
          hurtRef.current.set(t.uid, impactAt + ms(30));
        }
        if (t.killed) {
          dyingUntilRef.current.set(t.uid, impactAt + ms(520));
        }
        let fxType: ActiveFx['effect'] | null = log.effect ?? null;
        if (t.revived) fxType = 'revive';
        else if (log.skillId === 'hfhy') fxType = 'wind_rain';
        else if (t.appliedStatus === 'poison' || log.skillId === 'wudu') fxType = 'poison';
        else if (t.appliedStatus === 'atk_up') fxType = 'buff_atk';
        else if (t.appliedStatus === 'spd_up') fxType = 'buff_spd';
        if (fxType) {
          fxRef.current.push({
            uid: t.uid,
            effect: fxType,
            startedAt: impactAt,
            duration: ms(fxType === 'slash' ? 460 : 760),
          });
        }

        if (t.revived) {
          floatsRef.current.push({
            uid: t.uid,
            kind: t.heal && t.heal > 0 ? 'heal' : 'text',
            value: t.heal,
            subText: t.heal ? '复活' : undefined,
            text: t.heal ? undefined : '上阵!',
            color: '#76ff88',
            createdAt: impactAt + ms(50),
          });
        } else if (t.heal && t.heal > 0) {
          floatsRef.current.push({
            uid: t.uid,
            kind: 'heal',
            value: t.heal,
            color: '#76ff88',
            createdAt: impactAt + ms(50),
          });
        } else if (t.appliedStatus) {
          const stInfo = stMap[t.appliedStatus];
          if (t.damage > 0) {
            floatsRef.current.push({
              uid: t.uid,
              kind: 'damage',
              value: t.damage,
              crit: t.crit,
              subText: stInfo.text,
              color: '#ffea4f',
              createdAt: impactAt + ms(50),
            });
          } else {
            floatsRef.current.push({
              uid: t.uid,
              kind: 'text',
              text: stInfo.text,
              color: stInfo.color,
              createdAt: impactAt + ms(50),
            });
          }
        } else if (t.resisted) {
          floatsRef.current.push({
            uid: t.uid,
            kind: 'miss',
            color: '#ffe46b',
            createdAt: impactAt + ms(50),
          });
        } else if (t.captured) {
          floatsRef.current.push({
            uid: t.uid,
            kind: 'text',
            text: '招降成功!',
            color: '#ffe863',
            createdAt: impactAt + ms(50),
          });
        } else if (t.damage > 0) {
          floatsRef.current.push({
            uid: t.uid,
            kind: 'damage',
            value: t.damage,
            crit: t.crit,
            color: t.crit ? '#ffea4f' : '#ff4b4b',
            createdAt: impactAt + ms(50),
          });
        }
      });

      cursor +=
        log.targets.length > 0
          ? ms(660 + Math.min(3, log.targets.length - 1) * 85)
          : ms(380);
    });

    const totalMs = Math.min(6000, cursor + ms(280));
    setIsReplaying(true);
    const timer = window.setTimeout(() => setIsReplaying(false), totalMs);
    return () => window.clearTimeout(timer);
  }, [battle.lastLogs, battle.round]);

  const submitRound = useCallback(
    async (heroCmd: HeroCommandInput, generalCmds: GeneralCommandInput[]) => {
      if (busy || battle.status !== 'ongoing') return;
      setBusy(true);
      setSubMenu('none');
      setPendingItemId(null);
      if (heroCmd.action !== 'flee') {
        setLastRoundCmd({ hero: heroCmd, generals: generalCmds });
      }
      try {
        await onAction({
          ...heroCmd,
          generalCommands: generalCmds.length > 0 ? generalCmds : undefined,
        });
      } catch (err) {
        onNotify(err instanceof Error ? err.message : '指令执行失败');
      } finally {
        setBusy(false);
      }
    },
    [busy, battle.status, onAction, onNotify],
  );

  // 30s classic countdown timer -> auto-execute last command (or basic attack) when timer hits 0
  useEffect(() => {
    if (battle.status !== 'ongoing') return;
    const tick = () => {
      const sec = Math.max(0, Math.ceil((battle.deadlineAt - Date.now()) / 1000));
      setCountdown(sec);
      if (sec === 0 && !busy && timeoutFiredRoundRef.current !== battle.round) {
        timeoutFiredRoundRef.current = battle.round;
        if (lastRoundCmd) {
          void submitRound(lastRoundCmd.hero, autoGenerals ? [] : lastRoundCmd.generals);
        } else {
          void submitRound({ action: 'attack', targetUid: selectedTargetUid }, []);
        }
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [battle.deadlineAt, battle.status, battle.round, busy, lastRoundCmd, autoGenerals, selectedTargetUid, submitRound]);

  const dispatchCommand = useCallback(
    async (cmd: HeroCommandInput) => {
      if (busy || battle.status !== 'ongoing') return;
      setSubMenu('none');
      setPendingItemId(null);
      const targetUid = cmd.targetUid ?? selectedTargetUid;

      if (isCommandingHero) {
        const heroCmd: HeroCommandInput = { ...cmd, targetUid };
        if (cmd.action === 'flee' || autoBattle || autoGenerals || controllableUnits.length <= 1) {
          await submitRound(heroCmd, []);
          return;
        }
        setQueuedHeroCmd(heroCmd);
        setQueuedGeneralCmds([]);
        setStepIdx(1);
        return;
      }

      const heroCmd = queuedHeroCmd ?? { action: 'attack', targetUid: selectedTargetUid };
      const gAction: GeneralCommandInput['action'] =
        cmd.action === 'skill' || cmd.action === 'defend' || cmd.action === 'item'
          ? cmd.action
          : 'attack';
      const nextGeneralCmds: GeneralCommandInput[] = [
        ...queuedGeneralCmds.filter((c) => c.unitUid !== activeUnit.uid),
        {
          unitUid: activeUnit.uid,
          action: gAction,
          targetUid:
            gAction === 'item'
              ? cmd.targetUid
              : gAction === 'skill' && SKILLS.find((s) => s.id === cmd.skillId)?.kind === 'heal'
                ? cmd.targetUid
                : targetUid,
          skillId: cmd.skillId,
          itemId: cmd.itemId,
        },
      ];

      if (stepIdx + 1 < controllableUnits.length) {
        setQueuedGeneralCmds(nextGeneralCmds);
        setStepIdx(stepIdx + 1);
      } else {
        await submitRound(heroCmd, nextGeneralCmds);
      }
    },
    [
      busy,
      battle.status,
      selectedTargetUid,
      isCommandingHero,
      autoBattle,
      autoGenerals,
      controllableUnits.length,
      submitRound,
      queuedHeroCmd,
      queuedGeneralCmds,
      activeUnit,
      stepIdx,
    ],
  );

  const skipGeneralToAI = useCallback(async () => {
    if (busy || battle.status !== 'ongoing' || isCommandingHero) return;
    setSubMenu('none');
    const heroCmd = queuedHeroCmd ?? { action: 'attack', targetUid: selectedTargetUid };
    const nextGeneralCmds = queuedGeneralCmds.filter((c) => c.unitUid !== activeUnit.uid);
    if (stepIdx + 1 < controllableUnits.length) {
      setQueuedGeneralCmds(nextGeneralCmds);
      setStepIdx(stepIdx + 1);
    } else {
      await submitRound(heroCmd, nextGeneralCmds);
    }
  }, [
    busy,
    battle.status,
    isCommandingHero,
    queuedHeroCmd,
    selectedTargetUid,
    queuedGeneralCmds,
    activeUnit,
    stepIdx,
    controllableUnits.length,
    submitRound,
  ]);

  const stepBack = useCallback(() => {
    if (stepIdx <= 0) return;
    setSubMenu('none');
    setPendingItemId(null);
    if (stepIdx === 1) {
      setStepIdx(0);
      setQueuedHeroCmd(null);
      setQueuedGeneralCmds([]);
    } else {
      const prevIdx = stepIdx - 1;
      const prevUnit = controllableUnits[prevIdx];
      setStepIdx(prevIdx);
      if (prevUnit) {
        setQueuedGeneralCmds((prev) => prev.filter((c) => c.unitUid !== prevUnit.uid));
      }
    }
  }, [stepIdx, controllableUnits]);

  const toggleAutoGenerals = useCallback(() => {
    setAutoGenerals((prev) => {
      const next = !prev;
      if (next && queuedHeroCmd && battle.status === 'ongoing' && !busy) {
        void submitRound(queuedHeroCmd, queuedGeneralCmds);
      }
      return next;
    });
  }, [queuedHeroCmd, queuedGeneralCmds, battle.status, busy, submitRound]);

  const repeatLastRound = useCallback(() => {
    if (!lastRoundCmd || busy || battle.status !== 'ongoing') return;
    void submitRound(lastRoundCmd.hero, autoGenerals ? [] : lastRoundCmd.generals);
  }, [lastRoundCmd, busy, battle.status, autoGenerals, submitRound]);

  // Auto-battle repeats last chosen hero command after current round animation finishes
  useEffect(() => {
    if (!autoBattle || battle.status !== 'ongoing' || busy || isReplaying) return;
    const t = setTimeout(() => {
      const heroCmd =
        lastRoundCmd?.hero && lastRoundCmd.hero.action !== 'item'
          ? { ...lastRoundCmd.hero, targetUid: selectedTargetUid }
          : ({ action: 'attack', targetUid: selectedTargetUid } as HeroCommandInput);
      void submitRound(heroCmd, []);
    }, battleSpeed === 2 ? 320 : 520);
    return () => clearTimeout(t);
  }, [autoBattle, battle.status, battle.round, busy, isReplaying, battleSpeed, submitRound, selectedTargetUid, lastRoundCmd]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (battle.status !== 'ongoing') {
        if (e.key === 'Enter' || e.key === 'Escape') onExitBattle();
        return;
      }
      if (e.key === '1') void dispatchCommand({ action: 'attack' });
      else if (e.key === '2') setSubMenu((m) => (m === 'skill' ? 'none' : 'skill'));
      else if (e.key === '3') {
        if (isCommandingHero) void dispatchCommand({ action: 'capture' });
        else void skipGeneralToAI();
      } else if (e.key === '4') {
        setPendingItemId(null);
        setSubMenu((m) => (m === 'item' ? 'none' : 'item'));
      } else if (e.key === '6') {
        if (isCommandingHero) void dispatchCommand({ action: 'flee' });
        else stepBack();
      } else if (e.key === '7') void dispatchCommand({ action: 'defend' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [battle.status, dispatchCommand, onExitBattle, isCommandingHero, skipGeneralToAI, stepBack]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const getImg = (name: string): HTMLImageElement | null => {
      const globalCached = getCachedAssetImage(name);
      if (globalCached !== undefined) return globalCached;
      const cache = imgCacheRef.current;
      if (cache.has(name)) return cache.get(name) ?? null;
      cache.set(name, null);
      void loadAssetImage(name).then((img) => {
        cache.set(name, img);
      });
      return null;
    };

    let rafId = 0;
    const render = (now: number) => {
      const { w, h, dpr } = sizeRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;

      // 1. Background terrain
      ctx.fillStyle = '#bca96b';
      ctx.fillRect(0, 0, w, h);

      const bgPrefix = battle.battleBg || 'f_bg2';
      const topH = Math.round(h * 0.21);
      const btmH = Math.round(h * 0.11);
      const topL = getImg(`${bgPrefix}_5.png`);
      const topR = getImg(`${bgPrefix}_6.png`);
      if (topL && topR) {
        const hiBg = topL.width > 160;
        ctx.imageSmoothingEnabled = hiBg;
        if (hiBg) ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(topL, 0, 0, w / 2, topH);
        ctx.drawImage(topR, w / 2, 0, w / 2, topH);
        ctx.imageSmoothingEnabled = false;
      } else {
        ctx.fillStyle = '#4f6d31';
        ctx.fillRect(0, 0, w, topH);
      }

      const btmL = getImg(`${bgPrefix}_3.png`);
      const btmR = getImg(`${bgPrefix}_4.png`);
      if (btmL && btmR) {
        const hiBg = btmL.width > 160;
        ctx.imageSmoothingEnabled = hiBg;
        if (hiBg) ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(btmL, 0, h - btmH, w / 2, btmH);
        ctx.drawImage(btmR, w / 2, h - btmH, w / 2, btmH);
        ctx.imageSmoothingEnabled = false;
      } else {
        ctx.fillStyle = '#5c6b2d';
        ctx.fillRect(0, h - btmH, w, btmH);
      }

      const bush1 = getImg('f_bg_c.png');
      const bush2 = getImg('f_bg_c2.png');
      if (bush1) {
        ctx.imageSmoothingEnabled = bush1.width > 40;
        if (bush1.width > 40) ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bush1, Math.round(w * 0.54), Math.round(topH - 12), 34, 30);
      }
      if (bush2) {
        ctx.imageSmoothingEnabled = bush2.width > 40;
        if (bush2.width > 40) ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bush2, Math.round(w * 0.68), Math.round(h * 0.72), 32, 24);
      }
      ctx.imageSmoothingEnabled = false;

      const desiredScale = h < 270 ? 1.5 : 2;
      const physScale = Math.max(2, Math.round(desiredScale * dpr));
      const spriteScale = physScale / dpr;
      const fxZoom = spriteScale / 1.5;
      const arrowImg = getImg('f_jt.png');
      const deadImg = getImg('dead_1.png');

      // Prune completed dashes and draw dashing attacker on top of other units
      dashesRef.current = dashesRef.current.filter(
        (d) => now - d.startedAt < d.dashMs + d.strikeMs + d.returnMs,
      );
      const activeDashByActor = new Map<string, ActiveDash>();
      for (const d of dashesRef.current) {
        if (now >= d.startedAt) activeDashByActor.set(d.actorUid, d);
      }

      const orderedUnits = [...battle.units].sort((a, b) => {
        const da = activeDashByActor.has(a.uid) ? 1 : 0;
        const db = activeDashByActor.has(b.uid) ? 1 : 0;
        if (da !== db) return da - db;
        return a.position - b.position;
      });

      // 2. Units (alive + dying units still completing hit animation + fallen allied generals ghost marker)
      for (const u of orderedUnits) {
        const pos = getUnitCoords(u, w, h);
        const dyingUntil = dyingUntilRef.current.get(u.uid) ?? 0;
        const stillDying = !u.alive && now < dyingUntil;
        if (!u.alive && !stillDying) {
          if (u.side === 'player' && !u.isMainRole) {
            ctx.save();
            ctx.globalAlpha = 0.72;
            if (deadImg) {
              ctx.drawImage(deadImg, Math.round(pos.x - 16), Math.round(pos.y - 16), 32, 17);
            }
            ctx.font = 'bold 10px "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(0,0,0,0.65)';
            ctx.fillRect(Math.round(pos.x - 24), Math.round(pos.y + 3), 48, 14);
            ctx.fillStyle = '#ff9c9c';
            ctx.fillText(`${u.name.slice(0, 3)}(阵亡)`, pos.x, pos.y + 13);
            ctx.restore();
          }
          continue;
        }
        const dyingAlpha = stillDying ? Math.min(1, Math.max(0.15, (dyingUntil - now) / 160)) : 1;

        // Authentic classic HXSG melee charge-to-target & return interpolation
        const dash = activeDashByActor.get(u.uid);
        let dashX = pos.x;
        let dashY = pos.y;
        let isAttacking = false;
        let showSmoke = false;
        let smokeProgress = 0;

        if (dash) {
          const targetUnit = battle.units.find((x) => x.uid === dash.targetUid);
          const tPos = targetUnit ? getUnitCoords(targetUnit, w, h) : pos;
          const strikeX = tPos.x + (u.side === 'player' ? Math.round(22 * spriteScale) : -Math.round(22 * spriteScale));
          const strikeY = tPos.y;
          const el = now - dash.startedAt;

          if (el < dash.dashMs) {
            const p = el / dash.dashMs;
            const ease = 1 - (1 - p) * (1 - p);
            dashX = pos.x + (strikeX - pos.x) * ease;
            dashY = pos.y + (strikeY - pos.y) * ease;
            isAttacking = p > 0.6;
            showSmoke = true;
            smokeProgress = p;
          } else if (el < dash.dashMs + dash.strikeMs) {
            const sEl = el - dash.dashMs;
            const swing =
              dash.hits > 1
                ? Math.sin((sEl / dash.strikeMs) * Math.PI * dash.hits) * (u.side === 'player' ? -8 : 8)
                : Math.sin((sEl / dash.strikeMs) * Math.PI) * (u.side === 'player' ? -6 : 6);
            dashX = strikeX + swing;
            dashY = strikeY;
            isAttacking = true;
          } else {
            const rP = Math.min(1, (el - dash.dashMs - dash.strikeMs) / dash.returnMs);
            dashX = strikeX + (pos.x - strikeX) * rP;
            dashY = strikeY + (pos.y - strikeY) * rP;
          }
        } else {
          const lungeAt = lungeRef.current.get(u.uid) ?? 0;
          const lungeElapsed = now - lungeAt;
          if (lungeElapsed >= 0 && lungeElapsed < 280) {
            isAttacking = true;
            dashX = pos.x + Math.sin((lungeElapsed / 280) * Math.PI) * (u.side === 'player' ? -14 : 14);
          }
        }

        const hurtAt = hurtRef.current.get(u.uid) ?? 0;
        const hurtDur = battleSpeedRef.current === 2 ? 200 : 340;
        const hurtElapsed = now - hurtAt;
        const isHurt = hurtElapsed >= 0 && hurtElapsed < hurtDur;
        const hurtRecoil = isHurt
          ? Math.sin((hurtElapsed / hurtDur) * Math.PI) * (u.side === 'enemy' ? -10 : 10) +
            Math.sin(hurtElapsed * 0.2) * 3
          : 0;

        const bob = dash ? 0 : Math.sin(now / 280 + pos.x) > 0 ? 1 : 0;
        const ux = Math.round(dashX + hurtRecoil);
        const uy = Math.round(dashY);

        // Dash dust puff at feet when launching forward across the battlefield
        if (showSmoke) {
          const smoke = getImg('smoke.png');
          if (smoke) {
            const sIdx = Math.min(2, Math.floor(smokeProgress * 3));
            const [sx, sy, sw, sh] = SPRITE_FRAMES.smoke[sIdx];
            const srcRes = Math.max(1, smoke.height / sh);
            const dustX = u.side === 'player' ? pos.x + 4 : pos.x - Math.round(sw * 1.4);
            ctx.imageSmoothingEnabled = srcRes > 1;
            if (srcRes > 1) ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(
              smoke,
              sx * srcRes,
              sy * srcRes,
              sw * srcRes,
              sh * srcRes,
              Math.round(dustX),
              Math.round(pos.y - 12),
              Math.round(sw * 1.35),
              Math.round(sh * 1.35),
            );
            ctx.imageSmoothingEnabled = false;
          }
        }

        // Ground shadow
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(
          ux,
          uy + 2,
          Math.round(11 * spriteScale),
          Math.round(3.5 * spriteScale),
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();

        // Target / active-unit ground ring
        if (u.uid === selectedTargetUid && u.side === 'enemy') {
          ctx.strokeStyle = '#fff04d';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(
            ux,
            uy + 2,
            Math.round(13.5 * spriteScale),
            Math.round(4.8 * spriteScale),
            0,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        } else if (battle.status === 'ongoing' && activeUnit && u.uid === activeUnit.uid) {
          ctx.strokeStyle = '#5cf2ff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(
            ux,
            uy + 2,
            Math.round(14 * spriteScale),
            Math.round(5 * spriteScale),
            0,
            0,
            Math.PI * 2,
          );
          ctx.stroke();
        }

        const head = getImg(`${u.spriteKey}_h.png`);
        const body = getImg(`${u.spriteKey}_b.png`);
        const legs = getImg(`${u.spriteKey}_f.png`);
        const rig = getSpriteRig(u.spriteKey);

        ctx.save();
        ctx.globalAlpha = dyingAlpha;
        ctx.translate(ux, uy);
        if (u.side === 'player') ctx.scale(-1, 1);

        const hiResChar = Boolean((head && head.width > 21) || (body && body.width > rig.baseBodyW));
        ctx.imageSmoothingEnabled = hiResChar;
        if (hiResChar) ctx.imageSmoothingQuality = 'high';

        if (legs) {
          const legRes = Math.max(1, legs.width / rig.baseLegsW);
          const [sx, sw] = isAttacking ? rig.legAtk : rig.legIdle;
          const dw = sw * spriteScale;
          const dh = (legs.height / legRes) * spriteScale;
          ctx.drawImage(legs, sx * legRes, 0, sw * legRes, legs.height, Math.round(-dw / 2), -dh, dw, dh);
        }
        if (body) {
          const isWideWarrior = !u.spriteKey.includes('2') && !u.spriteKey.includes('3') && body.width === 288;
          const baseBodyW = isWideWarrior ? 72 : rig.baseBodyW;
          const bodyRes = Math.max(1, body.width / baseBodyW);
          const [sx, sw, dxPx] = isWideWarrior
            ? isAttacking
              ? ([34, 38, -11] as const)
              : ([0, 34, -17] as const)
            : isAttacking
              ? rig.bodyAtk
              : rig.bodyIdle;
          const dw = sw * spriteScale;
          const dh = (body.height / bodyRes) * spriteScale;
          ctx.drawImage(
            body,
            sx * bodyRes,
            0,
            sw * bodyRes,
            body.height,
            Math.round(dxPx * spriteScale),
            Math.round(rig.bodyY * spriteScale) + bob,
            dw,
            dh,
          );
        }
        if (head) {
          const headRes = Math.max(1, head.width / 21);
          const dw = (head.width / headRes) * spriteScale;
          const dh = (head.height / headRes) * spriteScale;
          const headY = isAttacking ? rig.headYAtk : rig.headY;
          ctx.drawImage(
            head,
            0,
            0,
            head.width,
            head.height,
            Math.round(-dw / 2),
            Math.round(headY * spriteScale) + bob,
            dw,
            dh,
          );
        }
        ctx.restore();

        // HP & MP bars
        const charTop = uy - Math.round(38 * spriteScale);
        const barW = 52;
        const bx = Math.round(ux - barW / 2);
        const by = charTop - 13;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx - 1, by - 1, barW + 2, 11);
        ctx.fillStyle = '#240909';
        ctx.fillRect(bx, by, barW, 4);
        ctx.fillStyle = '#e8231a';
        ctx.fillRect(bx, by, Math.round(barW * Math.max(0, u.hp / u.maxHp)), 4);
        ctx.fillStyle = '#091538';
        ctx.fillRect(bx, by + 5, barW, 4);
        ctx.fillStyle = '#1d65f0';
        ctx.fillRect(bx, by + 5, Math.round(barW * Math.max(0, u.mp / Math.max(1, u.maxMp))), 4);

        // Nameplate
        ctx.font = 'bold 11.5px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        const textW = ctx.measureText(u.name).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
        ctx.fillRect(Math.round(ux - textW / 2 - 4), uy + 4, Math.round(textW + 8), 16);
        ctx.fillStyle = u.side === 'player' ? '#fff394' : '#ffffff';
        ctx.fillText(u.name, ux, uy + 16);

        // Official pixel status glyphs from f_stat.png (封/围/攻/乱/毒/速) above HP bar
        if (u.statuses && u.statuses.length > 0) {
          const statImg = getImg('f_stat.png');
          u.statuses.slice(0, 4).forEach((st, idx) => {
            const sx = bx + idx * 16;
            const sy = by - 20;
            const rect = STAT_SPRITE_RECT[st.kind];
            if (statImg && rect) {
              ctx.drawImage(statImg, rect[0], rect[1], rect[2], rect[3], sx, sy, 15, 19);
            } else {
              const meta = STATUS_BADGE[st.kind] ?? { label: '态', bg: '#555' };
              ctx.fillStyle = meta.bg;
              ctx.fillRect(sx, sy + 2, 15, 15);
              ctx.strokeStyle = '#ffe97d';
              ctx.lineWidth = 1;
              ctx.strokeRect(sx, sy + 2, 15, 15);
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 9.5px "PingFang SC", "Microsoft YaHei", sans-serif';
              ctx.fillText(meta.label, sx + 7.5, sy + 13);
            }
          });
        }

        // Red action pointer arrow next to active unit
        if (battle.status === 'ongoing' && activeUnit && u.uid === activeUnit.uid) {
          const px = ux - Math.round(23 * spriteScale) + Math.sin(now / 180) * 2;
          const py = uy - Math.round(24 * spriteScale);
          if (arrowImg) {
            ctx.drawImage(arrowImg, px, py, 18, 18);
          }
        }
      }

      // 3. Authentic Official Pixel-Sprite Skill VFX (supports 1x Web & Nx hi-DPI MAPP)
      const drawSheetFrame = (
        img: HTMLImageElement | null,
        frames: readonly SpriteFrame[],
        t: number,
        cx: number,
        bottomY: number,
        scale: number,
      ) => {
        if (!img || frames.length === 0) return;
        const idx = Math.min(frames.length - 1, Math.floor(t * frames.length));
        const [sx, sy, sw, sh] = frames[idx];
        const srcRes = Math.max(1, img.height / sh);
        const dw = Math.round(sw * scale);
        const dh = Math.round(sh * scale);
        ctx.imageSmoothingEnabled = srcRes > 1;
        if (srcRes > 1) ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          img,
          sx * srcRes,
          sy * srcRes,
          sw * srcRes,
          sh * srcRes,
          Math.round(cx - dw / 2),
          Math.round(bottomY - dh),
          dw,
          dh,
        );
        ctx.imageSmoothingEnabled = false;
      };

      fxRef.current = fxRef.current.filter((f) => now - f.startedAt < f.duration);
      for (const fx of fxRef.current) {
        const elapsed = now - fx.startedAt;
        if (elapsed < 0) continue;
        const t = Math.min(1, elapsed / fx.duration);
        const unit = battle.units.find((u) => u.uid === fx.uid);
        if (!unit) continue;
        const pos = getUnitCoords(unit, w, h);

        ctx.save();
        ctx.globalAlpha = t > 0.78 ? 1 - (t - 0.78) / 0.22 : 1;

        if (fx.effect === 'cast_gold') {
          // Classic caster startup aura (first 2 frames of fg2.png at caster's feet)
          const fg2 = getImg('fg2.png');
          drawSheetFrame(fg2, SPRITE_FRAMES.goldLight.slice(0, 2), t, pos.x, pos.y + 4, 1.55 * fxZoom);
        } else if (fx.effect === 'cast_purple') {
          // Classic dark/control caster startup ring (first 2 frames of fg3.png)
          const fg3 = getImg('fg3.png');
          drawSheetFrame(fg3, SPRITE_FRAMES.purpleAura.slice(0, 2), t, pos.x, pos.y + 4, 1.4 * fxZoom);
        } else if (fx.effect === 'lei') {
          // Official 3-frame thunderbolt f_sd.png striking down + hit flash fg.png
          const sd = getImg('f_sd.png');
          const fg = getImg('fg.png');
          drawSheetFrame(sd, SPRITE_FRAMES.thunder, t, pos.x, pos.y + 4, 1.55 * fxZoom);
          if (fg && t > 0.25 && t < 0.72) {
            drawSheetFrame(fg, SPRITE_FRAMES.starburst, 0, pos.x, pos.y + 2, 0.52 * fxZoom);
          }
        } else if (fx.effect === 'wind_rain') {
          // 呼风唤雨: official ice-blue wind-rain wave (pi_fl.png) + blowing pixel leaves (yz.png) + rain streaks
          const pi = getImg('pi_fl.png');
          const leaf = getImg('yz.png');
          drawSheetFrame(pi, SPRITE_FRAMES.blueWave, (t * 1.4) % 1, pos.x, pos.y + 4, 1.75 * fxZoom);
          ctx.strokeStyle = 'rgba(165, 232, 255, 0.88)';
          ctx.lineWidth = 2;
          for (let i = 0; i < 6; i++) {
            const p = (t * 2.2 + i * 0.17) % 1;
            const rx = pos.x + (i - 2.5) * 11 * fxZoom - p * 16 * fxZoom;
            const ry = pos.y - 68 * fxZoom + p * 74 * fxZoom;
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx - 5 * fxZoom, ry + 11 * fxZoom);
            ctx.stroke();
          }
          if (leaf) {
            const lw = Math.round(leaf.width * 1.3 * fxZoom);
            const lh = Math.round(leaf.height * 1.3 * fxZoom);
            for (let i = 0; i < 3; i++) {
              const lp = (t * 1.5 + i * 0.31) % 1;
              const lx = pos.x + (24 - lp * 52 + Math.sin(lp * Math.PI * 2 + i) * 10) * fxZoom;
              const ly = pos.y - (52 - lp * 44 - i * 8) * fxZoom;
              ctx.drawImage(leaf, Math.round(lx - lw / 2), Math.round(ly - lh / 2), lw, lh);
            }
          }
        } else if (fx.effect === 'fire') {
          // Official 3-frame roaring flame fire.png
          const fire = getImg('fire.png');
          drawSheetFrame(fire, SPRITE_FRAMES.fire, (t * 2) % 1, pos.x, pos.y + 4, 1.6 * fxZoom);
        } else if (fx.effect === 'fg') {
          // 排山倒海: official ice-blue surge pi_fl.png + clean blue starburst fg.png
          const pi = getImg('pi_fl.png');
          const fg = getImg('fg.png');
          drawSheetFrame(pi, SPRITE_FRAMES.blueWave, t, pos.x, pos.y + 4, 1.75 * fxZoom);
          if (fg && t < 0.65) {
            const sc = (0.68 + Math.sin((t / 0.65) * Math.PI) * 0.45) * fxZoom;
            drawSheetFrame(fg, SPRITE_FRAMES.starburst, 0, pos.x, pos.y + 4, sc);
          }
        } else if (fx.effect === 'slash') {
          // Physical melee impact: official 2-frame crimson blood.png + crisp fg.png flash
          const fg = getImg('fg.png');
          const blood = getImg('blood.png');
          if (fg && t < 0.65) {
            const sc = (0.5 + Math.sin((t / 0.65) * Math.PI) * 0.3) * fxZoom;
            drawSheetFrame(fg, SPRITE_FRAMES.starburst, 0, pos.x, pos.y - 6 * fxZoom, sc);
          }
          if (blood) {
            drawSheetFrame(blood, SPRITE_FRAMES.blood, t, pos.x, pos.y - 12 * fxZoom, 1.6 * fxZoom);
          }
        } else if (fx.effect === 'heal' || fx.effect === 'buff_atk') {
          // 妙手回春 / 吃药 / 魔神附体: exact 4-frame golden light pillar fg2.png
          const fg2 = getImg('fg2.png');
          drawSheetFrame(fg2, SPRITE_FRAMES.goldLight, t, pos.x, pos.y + 2, 1.95 * fxZoom);
        } else if (fx.effect === 'buff_spd') {
          // 疾风咒: official 3-frame blue wind-energy surge pi_fl.png
          const pi = getImg('pi_fl.png');
          drawSheetFrame(pi, SPRITE_FRAMES.blueWave, t, pos.x, pos.y + 2, 1.7 * fxZoom);
        } else if (fx.effect === 'revive') {
          // 还魂丹 / 招将上阵: official 4-frame spirit flame dead_fl.png + golden light fg2.png
          const dfl = getImg('dead_fl.png');
          const fg2 = getImg('fg2.png');
          drawSheetFrame(dfl, SPRITE_FRAMES.spiritFlame, t, pos.x, pos.y + 4, 1.6 * fxZoom);
          drawSheetFrame(fg2, SPRITE_FRAMES.goldLight, t, pos.x, pos.y + 2, 1.65 * fxZoom);
        } else if (
          fx.effect === 'chaos' ||
          fx.effect === 'seal' ||
          fx.effect === 'trap' ||
          fx.effect === 'poison'
        ) {
          // 离间计 / 定身计 / 画地为牢 / 五毒攻心: exact 5-frame purple magic aura fg3.png
          const fg3 = getImg('fg3.png');
          drawSheetFrame(fg3, SPRITE_FRAMES.purpleAura, t, pos.x, pos.y + 4, 1.7 * fxZoom);
        }
        ctx.restore();
      }

      // 3.8 Floating Skill Name Callouts above caster
      calloutsRef.current = calloutsRef.current.filter((c) => now - c.startedAt < c.duration);
      for (const co of calloutsRef.current) {
        const elapsed = now - co.startedAt;
        if (elapsed < 0) continue;
        const unit = battle.units.find((u) => u.uid === co.uid);
        if (!unit) continue;
        const pos = getUnitCoords(unit, w, h);
        const rise = (elapsed / co.duration) * 16;
        ctx.save();
        ctx.globalAlpha = elapsed > co.duration * 0.7 ? 1 - (elapsed - co.duration * 0.7) / (co.duration * 0.3) : 1;
        ctx.font = 'bold 12px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        const tw = ctx.measureText(co.label).width;
        const bx = Math.max(4, Math.min(w - tw - 14, pos.x - tw / 2 - 5));
        const by = Math.max(6, pos.y - Math.round(48 * spriteScale) - rise);
        ctx.fillStyle = 'rgba(26, 6, 32, 0.88)';
        ctx.fillRect(bx, by, tw + 10, 18);
        ctx.strokeStyle = co.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, tw + 10, 18);
        ctx.fillStyle = co.color;
        ctx.fillText(co.label, bx + (tw + 10) / 2, by + 13);
        ctx.restore();
      }

      // 4. Authentic Official Pixel Damage / Heal Numbers (num.png / num2.png) & Miss (wz.png)
      const drawPixelDigits = (
        sheet: HTMLImageElement,
        glyphs: Record<string, SpriteFrame>,
        str: string,
        cx: number,
        bottomY: number,
        targetHeight: number,
      ) => {
        const scale = targetHeight / 50;
        let totalW = 0;
        const parts: SpriteFrame[] = [];
        for (const ch of str) {
          const g = glyphs[ch];
          if (g) {
            parts.push(g);
            totalW += Math.round(g[2] * scale) + 1;
          }
        }
        let x = Math.round(cx - totalW / 2);
        const y = Math.round(bottomY - targetHeight);
        for (const [sx, sy, sw, sh] of parts) {
          const dw = Math.round(sw * scale);
          ctx.drawImage(sheet, sx, sy, sw, sh, x, y, dw, Math.round(targetHeight));
          x += dw + 1;
        }
      };

      const floatDur = battleSpeedRef.current === 2 ? 950 : 1450;
      floatsRef.current = floatsRef.current.filter((fl) => now - fl.createdAt < floatDur);
      for (const fl of floatsRef.current) {
        const elapsed = now - fl.createdAt;
        if (elapsed < 0) continue;
        const unit = battle.units.find((u) => u.uid === fl.uid);
        if (!unit) continue;
        const pos = getUnitCoords(unit, w, h);
        const p = Math.min(1, elapsed / floatDur);
        // Classic HXSG upward pop + gentle settle
        const bounce = p < 0.25 ? Math.sin((p / 0.25) * Math.PI * 0.5) * 20 : 20 + (p - 0.25) * 18;
        const baseY = pos.y - Math.round(36 * spriteScale) - bounce;

        ctx.save();
        ctx.globalAlpha = p > 0.72 ? 1 - (p - 0.72) / 0.28 : 1;

        if (fl.kind === 'damage' && fl.value !== undefined) {
          const numImg = getImg('num.png');
          const digitH = fl.crit ? 22 : 18;
          if (numImg) {
            drawPixelDigits(numImg, NUM_GLYPHS_DMG, `-${fl.value}`, pos.x, baseY, digitH);
          } else {
            ctx.font = 'bold 16px "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000';
            ctx.strokeText(`-${fl.value}`, pos.x, baseY);
            ctx.fillStyle = fl.color;
            ctx.fillText(`-${fl.value}`, pos.x, baseY);
          }
          if (fl.crit || fl.subText) {
            const extra = [fl.crit ? '暴击!' : '', fl.subText ?? ''].filter(Boolean).join(' ');
            ctx.font = 'bold 11px "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000';
            ctx.strokeText(extra, pos.x, baseY - digitH - 3);
            ctx.fillStyle = '#ffe966';
            ctx.fillText(extra, pos.x, baseY - digitH - 3);
          }
        } else if (fl.kind === 'heal' && fl.value !== undefined) {
          const num2Img = getImg('num2.png');
          const digitH = 18;
          if (num2Img) {
            drawPixelDigits(num2Img, NUM_GLYPHS_HEAL, `${fl.value}`, pos.x, baseY, digitH);
          } else {
            ctx.font = 'bold 16px "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000';
            ctx.strokeText(`+${fl.value}`, pos.x, baseY);
            ctx.fillStyle = '#76ff88';
            ctx.fillText(`+${fl.value}`, pos.x, baseY);
          }
          if (fl.subText) {
            ctx.font = 'bold 11px "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000';
            ctx.strokeText(fl.subText, pos.x, baseY - digitH - 3);
            ctx.fillStyle = '#ffe966';
            ctx.fillText(fl.subText, pos.x, baseY - digitH - 3);
          }
        } else if (fl.kind === 'miss') {
          const wzImg = getImg('wz.png');
          if (wzImg) {
            const mw = Math.round(wzImg.width * 1.5);
            const mh = Math.round(wzImg.height * 1.5);
            ctx.drawImage(wzImg, Math.round(pos.x - mw / 2), Math.round(baseY - mh), mw, mh);
          } else {
            ctx.font = 'bold 13px "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#000';
            ctx.strokeText('未中', pos.x, baseY);
            ctx.fillStyle = '#ffe46b';
            ctx.fillText('未中', pos.x, baseY);
          }
        } else if (fl.text) {
          ctx.font = 'bold 13px "PingFang SC", "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'center';
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#000';
          ctx.strokeText(fl.text, pos.x, baseY);
          ctx.fillStyle = fl.color;
          ctx.fillText(fl.text, pos.x, baseY);
        }
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [battle, selectedTargetUid, activeUnit]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;
    const { w, h } = sizeRef.current;

    let closest: BattleUnit | null = null;
    let bestDist = 56;
    for (const u of aliveEnemies) {
      const pos = getUnitCoords(u, w, h);
      const d = Math.hypot(lx - pos.x, ly - (pos.y - 34));
      if (d < bestDist) {
        bestDist = d;
        closest = u;
      }
    }
    if (closest) setSelectedTargetUid(closest.uid);
  };

  const pendingItem = pendingItemId ? consumables.find((c) => c.itemId === pendingItemId) : null;

  return (
    <div className="flex-1 flex flex-col bg-[#1e2628] overflow-hidden">
      {/* 1. Classic Top Bar */}
      <AssetBg path="tit_bg.png" className="h-[34px] border-b border-[#4c6165] shrink-0">
        <span className="absolute left-2 text-[10px] text-[#cfe3e6] bg-black/45 px-1.5 py-0.5 border border-[#5f7c80]">
          第 {battle.round} 回合
        </span>
        <span className="text-[16px] font-bold text-white hx-stroke">{battle.mapName}</span>
      </AssetBg>

      <AssetBg path="fig_tit.png" className="h-[30px] border-b border-black shrink-0">
        <div className="w-full px-3 flex items-center justify-between">
          <span className="text-[14px] font-bold text-[#ff6b6b] hx-stroke">
            {battle.enemyGroupName}
          </span>
          <span className="text-[13px] font-bold text-[#9be0ff] hx-stroke">
            第{battle.round}回合 · 对阵
          </span>
          <span className="text-[14px] font-bold text-[#ffdf70] hx-stroke">{character.name}</span>
        </div>
      </AssetBg>

      {/* 2. Pixel Battlefield Canvas + Staggered Golden Diamond Buttons */}
      <div className="relative flex-1 min-h-[260px] bg-[#bca96b] overflow-hidden flex flex-col">
        <div ref={stageRef} className="relative flex-1 w-full min-h-0">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-full h-full block cursor-crosshair"
          />

          {/* Classic 6 Staggered Golden Diamond Command Buttons (3x2) */}
          {battle.status === 'ongoing' && (
            <div
              className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                isReplaying ? 'opacity-25' : 'opacity-100'
              }`}
            >
              <div className="pointer-events-auto flex items-start">
                <div className="flex flex-col -space-y-0.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void dispatchCommand({ action: 'attack' })}
                    className="hx-diamond-btn primary"
                    title="普通攻击 (快捷键 1)"
                  >
                    <span>攻击</span>
                  </button>
                  {isCommandingHero ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void dispatchCommand({ action: 'capture' })}
                      className="hx-diamond-btn"
                      title="尝试招降残血敌人为副将 (快捷键 3)"
                    >
                      <span>招降</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void skipGeneralToAI()}
                      className="hx-diamond-btn"
                      title="本回合由该副将智能 AI 出手 (快捷键 3)"
                    >
                      <span>智能</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void dispatchCommand({ action: 'defend' })}
                    className="hx-diamond-btn"
                    title="本回合防御减伤 50% (快捷键 7)"
                  >
                    <span>防御</span>
                  </button>
                </div>
                <div className="flex flex-col -space-y-0.5 -ml-2 mt-5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setSubMenu((m) => (m === 'skill' ? 'none' : 'skill'))}
                    className={`hx-diamond-btn ${subMenu === 'skill' ? 'active' : ''}`}
                    title="施放技能 (快捷键 2)"
                  >
                    <span>技能</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setPendingItemId(null);
                      setSubMenu((m) => (m === 'item' ? 'none' : 'item'));
                    }}
                    className={`hx-diamond-btn ${subMenu === 'item' ? 'active' : ''}`}
                    title="使用丹药/给队友喂药/还魂丹复活 (快捷键 4)"
                  >
                    <span>物品</span>
                  </button>
                  {isCommandingHero ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void dispatchCommand({ action: 'flee' })}
                      className="hx-diamond-btn"
                      title="脱离战斗 (快捷键 6)"
                    >
                      <span>逃跑</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={stepBack}
                      className="hx-diamond-btn"
                      title="返回重选上一位单位指令"
                    >
                      <span>重选</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Playback Speed Toggle (1x / 2x) at bottom-center of stage */}
          {battle.status === 'ongoing' && subMenu === 'none' && (
            <div className="pointer-events-none absolute left-0 right-0 bottom-1.5 flex justify-center z-10">
              <div className="pointer-events-auto inline-flex border border-[#d6aa49] bg-[#1a0921]/85 shadow overflow-hidden">
                <button
                  type="button"
                  onClick={() => setBattleSpeed(1)}
                  className={`px-2.5 py-0.5 text-[11px] font-bold transition ${
                    battleSpeed === 1
                      ? 'bg-[#b8730b] text-[#fff8cc]'
                      : 'text-[#d8c2de] hover:text-white'
                  }`}
                  title="标准倍速播放战斗动画"
                >
                  ×1
                </button>
                <button
                  type="button"
                  onClick={() => setBattleSpeed(2)}
                  className={`px-2.5 py-0.5 text-[11px] font-bold border-l border-[#7a5822] transition ${
                    battleSpeed === 2
                      ? 'bg-[#b8730b] text-[#fff8cc]'
                      : 'text-[#d8c2de] hover:text-white'
                  }`}
                  title="二倍速快进战斗动画"
                >
                  ×2
                </button>
              </div>
            </div>
          )}

          {/* Skill / Item / Protect / Summon Popover Tray */}
          {subMenu !== 'none' && battle.status === 'ongoing' && (
            <div className="absolute left-2 right-2 bottom-2 z-20 bg-[#25092c]/95 border-2 border-[#e2b94e] p-2 shadow-xl max-h-[205px] overflow-y-auto hx-scroll">
              <div className="flex items-center justify-between text-xs text-[#ffe273] font-bold mb-1.5 pb-1 border-b border-white/15">
                <span>
                  {subMenu === 'skill' &&
                    `${isCommandingHero ? '主角' : `副将 ${activeUnit?.name ?? ''}`} · 选择技能（精力 ${activeUnit?.mp ?? character.mp}）`}
                  {subMenu === 'item' &&
                    (pendingItem
                      ? `为哪位友军使用【${pendingItem.name}】？`
                      : `${isCommandingHero ? '主角' : `副将 ${activeUnit?.name ?? ''}`} · 选择丹药（可喂队友/复活）`)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSubMenu('none');
                    setPendingItemId(null);
                  }}
                  className="text-white hover:text-[#ffe273]"
                >
                  关闭 ✕
                </button>
              </div>

              {subMenu === 'skill' && (
                <div className="grid grid-cols-2 gap-1.5">
                  {activeSkills.map((sk, idx) => {
                    const prog = isCommandingHero
                      ? character.skills.find((s) => s.skillId === sk.id)
                      : undefined;
                    const unitMp = activeUnit?.mp ?? character.mp;
                    const lackMp = unitMp < sk.mpCost;
                    return (
                      <button
                        key={sk.id}
                        type="button"
                        disabled={lackMp}
                        onClick={() => void dispatchCommand({ action: 'skill', skillId: sk.id })}
                        className={`p-2 border text-left ${
                          lackMp
                            ? 'bg-[#2c1530] border-[#6b5270] opacity-55 cursor-not-allowed'
                            : 'bg-[#44154f] hover:bg-[#5f1d6e] border-[#c5963d]'
                        }`}
                      >
                        <div className="flex justify-between text-xs font-bold text-[#ffea84]">
                          <span>
                            {sk.name}
                            {prog
                              ? `(${prog.tier}阶)`
                              : !isCommandingHero
                                ? idx === 0
                                  ? '(自带)'
                                  : '(秘籍)'
                                : ''}
                          </span>
                          <span className={lackMp ? 'text-[#ff8585]' : 'text-[#85c6ff]'}>
                            耗精{sk.mpCost}
                          </span>
                        </div>
                        <div className="text-[10.5px] text-[#e7d0ef] truncate mt-0.5">
                          {prog ? `熟练${prog.proficiency} · ` : ''}
                          {sk.desc}
                        </div>
                      </button>
                    );
                  })}
                  {activeSkills.length === 0 && (
                    <div className="col-span-2 text-xs text-center text-[#ebd8f0] py-2">
                      该副将暂无可用技能
                    </div>
                  )}
                </div>
              )}

              {subMenu === 'item' && !pendingItem && (
                <div className="grid grid-cols-2 gap-1.5">
                  {consumables.map((it) => (
                    <button
                      key={it.itemId}
                      type="button"
                      onClick={() => setPendingItemId(it.itemId)}
                      className="p-2 bg-[#44154f] hover:bg-[#5f1d6e] border border-[#c5963d] text-left"
                    >
                      <div className="flex justify-between text-xs font-bold text-[#ffea84]">
                        <span>{it.name}</span>
                        <span>×{it.quantity}</span>
                      </div>
                      <div className="text-[11px] text-[#f0dff5] truncate mt-0.5">{it.desc}</div>
                    </button>
                  ))}
                  {consumables.length === 0 && (
                    <div className="col-span-2 text-xs text-center text-[#ebd8f0] py-2">
                      背包里没有可用丹药（可在回春药铺购买金创药/还魂丹）
                    </div>
                  )}
                </div>
              )}

              {subMenu === 'item' && pendingItem && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-1.5">
                    {(pendingItem.reviveHpPct ? deadAlliedGenerals : aliveAllies).map((u) => (
                      <button
                        key={u.uid}
                        type="button"
                        onClick={() =>
                          void dispatchCommand({
                            action: 'item',
                            itemId: pendingItem.itemId,
                            targetUid: u.uid,
                          })
                        }
                        className="p-1.5 bg-[#3c1447] hover:bg-[#591f69] border border-[#d6a742] text-left text-xs"
                      >
                        <div className="font-bold text-[#ffea84]">
                          {u.isMainRole ? `【主角】${u.name}` : u.name}
                        </div>
                        <div className="text-[10.5px] text-[#e7d0ef]">
                          {u.alive ? `血 ${u.hp}/${u.maxHp} · 精 ${u.mp}/${u.maxMp}` : '已阵亡（点击复活）'}
                        </div>
                      </button>
                    ))}
                  </div>
                  {pendingItem.reviveHpPct && deadAlliedGenerals.length === 0 && (
                    <div className="text-xs text-center text-[#f0d8f5] py-2">
                      当前没有倒地的副将需要复活
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingItemId(null)}
                    className="text-[11px] text-[#9be0ff] hover:underline"
                  >
                    ← 重选丹药
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Latest Combat Log Banner */}
        {battle.lastLogs.length > 0 && battle.status === 'ongoing' && (
          <div className="px-2 py-1 bg-black/80 text-[12px] text-[#fff0a6] truncate">
            {battle.lastLogs[battle.lastLogs.length - 1].message}
          </div>
        )}

        {/* Bottom Countdown Bar + General Toggle + Repeat Last Round + Full Auto */}
        <div className="h-[34px] px-1.5 bg-[#3d481e] border-t border-[#222910] flex items-center justify-between gap-1 shrink-0">
          <button
            type="button"
            onClick={toggleAutoGenerals}
            className={`px-1.5 py-0.5 text-[10.5px] font-bold border shrink-0 ${
              autoGenerals
                ? 'bg-[#2a3319] border-[#869b5a] text-[#d4e8a8]'
                : 'bg-[#6e247c] border-[#f2c95b] text-[#ffe985]'
            }`}
            title="切换副将手动选技能 / 自动 AI 出手"
          >
            {autoGenerals ? '副将:自动' : '副将:手动'}
          </button>
          <div className="px-2 py-0.5 bg-[#191e1f] border border-[#92a3a5] text-[11.5px] font-bold text-white hx-stroke truncate">
            {activeUnit
              ? `${isCommandingHero ? '主' : '将'}·${activeUnit.name}${
                  controllableUnits.length > 1 ? `(${stepIdx + 1}/${controllableUnits.length})` : ''
                } (${countdown}s)`
              : `${character.name}(${countdown}s)`}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {lastRoundCmd && (
              <button
                type="button"
                disabled={busy}
                onClick={repeatLastRound}
                className="hx-btn-gold px-1.5 py-0.5 text-[11px] disabled:opacity-50"
                title="重复上一回合的出招指令"
              >
                重复
              </button>
            )}
            <button
              type="button"
              onClick={() => setAutoBattle((v) => !v)}
              className={`hx-btn-red px-2 py-0.5 text-[11px] ${
                autoBattle ? 'ring-2 ring-[#ffe96e]' : ''
              }`}
            >
              {autoBattle ? '自动中' : '自动'}
            </button>
          </div>
        </div>

        {/* Victory / Defeat / Fled Overlay */}
        {battle.status !== 'ongoing' && (
          <div className="absolute inset-0 z-30 bg-black/78 flex flex-col items-center justify-center p-4 gap-3">
            {battle.status === 'victory' && (
              <AssetImg
                path="f_sl.png"
                alt="胜利"
                className="w-[240px] h-auto pixelated drop-shadow-[0_4px_12px_#000]"
              />
            )}
            {battle.status === 'defeat' && (
              <AssetImg
                path="f_bb.png"
                alt="败北"
                className="w-[240px] h-auto pixelated drop-shadow-[0_4px_12px_#000]"
              />
            )}
            {battle.status === 'fled' && (
              <div className="text-2xl font-black text-[#ffe46e] hx-stroke">成功脱身！</div>
            )}

            <div className="w-full max-w-[300px] bg-[#260a2c]/95 border-2 border-[#e0b84e] p-3 text-xs space-y-1.5 text-center">
              {battle.rewards ? (
                <>
                  <div className="text-[#ffe47a] font-bold text-sm">
                    获得经验 +{battle.rewards.exp} · 银两 +{battle.rewards.silver}
                  </div>
                  {battle.rewards.leveledUp && (
                    <div className="text-[#7dff8c] font-bold">
                      恭喜升级！当前等级 Lv.{battle.rewards.newLevel}（血蓝已全满）
                    </div>
                  )}
                  {battle.rewards.droppedItem && (
                    <div className="text-[#9ee0ff]">
                      战利品：【{battle.rewards.droppedItem.name}】×
                      {battle.rewards.droppedItem.quantity}
                    </div>
                  )}
                  {battle.rewards.droppedEquipment && (
                    <div
                      className={`font-bold ${
                        battle.rewards.droppedEquipment.quality === 'legend'
                          ? 'text-[#ffb84d]'
                          : battle.rewards.droppedEquipment.quality === 'rare'
                            ? 'text-[#78c8ff]'
                            : battle.rewards.droppedEquipment.quality === 'fine'
                              ? 'text-[#7dff92]'
                              : 'text-white'
                      }`}
                    >
                      爆出装备：【{battle.rewards.droppedEquipment.name}】（已入行囊）
                    </div>
                  )}
                  {battle.rewards.capturedGeneral && (
                    <div className="text-[#ffcf54] font-bold">
                      成功招降副将：【{battle.rewards.capturedGeneral.name}】（成长{' '}
                      {battle.rewards.capturedGeneral.growth}）
                    </div>
                  )}
                  {battle.rewards.questUpdates && battle.rewards.questUpdates.length > 0 && (
                    <div className="pt-1 mt-1 border-t border-white/15 space-y-0.5">
                      {battle.rewards.questUpdates.map((msg, i) => (
                        <div key={i} className="text-[#8cff9c] font-bold">
                          📜 {msg}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[#f3e4f7]">
                  {battle.status === 'defeat'
                    ? '胜败乃兵家常事，已为你保留部分气血，快回客栈休整吧！'
                    : '已安全返回地图。'}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onExitBattle}
              className="hx-btn-gold px-7 py-1.5 text-sm"
            >
              返回地图
            </button>
          </div>
        )}
      </div>

      {/* 3. Persistent Chat Dock */}
      <ChatDock messages={messages} onSend={onSendChat} compact />
    </div>
  );
}
