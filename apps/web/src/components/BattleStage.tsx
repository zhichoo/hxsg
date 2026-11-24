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
  effect: 'lei' | 'fire' | 'fg' | 'slash' | 'heal' | 'chaos' | 'seal' | 'trap' | 'poison' | 'buff_atk' | 'buff_spd' | 'revive';
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

interface ScreenFlash {
  color: string;
  startedAt: number;
  duration: number;
}

const FX_PRELOAD_LIST = [
  'f_sd.png',
  'lei.png',
  'fire.png',
  'fg.png',
  'fg2.png',
  'fg3.png',
  'blood.png',
  'dead_fl.png',
  'dead_1.png',
];

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
      { x: w * 0.13, y: h * 0.42 },
      { x: w * 0.27, y: h * 0.56 },
      { x: w * 0.13, y: h * 0.72 },
      { x: w * 0.27, y: h * 0.84 },
      { x: w * 0.19, y: h * 0.58 },
    ];
    return enemySlots[u.position % enemySlots.length];
  }
  const playerSlots = [
    { x: w * 0.85, y: h * 0.56 },
    { x: w * 0.73, y: h * 0.42 },
    { x: w * 0.73, y: h * 0.72 },
    { x: w * 0.85, y: h * 0.84 },
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
  const flashRef = useRef<ScreenFlash | null>(null);
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

  // Trigger dramatic skill VFX, caster skill banners, screen flashes & floating numbers from round logs
  useEffect(() => {
    if (!battle.lastLogs.length) return;
    const now = performance.now();
    battle.lastLogs.forEach((log: BattleActionLog, idx: number) => {
      const delay = idx * 300;
      lungeRef.current.set(log.actorUid, now + delay);

      if (log.skillName) {
        const callColor =
          log.effect === 'lei'
            ? '#7ef2ff'
            : log.effect === 'fire'
              ? '#ff9d54'
              : log.effect === 'heal'
                ? '#7dff9a'
                : log.effect === 'chaos'
                  ? '#ff85f5'
                  : log.effect === 'seal'
                    ? '#75d6ff'
                    : '#ffe86b';
        calloutsRef.current.push({
          uid: log.actorUid,
          label: `【${log.skillName}】`,
          color: callColor,
          startedAt: now + delay,
          duration: 950,
        });
        if (log.effect === 'lei') {
          flashRef.current = { color: 'rgba(170, 235, 255, 0.34)', startedAt: now + delay, duration: 240 };
        } else if (log.effect === 'fire' && log.skillId !== 'wudu') {
          flashRef.current = { color: 'rgba(255, 110, 35, 0.24)', startedAt: now + delay, duration: 240 };
        } else if (log.effect === 'fg') {
          flashRef.current = { color: 'rgba(255, 224, 90, 0.22)', startedAt: now + delay, duration: 220 };
        }
      } else if (log.action === 'summon') {
        calloutsRef.current.push({
          uid: log.actorUid,
          label: '【招将上阵】',
          color: '#ffe86b',
          startedAt: now + delay,
          duration: 900,
        });
      } else if (log.action === 'protect') {
        calloutsRef.current.push({
          uid: log.actorUid,
          label: '【挺身护卫】',
          color: '#88e2ff',
          startedAt: now + delay,
          duration: 850,
        });
      }

      for (const t of log.targets) {
        let fxType: ActiveFx['effect'] | null = log.effect ?? null;
        if (t.revived) fxType = 'revive';
        else if (t.appliedStatus === 'poison' || log.skillId === 'wudu') fxType = 'poison';
        else if (t.appliedStatus === 'atk_up') fxType = 'buff_atk';
        else if (t.appliedStatus === 'spd_up') fxType = 'buff_spd';
        if (fxType) {
          fxRef.current.push({
            uid: t.uid,
            effect: fxType,
            startedAt: now + delay,
            duration: fxType === 'slash' ? 560 : 820,
          });
        }

        if (t.revived) {
          floatsRef.current.push({
            uid: t.uid,
            text: t.heal ? `复活 +${t.heal}` : '披挂上阵!',
            color: '#ffe966',
            createdAt: now + delay,
          });
        } else if (t.heal && t.heal > 0) {
          floatsRef.current.push({
            uid: t.uid,
            text: `+${t.heal}`,
            color: '#76ff88',
            createdAt: now + delay,
          });
        } else if (t.appliedStatus) {
          const stMap: Record<BattleStatusKind, { text: string; color: string }> = {
            chaos: { text: '混乱!', color: '#ff7cf0' },
            seal: { text: '封印!', color: '#7ce2ff' },
            trap: { text: '围困!', color: '#ffd26b' },
            poison: { text: '中毒!', color: '#7dff7a' },
            atk_up: { text: '攻↑!', color: '#ff8a5c' },
            spd_up: { text: '速↑!', color: '#70f3ff' },
            def_down: { text: '破甲!', color: '#ffb35c' },
          };
          const stInfo = stMap[t.appliedStatus];
          if (t.damage > 0) {
            floatsRef.current.push({
              uid: t.uid,
              text: `${t.crit ? '暴击 ' : ''}-${t.damage} ${stInfo.text}`,
              color: '#ffea4f',
              createdAt: now + delay,
            });
          } else {
            floatsRef.current.push({
              uid: t.uid,
              text: stInfo.text,
              color: stInfo.color,
              createdAt: now + delay,
            });
          }
        } else if (t.resisted) {
          floatsRef.current.push({
            uid: t.uid,
            text: '抵抗',
            color: '#d9e3ff',
            createdAt: now + delay,
          });
        } else if (t.captured) {
          floatsRef.current.push({
            uid: t.uid,
            text: '招降成功!',
            color: '#ffe863',
            createdAt: now + delay,
          });
        } else if (t.damage > 0) {
          floatsRef.current.push({
            uid: t.uid,
            text: `${t.crit ? '暴击 ' : ''}-${t.damage}`,
            color: t.crit ? '#ffea4f' : '#ff4b4b',
            createdAt: now + delay,
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

      const physScale = dpr >= 2 ? Math.max(2, Math.round(1.4 * dpr)) : 1;
      const spriteScale = physScale / dpr;
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
        const isAttacking = lungeElapsed >= 0 && lungeElapsed < 360;
        const lungeShift = isAttacking
          ? Math.sin((lungeElapsed / 360) * Math.PI) * (u.side === 'player' ? -30 : 30)
          : 0;

        const bob = Math.sin(now / 280 + pos.x) > 0 ? 1 : 0;
        const ux = Math.round(pos.x + lungeShift);
        const uy = Math.round(pos.y);

        // Ground shadow
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(ux, uy + 2, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Target / active-unit ground ring
        if (u.uid === selectedTargetUid && u.side === 'enemy') {
          ctx.strokeStyle = '#fff04d';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(ux, uy + 2, 20, 7, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (battle.status === 'ongoing' && activeUnit && u.uid === activeUnit.uid) {
          ctx.strokeStyle = '#5cf2ff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(ux, uy + 2, 21, 7.5, 0, 0, Math.PI * 2);
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
        const charTop = uy - Math.round(39 * spriteScale);
        const barW = 46;
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
        ctx.font = 'bold 11px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        const textW = ctx.measureText(u.name).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
        ctx.fillRect(Math.round(ux - textW / 2 - 4), uy + 4, Math.round(textW + 8), 15);
        ctx.fillStyle = u.side === 'player' ? '#fff394' : '#ffffff';
        ctx.fillText(u.name, ux, uy + 15);

        // All 7 classic status badges above HP bar
        if (u.statuses && u.statuses.length > 0) {
          u.statuses.slice(0, 4).forEach((st, idx) => {
            const meta = STATUS_BADGE[st.kind] ?? { label: '态', bg: '#555' };
            const sx = bx + idx * 16;
            const sy = by - 16;
            ctx.fillStyle = meta.bg;
            ctx.fillRect(sx, sy, 14, 14);
            ctx.strokeStyle = '#ffe97d';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, 14, 14);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9.5px "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.fillText(meta.label, sx + 7, sy + 10.5);
          });
        }

        // Red action pointer arrow next to active unit
        if (battle.status === 'ongoing' && activeUnit && u.uid === activeUnit.uid) {
          const px = ux - Math.round(28 * spriteScale) + Math.sin(now / 180) * 2;
          const py = uy - Math.round(24 * spriteScale);
          if (arrowImg) {
            ctx.drawImage(arrowImg, px, py, 16, 16);
          }
        }
      }

      // 3. Dramatic Full-Spectrum Skill VFX
      fxRef.current = fxRef.current.filter((f) => now - f.startedAt < f.duration);
      for (const fx of fxRef.current) {
        const elapsed = now - fx.startedAt;
        if (elapsed < 0) continue;
        const t = Math.min(1, elapsed / fx.duration);
        const unit = battle.units.find((u) => u.uid === fx.uid);
        if (!unit) continue;
        const pos = getUnitCoords(unit, w, h);

        ctx.save();
        if (fx.effect === 'lei') {
          // Jagged sky lightning bolt + official f_sd.png 3-frame thunder + lei.png sparks
          ctx.globalAlpha = 1 - t * 0.55;
          ctx.strokeStyle = t < 0.35 ? '#ffffff' : '#6cecff';
          ctx.lineWidth = 4 - t * 2;
          ctx.shadowColor = '#3ce0ff';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.moveTo(pos.x + (Math.sin(elapsed * 0.08) * 6), 0);
          ctx.lineTo(pos.x - 10, pos.y * 0.35);
          ctx.lineTo(pos.x + 12, pos.y * 0.62);
          ctx.lineTo(pos.x, pos.y - 16);
          ctx.stroke();

          const sd = getImg('f_sd.png');
          if (sd) {
            const frame = Math.min(2, Math.floor(t * 3));
            const fw = Math.floor(sd.width / 3);
            ctx.drawImage(sd, frame * fw, 0, fw, sd.height, pos.x - 28, pos.y - 115, 56, 118);
          }
          const lei = getImg('lei.png');
          if (lei) {
            ctx.drawImage(lei, pos.x - 24 - t * 10, pos.y - 26, 22, 14);
            ctx.drawImage(lei, pos.x + 4 + t * 10, pos.y - 22, 22, 14);
          }
        } else if (fx.effect === 'fire') {
          // Animated 3-frame fire.png flame pillar + rising glowing embers
          const fire = getImg('fire.png');
          const scale = 1.15 + Math.sin(t * Math.PI) * 0.45;
          ctx.globalAlpha = 1 - t * 0.4;
          if (fire) {
            const frame = Math.min(2, Math.floor(t * 6) % 3);
            const fw = Math.floor(fire.width / 3);
            const dw = 44 * scale;
            const dh = 62 * scale;
            ctx.drawImage(fire, frame * fw, 0, fw, fire.height, pos.x - dw / 2, pos.y - dh + 6, dw, dh);
          }
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2 + t * 4;
            const ex = pos.x + Math.cos(ang) * (12 + t * 18);
            const ey = pos.y - 14 - t * 48 - (i % 3) * 8;
            ctx.fillStyle = i % 2 === 0 ? '#ffe966' : '#ff551a';
            ctx.fillRect(ex - 2, ey - 2, 4, 4);
          }
        } else if (fx.effect === 'poison') {
          // Classic 文人 五毒攻心 toxic green-purple cloud + rising venom bubbles
          ctx.globalAlpha = (1 - t * 0.45) * 0.85;
          const grad = ctx.createRadialGradient(pos.x, pos.y - 24, 4, pos.x, pos.y - 24, 34 + t * 14);
          grad.addColorStop(0, 'rgba(130, 255, 95, 0.85)');
          grad.addColorStop(0.55, 'rgba(35, 165, 55, 0.55)');
          grad.addColorStop(1, 'rgba(70, 15, 110, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y - 24, 34 + t * 14, 0, Math.PI * 2);
          ctx.fill();
          for (let i = 0; i < 6; i++) {
            const bx = pos.x + Math.sin(i * 1.9 + t * 5) * 20;
            const by = pos.y - 8 - t * 46 - (i % 3) * 6;
            ctx.strokeStyle = '#9dff73';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(bx, by, 3 + (i % 3), 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (fx.effect === 'fg') {
          // 排山倒海: golden shockwave ring + fg.png + fg3.png sweeping blast
          ctx.globalAlpha = 1 - t * 0.45;
          const fg = getImg('fg.png');
          const fg3 = getImg('fg3.png');
          const r = 14 + t * 38;
          ctx.strokeStyle = '#ffe56b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(pos.x, pos.y - 16, r, r * 0.45, 0, 0, Math.PI * 2);
          ctx.stroke();
          if (fg) {
            const sc = 0.85 + Math.sin(t * Math.PI) * 0.45;
            ctx.drawImage(fg, pos.x - 36 * sc, pos.y - 68 * sc, 72 * sc, 56 * sc);
          }
          if (fg3) {
            ctx.drawImage(fg3, pos.x - 42, pos.y - 40, 84, 22);
          }
        } else if (fx.effect === 'slash') {
          // Sharp animated dual crescent blade slash + fg2.png + blood.png hit flash
          ctx.globalAlpha = 1 - t * 0.45;
          const fg2 = getImg('fg2.png');
          const blood = getImg('blood.png');
          if (fg2) {
            const frame = Math.min(3, Math.floor(t * 4));
            const fw = Math.floor(fg2.width / 4);
            ctx.drawImage(fg2, frame * fw, 0, fw, fg2.height, pos.x - 26, pos.y - 48, 52, 42);
          }
          const prog = Math.min(1, t * 2.2);
          ctx.strokeStyle = '#fff9c4';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#ffae00';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.moveTo(pos.x - 22, pos.y - 48);
          ctx.lineTo(pos.x - 22 + 44 * prog, pos.y - 48 + 38 * prog);
          ctx.stroke();
          ctx.strokeStyle = '#ff6b3d';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(pos.x + 20, pos.y - 46);
          ctx.lineTo(pos.x + 20 - 40 * prog, pos.y - 46 + 34 * prog);
          ctx.stroke();
          if (blood && t > 0.2) {
            ctx.drawImage(blood, pos.x - 16, pos.y - 34, 32, 18);
          }
        } else if (fx.effect === 'heal' || fx.effect === 'revive') {
          // Radiant green/gold healing beam + rising sparkle crosses
          const isRev = fx.effect === 'revive';
          ctx.globalAlpha = (1 - t * 0.4) * 0.85;
          const grad = ctx.createLinearGradient(pos.x, pos.y - 75, pos.x, pos.y + 4);
          grad.addColorStop(0, isRev ? 'rgba(255, 240, 110, 0)' : 'rgba(110, 255, 145, 0)');
          grad.addColorStop(0.5, isRev ? 'rgba(255, 224, 90, 0.55)' : 'rgba(95, 255, 135, 0.5)');
          grad.addColorStop(1, isRev ? 'rgba(255, 246, 170, 0.85)' : 'rgba(160, 255, 185, 0.8)');
          ctx.fillStyle = grad;
          ctx.fillRect(pos.x - 22, pos.y - 75, 44, 79);
          for (let i = 0; i < 6; i++) {
            const sx = pos.x + Math.sin(i * 2.1 + t * 4) * 18;
            const sy = pos.y - 6 - t * 58 - (i % 3) * 8;
            ctx.strokeStyle = isRev ? '#fff59d' : '#a8ffb8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(sx - 4, sy);
            ctx.lineTo(sx + 4, sy);
            ctx.moveTo(sx, sy - 4);
            ctx.lineTo(sx, sy + 4);
            ctx.stroke();
          }
        } else if (fx.effect === 'buff_atk' || fx.effect === 'buff_spd') {
          // 魔神附体 (red-gold rising flames) / 疾风咒 (cyan spinning wind rings)
          const isAtk = fx.effect === 'buff_atk';
          ctx.globalAlpha = 1 - t * 0.4;
          for (let i = 0; i < 3; i++) {
            const ringY = pos.y - 8 - ((t * 56 + i * 18) % 56);
            ctx.strokeStyle = isAtk ? '#ff7438' : '#5ef2ff';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.ellipse(pos.x, ringY, 24 - i * 2, 8, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        } else if (fx.effect === 'chaos') {
          // 离间计: magenta swirling confusion rings above head
          ctx.globalAlpha = 1 - t * 0.35;
          ctx.strokeStyle = '#ff6ef0';
          ctx.lineWidth = 2.5;
          for (let i = 0; i < 2; i++) {
            const ang = t * Math.PI * 4 + i * Math.PI;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y - 38, 16 + i * 8, ang, ang + Math.PI * 1.3);
            ctx.stroke();
          }
        } else if (fx.effect === 'seal') {
          // 定身计: glowing cyan talisman cross-chains locking the target
          ctx.globalAlpha = 1 - t * 0.35;
          ctx.strokeStyle = '#6ce2ff';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#1ebcff';
          ctx.shadowBlur = 8;
          ctx.strokeRect(pos.x - 20, pos.y - 54, 40, 50);
          ctx.beginPath();
          ctx.moveTo(pos.x - 20, pos.y - 54);
          ctx.lineTo(pos.x + 20, pos.y - 4);
          ctx.moveTo(pos.x + 20, pos.y - 54);
          ctx.lineTo(pos.x - 20, pos.y - 4);
          ctx.stroke();
        } else if (fx.effect === 'trap') {
          // 画地为牢: golden energy cage bars slamming down
          ctx.globalAlpha = 1 - t * 0.35;
          const drop = Math.min(1, t * 2.5);
          const topY = pos.y - 56 * drop;
          ctx.strokeStyle = '#ffd54f';
          ctx.lineWidth = 2.5;
          for (let i = -2; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(pos.x + i * 9, topY);
            ctx.lineTo(pos.x + i * 9, pos.y + 2);
            ctx.stroke();
          }
          ctx.strokeRect(pos.x - 20, topY, 40, pos.y + 2 - topY);
        }
        ctx.restore();
      }

      // 3.5 Screen flash overlay on heavy elemental spells
      if (flashRef.current) {
        const fel = now - flashRef.current.startedAt;
        if (fel >= flashRef.current.duration) {
          flashRef.current = null;
        } else if (fel >= 0) {
          ctx.save();
          ctx.globalAlpha = 1 - fel / flashRef.current.duration;
          ctx.fillStyle = flashRef.current.color;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
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
    let bestDist = 42;
    for (const u of aliveEnemies) {
      const pos = getUnitCoords(u, w, h);
      const d = Math.hypot(lx - pos.x, ly - (pos.y - 24));
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

          {/* Classic Staggered Golden Diamond Command Buttons */}
          {battle.status === 'ongoing' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto flex items-center">
                <div className="flex flex-col -space-y-1">
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
                    onClick={() => {
                      if (isCommandingHero) {
                        setSubMenu((m) => (m === 'summon' ? 'none' : 'summon'));
                      } else {
                        stepBack();
                      }
                    }}
                    className={`hx-diamond-btn ${subMenu === 'summon' ? 'active' : ''}`}
                    title={isCommandingHero ? '召唤营中备用副将替补上阵' : '返回重选上一位单位指令'}
                  >
                    <span>{isCommandingHero ? '招将' : '重选'}</span>
                  </button>
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
                <div className="flex flex-col -space-y-1 -ml-2">
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
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setSubMenu((m) => (m === 'protect' ? 'none' : 'protect'))}
                    className={`hx-diamond-btn ${subMenu === 'protect' ? 'active' : ''}`}
                    title="保护指定友军分担伤害 (快捷键 5)"
                  >
                    <span>保护</span>
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
                      onClick={toggleAutoGenerals}
                      className="hx-diamond-btn"
                      title="一键切回副将自动出手"
                    >
                      <span>全托管</span>
                    </button>
                  )}
                </div>
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
