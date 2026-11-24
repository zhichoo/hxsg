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
  action: 'attack' | 'skill' | 'defend' | 'protect' | 'item';
  targetUid?: string;
  skillId?: string;
  itemId?: string;
}

interface HeroCommandInput {
  action: 'attack' | 'skill' | 'defend' | 'protect' | 'summon' | 'item' | 'capture' | 'flee';
  targetUid?: string;
  skillId?: string;
  itemId?: string;
  summonGeneralId?: number;
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
  text: string;
  color: string;
  createdAt: number;
}

interface ActiveFx {
  uid: string;
  effect:
    | 'lei'
    | 'fire'
    | 'fg'
    | 'slash'
    | 'heal'
    | 'chaos'
    | 'seal'
    | 'trap'
    | 'poison'
    | 'buff_atk'
    | 'buff_spd'
    | 'revive';
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
];

type SpriteFrame = readonly [number, number, number, number];

// Exact pixel-verified frame rectangles from official HXSG PNG sprite sheets
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
  // 4-frame golden light pillar for heal / buff (fg2.png 104x28)
  goldLight: [
    [0, 0, 26, 28],
    [26, 0, 26, 28],
    [52, 0, 26, 28],
    [78, 0, 26, 28],
  ] as readonly SpriteFrame[],
  // 4-frame purple magic aura for control / poison (fg3.png 166x33)
  purpleAura: [
    [0, 0, 40, 33],
    [40, 0, 38, 33],
    [78, 0, 47, 33],
    [125, 0, 41, 33],
  ] as readonly SpriteFrame[],
  // 3-frame ice-blue energy wave for 排山倒海 / 疾风咒 / 破甲 (pi_fl.png 86x35)
  blueWave: [
    [0, 0, 30, 35],
    [30, 0, 32, 35],
    [62, 0, 24, 35],
  ] as readonly SpriteFrame[],
  // 4-frame luminous spirit flame for revive / summon (dead_fl.png 111x43)
  spiritFlame: [
    [0, 0, 31, 43],
    [31, 0, 30, 43],
    [61, 0, 32, 43],
    [93, 0, 18, 43],
  ] as readonly SpriteFrame[],
  // 2-frame red hit blood splash (blood.png 38x22)
  blood: [
    [0, 0, 22, 22],
    [22, 0, 16, 22],
  ] as readonly SpriteFrame[],
  // 3-frame dash dust puff (smoke.png 60x12)
  smoke: [
    [0, 0, 20, 12],
    [21, 0, 19, 12],
    [40, 0, 20, 12],
  ] as readonly SpriteFrame[],
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
  const [subMenu, setSubMenu] = useState<'none' | 'skill' | 'item' | 'protect' | 'summon'>('none');
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [autoBattle, setAutoBattle] = useState(false);
  const [autoGenerals, setAutoGenerals] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [queuedHeroCmd, setQueuedHeroCmd] = useState<HeroCommandInput | null>(null);
  const [queuedGeneralCmds, setQueuedGeneralCmds] = useState<GeneralCommandInput[]>([]);
  const [lastRoundCmd, setLastRoundCmd] = useState<{
    hero: HeroCommandInput;
    generals: GeneralCommandInput[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(30);

  const fxRef = useRef<ActiveFx[]>([]);
  const floatsRef = useRef<FloatingNum[]>([]);
  const calloutsRef = useRef<SkillCallout[]>([]);
  const hurtRef = useRef<Map<string, number>>(new Map());
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
  const benchGenerals = useMemo(() => {
    const inBattleIds = new Set(
      battle.units.filter((u) => u.side === 'player' && u.generalId).map((u) => u.generalId!),
    );
    return character.generals.filter((g) => !inBattleIds.has(g.id));
  }, [battle.units, character.generals]);

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

  // Trigger authentic sequential pixel VFX, hit shake, caster skill banners & floating numbers
  useEffect(() => {
    if (!battle.lastLogs.length) return;
    const now = performance.now();
    battle.lastLogs.forEach((log: BattleActionLog, idx: number) => {
      const delay = idx * 380;
      lungeRef.current.set(log.actorUid, now + delay);

      if (log.skillName) {
        const callColor =
          log.effect === 'lei'
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
          startedAt: now + delay,
          duration: 780,
        });
      } else if (log.action === 'summon') {
        calloutsRef.current.push({
          uid: log.actorUid,
          label: '【招将上阵】',
          color: '#ffe875',
          startedAt: now + delay,
          duration: 780,
        });
      } else if (log.action === 'protect') {
        calloutsRef.current.push({
          uid: log.actorUid,
          label: '【护卫】',
          color: '#8ce6ff',
          startedAt: now + delay,
          duration: 700,
        });
      }

      for (const t of log.targets) {
        if (t.damage > 0) {
          hurtRef.current.set(t.uid, now + delay + 90);
        }
        let fxType: ActiveFx['effect'] | null = log.effect ?? null;
        if (t.revived) fxType = 'revive';
        else if (t.appliedStatus === 'poison' || log.skillId === 'wudu') fxType = 'poison';
        else if (t.appliedStatus === 'atk_up') fxType = 'buff_atk';
        else if (t.appliedStatus === 'spd_up') fxType = 'buff_spd';
        if (fxType) {
          fxRef.current.push({
            uid: t.uid,
            effect: fxType,
            startedAt: now + delay + 60,
            duration: fxType === 'slash' ? 380 : 540,
          });
        }

        if (t.revived) {
          floatsRef.current.push({
            uid: t.uid,
            text: t.heal ? `复活 +${t.heal}` : '上阵!',
            color: '#ffe966',
            createdAt: now + delay + 80,
          });
        } else if (t.heal && t.heal > 0) {
          floatsRef.current.push({
            uid: t.uid,
            text: `+${t.heal}`,
            color: '#76ff88',
            createdAt: now + delay + 80,
          });
        } else if (t.appliedStatus) {
          const stMap: Record<BattleStatusKind, { text: string; color: string }> = {
            chaos: { text: '混乱!', color: '#ff7cf0' },
            seal: { text: '封印!', color: '#7ce2ff' },
            trap: { text: '围困!', color: '#ffd26b' },
            poison: { text: '中毒!', color: '#7dff7a' },
            atk_up: { text: '攻↑', color: '#ff8a5c' },
            spd_up: { text: '速↑', color: '#70f3ff' },
            def_down: { text: '破甲!', color: '#ffb35c' },
          };
          const stInfo = stMap[t.appliedStatus];
          if (t.damage > 0) {
            floatsRef.current.push({
              uid: t.uid,
              text: `${t.crit ? '暴 ' : ''}-${t.damage} ${stInfo.text}`,
              color: '#ffea4f',
              createdAt: now + delay + 80,
            });
          } else {
            floatsRef.current.push({
              uid: t.uid,
              text: stInfo.text,
              color: stInfo.color,
              createdAt: now + delay + 80,
            });
          }
        } else if (t.resisted) {
          floatsRef.current.push({
            uid: t.uid,
            text: '抵抗',
            color: '#d9e3ff',
            createdAt: now + delay + 80,
          });
        } else if (t.captured) {
          floatsRef.current.push({
            uid: t.uid,
            text: '招降成功!',
            color: '#ffe863',
            createdAt: now + delay + 80,
          });
        } else if (t.damage > 0) {
          floatsRef.current.push({
            uid: t.uid,
            text: `${t.crit ? '暴击 ' : ''}-${t.damage}`,
            color: t.crit ? '#ffea4f' : '#ff4b4b',
            createdAt: now + delay + 80,
          });
        }
      }
    });
  }, [battle.lastLogs, battle.round]);

  const submitRound = useCallback(
    async (heroCmd: HeroCommandInput, generalCmds: GeneralCommandInput[]) => {
      if (busy || battle.status !== 'ongoing') return;
      setBusy(true);
      setSubMenu('none');
      setPendingItemId(null);
      if (heroCmd.action !== 'flee' && heroCmd.action !== 'summon') {
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
        cmd.action === 'skill' ||
        cmd.action === 'defend' ||
        cmd.action === 'protect' ||
        cmd.action === 'item'
          ? cmd.action
          : 'attack';
      const nextGeneralCmds: GeneralCommandInput[] = [
        ...queuedGeneralCmds.filter((c) => c.unitUid !== activeUnit.uid),
        {
          unitUid: activeUnit.uid,
          action: gAction,
          targetUid:
            gAction === 'item' || gAction === 'protect'
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

  // Auto-battle repeats last chosen hero command (or attacks)
  useEffect(() => {
    if (!autoBattle || battle.status !== 'ongoing' || busy) return;
    const t = setTimeout(() => {
      const heroCmd =
        lastRoundCmd?.hero && lastRoundCmd.hero.action !== 'item'
          ? { ...lastRoundCmd.hero, targetUid: selectedTargetUid }
          : ({ action: 'attack', targetUid: selectedTargetUid } as HeroCommandInput);
      void submitRound(heroCmd, []);
    }, 1050);
    return () => clearTimeout(t);
  }, [autoBattle, battle.status, battle.round, busy, submitRound, selectedTargetUid, lastRoundCmd]);

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
      } else if (e.key === '5') {
        setSubMenu((m) => (m === 'protect' ? 'none' : 'protect'));
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
        ctx.drawImage(topL, 0, 0, w / 2, topH);
        ctx.drawImage(topR, w / 2, 0, w / 2, topH);
      } else {
        ctx.fillStyle = '#4f6d31';
        ctx.fillRect(0, 0, w, topH);
      }

      const btmL = getImg(`${bgPrefix}_3.png`);
      const btmR = getImg(`${bgPrefix}_4.png`);
      if (btmL && btmR) {
        ctx.drawImage(btmL, 0, h - btmH, w / 2, btmH);
        ctx.drawImage(btmR, w / 2, h - btmH, w / 2, btmH);
      } else {
        ctx.fillStyle = '#5c6b2d';
        ctx.fillRect(0, h - btmH, w, btmH);
      }

      const bush1 = getImg('f_bg_c.png');
      const bush2 = getImg('f_bg_c2.png');
      if (bush1) ctx.drawImage(bush1, Math.round(w * 0.54), Math.round(topH - 12), 31, 27);
      if (bush2) ctx.drawImage(bush2, Math.round(w * 0.68), Math.round(h * 0.72), 29, 20);

      const desiredScale = h < 270 ? 1.5 : 2;
      const physScale = Math.max(2, Math.round(desiredScale * dpr));
      const spriteScale = physScale / dpr;
      const fxZoom = spriteScale / 1.5;
      const arrowImg = getImg('f_jt.png');
      const deadImg = getImg('dead_1.png');

      // 2. Units (alive + fallen allied generals ghost marker so player knows they can revive!)
      for (const u of battle.units) {
        const pos = getUnitCoords(u, w, h);
        if (!u.alive) {
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

        const lungeAt = lungeRef.current.get(u.uid) ?? 0;
        const lungeElapsed = now - lungeAt;
        const isAttacking = lungeElapsed >= 0 && lungeElapsed < 340;
        const lungeShift = isAttacking
          ? Math.sin((lungeElapsed / 340) * Math.PI) * (u.side === 'player' ? -30 : 30)
          : 0;

        const hurtAt = hurtRef.current.get(u.uid) ?? 0;
        const hurtElapsed = now - hurtAt;
        const isHurt = hurtElapsed >= 0 && hurtElapsed < 220;
        const hurtShake = isHurt ? Math.sin(hurtElapsed * 0.16) * 4 : 0;

        const bob = Math.sin(now / 280 + pos.x) > 0 ? 1 : 0;
        const ux = Math.round(pos.x + lungeShift + hurtShake);
        const uy = Math.round(pos.y);

        // Dash dust puff at feet when lunging forward
        if (isAttacking && lungeElapsed < 220) {
          const smoke = getImg('smoke.png');
          if (smoke) {
            const sIdx = Math.min(2, Math.floor((lungeElapsed / 220) * 3));
            const [sx, sy, sw, sh] = SPRITE_FRAMES.smoke[sIdx];
            const dustX = u.side === 'player' ? pos.x + 8 : pos.x - 28;
            ctx.drawImage(smoke, sx, sy, sw, sh, Math.round(dustX), Math.round(uy - 10), Math.round(sw * 1.2), Math.round(sh * 1.2));
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

        ctx.save();
        ctx.translate(ux, uy);
        if (u.side === 'player') ctx.scale(-1, 1);

        if (legs) {
          const half = Math.floor(legs.width / 2);
          const sx = isAttacking ? half : 0;
          const sw = isAttacking ? legs.width - half : half;
          const dw = sw * spriteScale;
          const dh = legs.height * spriteScale;
          ctx.drawImage(legs, sx, 0, sw, legs.height, -dw / 2, -dh, dw, dh);
        }
        if (body) {
          const idleW = Math.round(body.width * 0.42);
          const sx = isAttacking ? idleW : 0;
          const sw = isAttacking ? body.width - idleW : idleW;
          const dw = sw * spriteScale;
          const dh = body.height * spriteScale;
          ctx.drawImage(
            body,
            sx,
            0,
            sw,
            body.height,
            -dw / 2,
            -(body.height + 6) * spriteScale + bob,
            dw,
            dh,
          );
        }
        if (head) {
          const dw = head.width * spriteScale;
          const dh = head.height * spriteScale;
          ctx.drawImage(
            head,
            0,
            0,
            head.width,
            head.height,
            -dw / 2,
            -(head.height + 16) * spriteScale + bob,
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

      // 3. Authentic Official Pixel-Sprite Skill VFX (zero crude canvas shapes!)
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
        const dw = Math.round(sw * scale);
        const dh = Math.round(sh * scale);
        ctx.drawImage(img, sx, sy, sw, sh, Math.round(cx - dw / 2), Math.round(bottomY - dh), dw, dh);
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

        if (fx.effect === 'lei') {
          // Official 3-frame thunderbolt f_sd.png striking down onto the target
          const sd = getImg('f_sd.png');
          drawSheetFrame(sd, SPRITE_FRAMES.thunder, t, pos.x, pos.y + 4, 1.55 * fxZoom);
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
          // Physical attack / 连环突刺 / 破甲重击: cropped blue starburst fg.png + 2-frame blood.png
          const fg = getImg('fg.png');
          const blood = getImg('blood.png');
          if (fg && t < 0.75) {
            const sc = (0.58 + Math.sin((t / 0.75) * Math.PI) * 0.35) * fxZoom;
            drawSheetFrame(fg, SPRITE_FRAMES.starburst, 0, pos.x, pos.y + 2, sc);
          }
          if (blood && t >= 0.15) {
            drawSheetFrame(
              blood,
              SPRITE_FRAMES.blood,
              (t - 0.15) / 0.85,
              pos.x,
              pos.y - 10 * fxZoom,
              1.55 * fxZoom,
            );
          }
        } else if (fx.effect === 'heal' || fx.effect === 'buff_atk') {
          // 妙手回春 / 吃药 / 魔神附体: official 4-frame golden light pillar fg2.png
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
          // 离间计 / 定身计 / 画地为牢 / 五毒攻心: official 4-frame purple magic aura fg3.png
          const fg3 = getImg('fg3.png');
          drawSheetFrame(fg3, SPRITE_FRAMES.purpleAura, t, pos.x, pos.y + 4, 1.65 * fxZoom);
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
        const by = Math.max(6, pos.y - 78 - rise);
        ctx.fillStyle = 'rgba(26, 6, 32, 0.88)';
        ctx.fillRect(bx, by, tw + 10, 18);
        ctx.strokeStyle = co.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx, by, tw + 10, 18);
        ctx.fillStyle = co.color;
        ctx.fillText(co.label, bx + (tw + 10) / 2, by + 13);
        ctx.restore();
      }

      // 4. Floating damage / heal numbers
      floatsRef.current = floatsRef.current.filter((fl) => now - fl.createdAt < 1200);
      for (const fl of floatsRef.current) {
        const elapsed = now - fl.createdAt;
        if (elapsed < 0) continue;
        const unit = battle.units.find((u) => u.uid === fl.uid);
        if (!unit) continue;
        const pos = getUnitCoords(unit, w, h);
        const dy = (elapsed / 1200) * 34;
        ctx.font = 'bold 15px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000';
        ctx.strokeText(fl.text, pos.x, pos.y - 62 - dy);
        ctx.fillStyle = fl.color;
        ctx.fillText(fl.text, pos.x, pos.y - 62 - dy);
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
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
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

          {/* Subtle Secondary Tactical Pills (保护 / 招将) tucked at bottom-center out of the way */}
          {battle.status === 'ongoing' && subMenu === 'none' && (
            <div className="pointer-events-none absolute left-0 right-0 bottom-1.5 flex justify-center gap-1.5 z-10">
              {aliveAllies.length > 1 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSubMenu('protect')}
                  className="pointer-events-auto px-2 py-0.5 text-[10.5px] font-bold bg-[#1c2b3d]/85 hover:bg-[#27405c] border border-[#7ec8ff]/80 text-[#dff4ff] shadow"
                  title="保护指定友军分担伤害 (快捷键 5)"
                >
                  🛡 保护
                </button>
              )}
              {isCommandingHero && benchGenerals.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSubMenu('summon')}
                  className="pointer-events-auto px-2 py-0.5 text-[10.5px] font-bold bg-[#381442]/85 hover:bg-[#521e61] border border-[#e0b84e]/85 text-[#ffe999] shadow"
                  title="召唤营中备用副将替补上阵"
                >
                  🚩 招将
                </button>
              )}
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
                  {subMenu === 'protect' && `选择要保护的友军（本回合替其承伤）`}
                  {subMenu === 'summon' && `选择营中备用副将披挂上阵`}
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

              {subMenu === 'protect' && (
                <div className="grid grid-cols-2 gap-1.5">
                  {aliveAllies
                    .filter((u) => u.uid !== activeUnit?.uid)
                    .map((u) => (
                      <button
                        key={u.uid}
                        type="button"
                        onClick={() =>
                          void dispatchCommand({ action: 'protect', targetUid: u.uid })
                        }
                        className="p-2 bg-[#203857] hover:bg-[#2c4e7a] border border-[#7ec8ff] text-left text-xs"
                      >
                        <div className="font-bold text-[#dff4ff]">
                          🛡 保护 {u.isMainRole ? `【主角】${u.name}` : u.name}
                        </div>
                        <div className="text-[10.5px] text-[#bfe2ff]">
                          当前血量 {u.hp}/{u.maxHp}
                        </div>
                      </button>
                    ))}
                  {aliveAllies.filter((u) => u.uid !== activeUnit?.uid).length === 0 && (
                    <div className="col-span-2 text-xs text-center text-[#ebd8f0] py-2">
                      场上暂无其他存活友军可保护
                    </div>
                  )}
                </div>
              )}

              {subMenu === 'summon' && (
                <div className="space-y-1.5">
                  {aliveAllies.filter((u) => !u.isMainRole).length >= 3 ? (
                    <div className="text-xs text-center text-[#ffd88a] py-2">
                      当前阵上已有 3 名存活副将，需待有空位或副将阵亡后才可召唤替补。
                    </div>
                  ) : benchGenerals.length === 0 ? (
                    <div className="text-xs text-center text-[#ebd8f0] py-2">
                      营中暂无未上阵的备用副将
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      {benchGenerals.map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() =>
                            void dispatchCommand({ action: 'summon', summonGeneralId: g.id })
                          }
                          className="p-1.5 bg-[#3c1447] hover:bg-[#5b1d6b] border border-[#d6a742] text-left text-xs"
                        >
                          <div className="font-bold text-[#ffea84]">
                            {g.name} Lv.{g.level}
                          </div>
                          <div className="text-[10.5px] text-[#e7d0ef]">
                            血{g.maxHp} 攻{g.atk} 速{g.spd} · 忠{g.loyalty}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
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
