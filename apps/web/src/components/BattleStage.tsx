import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SKILLS,
  type BattleActionLog,
  type BattleState,
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
  onSendChat: (channel: ChatChannel, content: string) => void;
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
  effect: 'lei' | 'fire' | 'fg' | 'slash' | 'heal' | 'chaos' | 'seal' | 'trap';
  startedAt: number;
}

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
  const [subMenu, setSubMenu] = useState<'none' | 'skill' | 'item'>('none');
  const [autoBattle, setAutoBattle] = useState(false);
  const [autoGenerals, setAutoGenerals] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [queuedHeroCmd, setQueuedHeroCmd] = useState<HeroCommandInput | null>(null);
  const [queuedGeneralCmds, setQueuedGeneralCmds] = useState<GeneralCommandInput[]>([]);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(60);

  const fxRef = useRef<ActiveFx[]>([]);
  const floatsRef = useRef<FloatingNum[]>([]);
  const lungeRef = useRef<Map<string, number>>(new Map());
  const imgCacheRef = useRef<Map<string, HTMLImageElement | null>>(new Map());

  const aliveEnemies = useMemo(
    () => battle.units.filter((u) => u.side === 'enemy' && u.alive),
    [battle.units],
  );
  const controllableUnits = useMemo(() => {
    const allies = battle.units
      .filter((u) => u.side === 'player' && u.alive)
      .sort((a, b) => a.position - b.position);
    if (autoGenerals || autoBattle) {
      return allies.filter((u) => u.isMainRole);
    }
    return allies;
  }, [battle.units, autoGenerals, autoBattle]);

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
  }, [battle.battleId, battle.round]);

  // Sync canvas buffer strictly to actual CSS size * dpr (zero stretching, zero blur)
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

  useEffect(() => {
    if (battle.status !== 'ongoing') return;
    const tick = () => {
      const sec = Math.max(0, Math.ceil((battle.deadlineAt - Date.now()) / 1000));
      setCountdown(sec);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [battle.deadlineAt, battle.status]);

  useEffect(() => {
    if (!battle.lastLogs.length) return;
    const now = performance.now();
    battle.lastLogs.forEach((log: BattleActionLog, idx: number) => {
      const delay = idx * 140;
      lungeRef.current.set(log.actorUid, now + delay);
      for (const t of log.targets) {
        if (log.effect) {
          fxRef.current.push({ uid: t.uid, effect: log.effect, startedAt: now + delay });
        }
        if (t.heal && t.heal > 0) {
          floatsRef.current.push({
            uid: t.uid,
            text: `+${t.heal}`,
            color: '#76ff88',
            createdAt: now + delay,
          });
        } else if (t.appliedStatus) {
          const stText =
            t.appliedStatus === 'chaos' ? '混乱!' : t.appliedStatus === 'seal' ? '封印!' : '围困!';
          const stColor =
            t.appliedStatus === 'chaos'
              ? '#ff7cf0'
              : t.appliedStatus === 'seal'
                ? '#7ce2ff'
                : '#ffd26b';
          floatsRef.current.push({
            uid: t.uid,
            text: stText,
            color: stColor,
            createdAt: now + delay,
          });
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

  const dispatchCommand = useCallback(
    async (cmd: HeroCommandInput) => {
      if (busy || battle.status !== 'ongoing') return;
      setSubMenu('none');
      const targetUid = cmd.targetUid ?? selectedTargetUid;

      if (isCommandingHero) {
        const heroCmd: HeroCommandInput = { ...cmd, targetUid };
        // Fleeing, full-auto, auto-generals, or no alive generals -> submit immediately!
        if (cmd.action === 'flee' || autoBattle || autoGenerals || controllableUnits.length <= 1) {
          await submitRound(heroCmd, []);
          return;
        }
        setQueuedHeroCmd(heroCmd);
        setQueuedGeneralCmds([]);
        setStepIdx(1);
        return;
      }

      // Commanding an allied general (stepIdx >= 1)
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
          targetUid: gAction === 'item' || (gAction === 'skill' && SKILLS.find((s) => s.id === cmd.skillId)?.kind === 'heal') ? undefined : targetUid,
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
      // If user turns ON auto-generals while already mid-way choosing general commands, submit round now!
      if (next && queuedHeroCmd && battle.status === 'ongoing' && !busy) {
        void submitRound(queuedHeroCmd, queuedGeneralCmds);
      }
      return next;
    });
  }, [queuedHeroCmd, queuedGeneralCmds, battle.status, busy, submitRound]);

  useEffect(() => {
    if (!autoBattle || battle.status !== 'ongoing' || busy) return;
    const t = setTimeout(() => {
      void submitRound({ action: 'attack', targetUid: selectedTargetUid }, []);
    }, 950);
    return () => clearTimeout(t);
  }, [autoBattle, battle.status, battle.round, busy, submitRound, selectedTargetUid]);

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
      } else if (e.key === '4') setSubMenu((m) => (m === 'item' ? 'none' : 'item'));
      else if (e.key === '6') {
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

      // Decorative pixel bushes
      const bush1 = getImg('f_bg_c.png');
      const bush2 = getImg('f_bg_c2.png');
      if (bush1) ctx.drawImage(bush1, Math.round(w * 0.54), Math.round(topH - 12), 31, 27);
      if (bush2) ctx.drawImage(bush2, Math.round(w * 0.68), Math.round(h * 0.72), 29, 20);

      // Exact integer physical pixel scale so pixel art is NEVER blurry or oversized
      // On 2x Retina -> 3 physical px (= 1.5 CSS px, ~51px tall); on 1x -> 1 CSS px (~34px tall)
      const physScale = dpr >= 2 ? Math.max(2, Math.round(1.4 * dpr)) : 1;
      const spriteScale = physScale / dpr;

      const arrowImg = getImg('f_jt.png');

      for (const u of battle.units) {
        if (!u.alive) continue;
        const pos = getUnitCoords(u, w, h);
        const lungeAt = lungeRef.current.get(u.uid) ?? 0;
        const lungeElapsed = now - lungeAt;
        const isAttacking = lungeElapsed >= 0 && lungeElapsed < 320;
        // Player on right lunges LEFT (-); enemy on left lunges RIGHT (+)
        const lungeShift = isAttacking
          ? Math.sin((lungeElapsed / 320) * Math.PI) * (u.side === 'player' ? -28 : 28)
          : 0;

        const bob = Math.sin(now / 280 + pos.x) > 0 ? 1 : 0;
        const ux = Math.round(pos.x + lungeShift);
        const uy = Math.round(pos.y);

        // Ground shadow
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(ux, uy + 2, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Target ring under selected enemy, or active-command ring under currently controlled ally
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

        // Raw sprites face RIGHT (->):
        // - Enemies on the LEFT face RIGHT (no flip)
        // - Players on the RIGHT face LEFT (flip horizontally)
        const head = getImg(`${u.spriteKey}_h.png`);
        const body = getImg(`${u.spriteKey}_b.png`);
        const legs = getImg(`${u.spriteKey}_f.png`);

        ctx.save();
        ctx.translate(ux, uy);
        if (u.side === 'player') {
          ctx.scale(-1, 1);
        }

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

        // Classic Red/Blue HP & MP Bars above unit
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

        // Crisp high-contrast nameplate pill under unit
        ctx.font = 'bold 11px "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        const textW = ctx.measureText(u.name).width;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.68)';
        ctx.fillRect(Math.round(ux - textW / 2 - 4), uy + 4, Math.round(textW + 8), 15);
        ctx.fillStyle = u.side === 'player' ? '#fff394' : '#ffffff';
        ctx.fillText(u.name, ux, uy + 15);

        // Control status badges (乱 / 封 / 围) above HP bar
        if (u.statuses && u.statuses.length > 0) {
          u.statuses.forEach((st, idx) => {
            const label = st.kind === 'chaos' ? '乱' : st.kind === 'seal' ? '封' : '围';
            const bg =
              st.kind === 'chaos' ? '#9e198b' : st.kind === 'seal' ? '#136ea8' : '#8f5b0d';
            const sx = bx + idx * 17;
            const sy = by - 16;
            ctx.fillStyle = bg;
            ctx.fillRect(sx, sy, 15, 14);
            ctx.strokeStyle = '#ffe97d';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, 15, 14);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px "PingFang SC", "Microsoft YaHei", sans-serif';
            ctx.fillText(label, sx + 7.5, sy + 11);
          });
        }

        // Red action pointer arrow to the left of main role pointing right (->)
        if (u.isMainRole && battle.status === 'ongoing') {
          const px = ux - Math.round(28 * spriteScale) + Math.sin(now / 180) * 2;
          const py = uy - Math.round(24 * spriteScale);
          if (arrowImg) {
            ctx.drawImage(arrowImg, px, py, 16, 16);
          } else {
            ctx.fillStyle = '#ff2020';
            ctx.beginPath();
            ctx.moveTo(px + 12, py + 8);
            ctx.lineTo(px, py + 2);
            ctx.lineTo(px, py + 14);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // 3. Skill FX
      fxRef.current = fxRef.current.filter((f) => now - f.startedAt < 520);
      for (const fx of fxRef.current) {
        const elapsed = now - fx.startedAt;
        if (elapsed < 0) continue;
        const unit = battle.units.find((u) => u.uid === fx.uid);
        if (!unit) continue;
        const pos = getUnitCoords(unit, w, h);
        if (fx.effect === 'lei') {
          const sd = getImg('f_sd.png');
          if (sd) {
            const frame = Math.min(2, Math.floor((elapsed / 520) * 3));
            const fw = Math.floor(sd.width / 3);
            ctx.drawImage(sd, frame * fw, 0, fw, sd.height, pos.x - 20, pos.y - 88, 40, 88);
          }
        } else if (fx.effect === 'fire') {
          const fire = getImg('fire.png');
          if (fire) ctx.drawImage(fire, pos.x - 24, pos.y - 54, 48, 44);
        } else if (fx.effect === 'fg') {
          const fg = getImg('fg.png');
          if (fg) ctx.drawImage(fg, pos.x - 26, pos.y - 56, 52, 46);
        } else if (fx.effect === 'slash') {
          ctx.strokeStyle = '#fff59d';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(pos.x - 16, pos.y - 42);
          ctx.lineTo(pos.x + 16, pos.y - 10);
          ctx.stroke();
        }
      }

      // 4. Floating damage / heal numbers
      floatsRef.current = floatsRef.current.filter((fl) => now - fl.createdAt < 1100);
      for (const fl of floatsRef.current) {
        const elapsed = now - fl.createdAt;
        if (elapsed < 0) continue;
        const unit = battle.units.find((u) => u.uid === fl.uid);
        if (!unit) continue;
        const pos = getUnitCoords(unit, w, h);
        const dy = (elapsed / 1100) * 32;
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

  return (
    <div className="flex-1 flex flex-col bg-[#1e2628] overflow-hidden">
      {/* 1. Classic Top Bar */}
      <AssetBg
        path="tit_bg.png"
        className="h-[34px] border-b border-[#4c6165] shrink-0"
      >
        <span className="absolute left-2 text-[10px] text-[#cfe3e6] bg-black/45 px-1.5 py-0.5 border border-[#5f7c80]">
          第 {battle.round} 回合
        </span>
        <span className="text-[16px] font-bold text-white hx-stroke">{battle.mapName}</span>
      </AssetBg>

      <AssetBg
        path="fig_tit.png"
        className="h-[30px] border-b border-black shrink-0"
      >
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

      {/* 2. Pixel Battlefield Canvas + Staggered 7 Golden Diamond Buttons */}
      <div className="relative flex-1 min-h-[260px] bg-[#bca96b] overflow-hidden flex flex-col">
        <div ref={stageRef} className="relative flex-1 w-full min-h-0">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-full h-full block cursor-crosshair"
          />

          {/* Classic Staggered Golden Diamond Command Buttons (Hero + Generals Scheme A) */}
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
                      title="本回合由该副将自动 AI 出手 (快捷键 3)"
                    >
                      <span>智能</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (isCommandingHero) {
                        onNotify(
                          autoGenerals
                            ? '当前「副将自动」已开启，点击左下角可切换手动控制每位副将'
                            : '已启用副将手动操控：主角出招后将依次为出战副将下达技能指令',
                        );
                      } else {
                        stepBack();
                      }
                    }}
                    className="hx-diamond-btn"
                    title={isCommandingHero ? '副将指令说明' : '返回重选上一位单位的指令'}
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
                    title={isCommandingHero ? '施放职业技能 (快捷键 2)' : '施放副将技能 (快捷键 2)'}
                  >
                    <span>技能</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setSubMenu((m) => (m === 'item' ? 'none' : 'item'))}
                    className={`hx-diamond-btn ${subMenu === 'item' ? 'active' : ''}`}
                    title="使用背包丹药 (快捷键 4)"
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
                      onClick={toggleAutoGenerals}
                      className="hx-diamond-btn"
                      title="一键切回副将自动出手并立即结算本回合"
                    >
                      <span>全托管</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Skill / Item Popover Tray */}
          {subMenu !== 'none' && battle.status === 'ongoing' && (
            <div className="absolute left-2 right-2 bottom-2 z-20 bg-[#25092c]/95 border-2 border-[#e2b94e] p-2 shadow-xl">
              <div className="flex items-center justify-between text-xs text-[#ffe273] font-bold mb-1.5 pb-1 border-b border-white/15">
                <span>
                  {subMenu === 'skill'
                    ? `${isCommandingHero ? '主角' : `副将 ${activeUnit?.name ?? ''}`} · 选择施放技能（当前精力 ${activeUnit?.mp ?? character.mp}）`
                    : `${isCommandingHero ? '主角' : `副将 ${activeUnit?.name ?? ''}`} · 选择战斗药品`}
                </span>
                <button
                  type="button"
                  onClick={() => setSubMenu('none')}
                  className="text-white hover:text-[#ffe273]"
                >
                  关闭 ✕
                </button>
              </div>
              {subMenu === 'skill' ? (
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
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {consumables.map((it) => (
                    <button
                      key={it.itemId}
                      type="button"
                      onClick={() => void dispatchCommand({ action: 'item', itemId: it.itemId })}
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
                      背包里没有可用丹药
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

        {/* Bottom Countdown Trapezoid + General Manual/Auto Toggle + Full Auto Button */}
        <div className="h-[34px] px-2 bg-[#3d481e] border-t border-[#222910] flex items-center justify-between gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleAutoGenerals}
            className={`px-2 py-0.5 text-[11px] font-bold border shrink-0 ${
              autoGenerals
                ? 'bg-[#2a3319] border-[#869b5a] text-[#d4e8a8]'
                : 'bg-[#6e247c] border-[#f2c95b] text-[#ffe985]'
            }`}
            title="切换副将手动选技能 / 自动 AI 出手"
          >
            {autoGenerals ? '副将:自动' : '副将:手动'}
          </button>
          <div className="px-2.5 py-0.5 bg-[#191e1f] border border-[#92a3a5] text-[12px] font-bold text-white hx-stroke truncate">
            {activeUnit
              ? `${isCommandingHero ? '主角' : '副将'}·${activeUnit.name}${
                  controllableUnits.length > 1 ? `(${stepIdx + 1}/${controllableUnits.length})` : ''
                } (${countdown})`
              : `${character.name}-出招(${countdown})`}
          </div>
          <button
            type="button"
            onClick={() => setAutoBattle((v) => !v)}
            className={`hx-btn-red px-2.5 py-0.5 text-[12px] shrink-0 ${
              autoBattle ? 'ring-2 ring-[#ffe96e]' : ''
            }`}
          >
            {autoBattle ? '自动中' : '自动'}
          </button>
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
