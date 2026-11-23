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
import { ChatDock } from './ChatDock';

interface BattleStageProps {
  battle: BattleState;
  character: CharacterView;
  messages: ChatMessage[];
  onSendChat: (channel: ChatChannel, content: string) => void;
  onAction: (cmd: {
    action: 'attack' | 'skill' | 'defend' | 'item' | 'capture' | 'flee';
    targetUid?: string;
    skillId?: string;
    itemId?: string;
  }) => Promise<void>;
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
  effect: 'lei' | 'fire' | 'fg' | 'slash' | 'heal';
  startedAt: number;
}

const LOGICAL_W = 320;
const LOGICAL_H = 212;

function getUnitCoords(u: BattleUnit): { x: number; y: number } {
  if (u.side === 'enemy') {
    const enemySlots = [
      { x: 46, y: 78 },
      { x: 92, y: 108 },
      { x: 46, y: 144 },
      { x: 92, y: 172 },
      { x: 64, y: 112 },
    ];
    return enemySlots[u.position % enemySlots.length];
  }
  const playerSlots = [
    { x: 264, y: 112 },
    { x: 224, y: 84 },
    { x: 224, y: 150 },
    { x: 268, y: 168 },
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedTargetUid, setSelectedTargetUid] = useState<string | undefined>(undefined);
  const [subMenu, setSubMenu] = useState<'none' | 'skill' | 'item'>('none');
  const [autoBattle, setAutoBattle] = useState(false);
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
  const mySkills = useMemo(
    () => SKILLS.filter((s) => s.roleClass === character.roleClass || s.roleClass === 'all'),
    [character.roleClass],
  );
  const consumables = useMemo(
    () => character.inventory.filter((i) => i.type === 'consumable' && i.quantity > 0),
    [character.inventory],
  );

  // Keep selected target valid
  useEffect(() => {
    if (!aliveEnemies.some((e) => e.uid === selectedTargetUid)) {
      setSelectedTargetUid(aliveEnemies[0]?.uid);
    }
  }, [aliveEnemies, selectedTargetUid]);

  // Countdown timer
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

  // Trigger visual FX + floating damage numbers whenever battle.lastLogs updates
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
            color: '#6dff7d',
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

  const dispatchCommand = useCallback(
    async (cmd: Parameters<BattleStageProps['onAction']>[0]) => {
      if (busy || battle.status !== 'ongoing') return;
      setBusy(true);
      setSubMenu('none');
      try {
        await onAction({
          ...cmd,
          targetUid: cmd.targetUid ?? selectedTargetUid,
        });
      } catch (err) {
        onNotify(err instanceof Error ? err.message : '指令执行失败');
      } finally {
        setBusy(false);
      }
    },
    [busy, battle.status, onAction, selectedTargetUid, onNotify],
  );

  // Auto-battle loop
  useEffect(() => {
    if (!autoBattle || battle.status !== 'ongoing' || busy) return;
    const t = setTimeout(() => {
      void dispatchCommand({ action: 'attack', targetUid: selectedTargetUid });
    }, 950);
    return () => clearTimeout(t);
  }, [autoBattle, battle.status, battle.round, busy, dispatchCommand, selectedTargetUid]);

  // Classic keyboard shortcuts (1-7)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (battle.status !== 'ongoing') {
        if (e.key === 'Enter' || e.key === 'Escape') onExitBattle();
        return;
      }
      if (e.key === '1') void dispatchCommand({ action: 'attack' });
      else if (e.key === '2') setSubMenu((m) => (m === 'skill' ? 'none' : 'skill'));
      else if (e.key === '3') void dispatchCommand({ action: 'capture' });
      else if (e.key === '4') setSubMenu((m) => (m === 'item' ? 'none' : 'item'));
      else if (e.key === '6') void dispatchCommand({ action: 'flee' });
      else if (e.key === '7') void dispatchCommand({ action: 'defend' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [battle.status, dispatchCommand, onExitBattle]);

  // 2D Pixel Canvas Renderer (real stitched f_bg + modular sprites + effects)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const getImg = (name: string): HTMLImageElement | null => {
      const cache = imgCacheRef.current;
      if (cache.has(name)) return cache.get(name) ?? null;
      cache.set(name, null);
      const img = new Image();
      img.onload = () => {
        cache.set(name, img);
      };
      img.src = `/assets/hxsg/${name}`;
      return null;
    };

    let rafId = 0;
    const render = (now: number) => {
      ctx.imageSmoothingEnabled = false;

      // 1. Background terrain (stitched classic f_bg*_5/6 + golden-olive field)
      ctx.fillStyle = '#bba86a';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      const bgPrefix = battle.battleBg || 'f_bg2';
      const topL = getImg(`${bgPrefix}_5.png`);
      const topR = getImg(`${bgPrefix}_6.png`);
      if (topL && topR) {
        ctx.drawImage(topL, 0, 0, LOGICAL_W / 2, 46);
        ctx.drawImage(topR, LOGICAL_W / 2, 0, LOGICAL_W / 2, 46);
      } else {
        ctx.fillStyle = '#4f6d31';
        ctx.fillRect(0, 0, LOGICAL_W, 44);
      }

      const btmL = getImg(`${bgPrefix}_3.png`);
      const btmR = getImg(`${bgPrefix}_4.png`);
      if (btmL && btmR) {
        ctx.drawImage(btmL, 0, LOGICAL_H - 22, LOGICAL_W / 2, 22);
        ctx.drawImage(btmR, LOGICAL_W / 2, LOGICAL_H - 22, LOGICAL_W / 2, 22);
      } else {
        ctx.fillStyle = '#5c6b2d';
        ctx.fillRect(0, LOGICAL_H - 22, LOGICAL_W, 22);
      }

      // Decorative pixel bushes (classic_2.jpg)
      const bush1 = getImg('f_bg_c.png');
      const bush2 = getImg('f_bg_c2.png');
      if (bush1) ctx.drawImage(bush1, 168, 30, 31, 27);
      if (bush2) ctx.drawImage(bush2, 226, 152, 29, 20);

      // 2. Render all units
      const arrowImg = getImg('f_jt.png');
      for (const u of battle.units) {
        if (!u.alive) continue;
        const pos = getUnitCoords(u);
        const lungeAt = lungeRef.current.get(u.uid) ?? 0;
        const lungeElapsed = now - lungeAt;
        const isAttacking = lungeElapsed >= 0 && lungeElapsed < 320;
        const lungeShift = isAttacking
          ? Math.sin((lungeElapsed / 320) * Math.PI) * (u.side === 'player' ? -24 : 24)
          : 0;

        const bob = Math.sin(now / 280 + pos.x) > 0 ? 1 : 0;
        const ux = Math.round(pos.x + lungeShift);
        const uy = Math.round(pos.y);

        // Ground shadow
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(ux, uy + 2, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Target highlight ring under selected enemy
        if (u.uid === selectedTargetUid && u.side === 'enemy') {
          ctx.strokeStyle = '#ffef4d';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(ux, uy + 2, 18, 7, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Modular sprite draw (head + body + legs)
        const head = getImg(`${u.spriteKey}_h.png`);
        const body = getImg(`${u.spriteKey}_b.png`);
        const legs = getImg(`${u.spriteKey}_f.png`);
        const scale = 1.5;

        ctx.save();
        ctx.translate(ux, uy);
        // Enemies on left face right (mirror original left-facing sprites)
        if (u.side === 'enemy') {
          ctx.scale(-1, 1);
        }
        if (legs) {
          const half = Math.floor(legs.width / 2);
          const sx = isAttacking ? half : 0;
          const sw = isAttacking ? legs.width - half : half;
          ctx.drawImage(
            legs,
            sx,
            0,
            sw,
            legs.height,
            Math.round((-sw * scale) / 2),
            Math.round(-legs.height * scale),
            Math.round(sw * scale),
            Math.round(legs.height * scale),
          );
        }
        if (body) {
          const idleW = Math.round(body.width * 0.42);
          const sx = isAttacking ? idleW : 0;
          const sw = isAttacking ? body.width - idleW : idleW;
          ctx.drawImage(
            body,
            sx,
            0,
            sw,
            body.height,
            Math.round((-sw * scale) / 2),
            Math.round(-(body.height + 6) * scale + bob),
            Math.round(sw * scale),
            Math.round(body.height * scale),
          );
        }
        if (head) {
          ctx.drawImage(
            head,
            0,
            0,
            head.width,
            head.height,
            Math.round((-head.width * scale) / 2),
            Math.round(-(head.height + 16) * scale + bob),
            Math.round(head.width * scale),
            Math.round(head.height * scale),
          );
        }
        ctx.restore();

        // Classic Red/Blue HP & MP Bars above unit (matches classic_2.jpg)
        const barW = 42;
        const bx = ux - barW / 2;
        const by = uy - 54;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx - 1, by - 1, barW + 2, 10);
        ctx.fillStyle = '#220b0b';
        ctx.fillRect(bx, by, barW, 4);
        ctx.fillStyle = '#e8231a';
        ctx.fillRect(bx, by, Math.round(barW * Math.max(0, u.hp / u.maxHp)), 4);
        ctx.fillStyle = '#091538';
        ctx.fillRect(bx, by + 5, barW, 3);
        ctx.fillStyle = '#1d65f0';
        ctx.fillRect(bx, by + 5, Math.round(barW * Math.max(0, u.mp / Math.max(1, u.maxMp))), 3);

        // Name label
        ctx.font = 'bold 9px SimSun, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.fillText(u.name, ux + 1, uy + 12);
        ctx.fillStyle = u.side === 'player' ? '#fff7a8' : '#ffffff';
        ctx.fillText(u.name, ux, uy + 11);

        // Red action pointer beside main role
        if (u.isMainRole && battle.status === 'ongoing') {
          const px = ux - 34 + Math.sin(now / 180) * 2;
          if (arrowImg) {
            ctx.drawImage(arrowImg, px, uy - 34, 16, 16);
          } else {
            ctx.fillStyle = '#ff2020';
            ctx.beginPath();
            ctx.moveTo(px + 12, uy - 24);
            ctx.lineTo(px, uy - 30);
            ctx.lineTo(px, uy - 18);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // 3. Skill Visual Effects (f_sd lightning, fire, fg wave)
      fxRef.current = fxRef.current.filter((f) => now - f.startedAt < 520);
      for (const fx of fxRef.current) {
        const elapsed = now - fx.startedAt;
        if (elapsed < 0) continue;
        const unit = battle.units.find((u) => u.uid === fx.uid);
        if (!unit) continue;
        const pos = getUnitCoords(unit);
        if (fx.effect === 'lei') {
          const sd = getImg('f_sd.png');
          if (sd) {
            const frame = Math.min(2, Math.floor((elapsed / 520) * 3));
            const fw = Math.floor(sd.width / 3);
            ctx.drawImage(sd, frame * fw, 0, fw, sd.height, pos.x - 20, pos.y - 82, 40, 82);
          }
        } else if (fx.effect === 'fire') {
          const fire = getImg('fire.png');
          if (fire) {
            ctx.drawImage(fire, pos.x - 24, pos.y - 52, 48, 44);
          }
        } else if (fx.effect === 'fg') {
          const fg = getImg('fg.png');
          if (fg) {
            ctx.drawImage(fg, pos.x - 26, pos.y - 54, 52, 46);
          }
        } else if (fx.effect === 'slash') {
          ctx.strokeStyle = '#fff59d';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(pos.x - 16, pos.y - 40);
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
        const pos = getUnitCoords(unit);
        const dy = (elapsed / 1100) * 28;
        ctx.font = 'bold 13px SimSun, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.fillText(fl.text, pos.x + 1, pos.y - 58 - dy + 1);
        ctx.fillStyle = fl.color;
        ctx.fillText(fl.text, pos.x, pos.y - 58 - dy);
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [battle, selectedTargetUid]);

  // Allow tapping an enemy on canvas to switch target
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lx = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
    const ly = ((e.clientY - rect.top) / rect.height) * LOGICAL_H;

    let closest: BattleUnit | null = null;
    let bestDist = 36;
    for (const u of aliveEnemies) {
      const pos = getUnitCoords(u);
      const d = Math.hypot(lx - pos.x, ly - (pos.y - 22));
      if (d < bestDist) {
        bestDist = d;
        closest = u;
      }
    }
    if (closest) setSelectedTargetUid(closest.uid);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1e2628] overflow-hidden">
      {/* 1. Classic Top Bar: Map Name + Enemy vs Player Strip (classic_2.jpg) */}
      <div
        className="h-[34px] flex items-center justify-center relative border-b border-[#4c6165] shrink-0"
        style={{ backgroundImage: 'url(/assets/hxsg/tit_bg.png)', backgroundSize: 'cover' }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-[86px] overflow-hidden border-r border-black/60">
          <img
            src={`/assets/hxsg/${battle.battleBg}_5.png`}
            alt=""
            className="w-full h-full object-cover pixelated"
          />
        </div>
        <span className="text-[16px] font-bold text-white hx-stroke">{battle.mapName}</span>
      </div>

      <div
        className="h-[30px] px-3 flex items-center justify-between border-b border-black shrink-0"
        style={{ backgroundImage: 'url(/assets/hxsg/fig_tit.png)', backgroundSize: 'cover' }}
      >
        <span className="text-[14px] font-black text-[#ff4f4f] hx-stroke">
          {battle.enemyGroupName}
        </span>
        <span className="text-[14px] font-black text-[#5ea5ff] hx-stroke">
          第{battle.round}回合 · 对阵
        </span>
        <span className="text-[14px] font-black text-[#ff5a5a] hx-stroke">{character.name}</span>
      </div>

      {/* 2. Pixel Battlefield Canvas + Staggered 7 Golden Diamond Buttons (classic_2.jpg) */}
      <div className="relative flex-1 min-h-[260px] bg-[#bba86a] overflow-hidden flex flex-col">
        <canvas
          ref={canvasRef}
          width={LOGICAL_W}
          height={LOGICAL_H}
          onClick={handleCanvasClick}
          className="w-full flex-1 pixelated cursor-crosshair"
        />

        {/* Classic 7 Staggered Golden Diamond Command Buttons in Center */}
        {battle.status === 'ongoing' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-5">
            <div className="pointer-events-auto flex items-center">
              {/* Left 4 diamonds: 攻击 / 招降 / 招将 / 防御 */}
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
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void dispatchCommand({ action: 'capture' })}
                  className="hx-diamond-btn"
                  title="尝试招降残血敌人为副将 (快捷键 3)"
                >
                  <span>招降</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onNotify('当前已自动上阵你在副将槽配置的所有副将')}
                  className="hx-diamond-btn"
                  title="副将状态"
                >
                  <span>招将</span>
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
              {/* Right 3 staggered diamonds: 技能 / 物品 / 逃跑 */}
              <div className="flex flex-col -space-y-1 -ml-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSubMenu((m) => (m === 'skill' ? 'none' : 'skill'))}
                  className={`hx-diamond-btn ${subMenu === 'skill' ? 'active' : ''}`}
                  title="施放职业技能 (快捷键 2)"
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
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void dispatchCommand({ action: 'flee' })}
                  className="hx-diamond-btn"
                  title="脱离战斗 (快捷键 6)"
                >
                  <span>逃跑</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Skill / Item Popover Tray */}
        {subMenu !== 'none' && battle.status === 'ongoing' && (
          <div className="absolute left-2 right-2 bottom-9 z-20 bg-[#2a0a31]/95 border-2 border-[#e2b94e] p-2 shadow-xl">
            <div className="flex items-center justify-between text-xs text-[#ffe273] font-bold mb-1.5 pb-1 border-b border-white/15">
              <span>{subMenu === 'skill' ? '选择施放技能' : '选择战斗药品'}</span>
              <button
                type="button"
                onClick={() => setSubMenu('none')}
                className="text-white/80 hover:text-white"
              >
                关闭 ✕
              </button>
            </div>
            {subMenu === 'skill' ? (
              <div className="grid grid-cols-2 gap-1.5">
                {mySkills.map((sk) => (
                  <button
                    key={sk.id}
                    type="button"
                    onClick={() => void dispatchCommand({ action: 'skill', skillId: sk.id })}
                    className="p-1.5 bg-[#44154f] hover:bg-[#5f1d6e] border border-[#c5963d] text-left"
                  >
                    <div className="flex justify-between text-xs font-bold text-[#ffea84]">
                      <span>{sk.name}</span>
                      <span className="text-[#85c6ff]">耗精{sk.mpCost}</span>
                    </div>
                    <div className="text-[10px] text-[#e4cde8] truncate">{sk.desc}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {consumables.map((it) => (
                  <button
                    key={it.itemId}
                    type="button"
                    onClick={() => void dispatchCommand({ action: 'item', itemId: it.itemId })}
                    className="p-1.5 bg-[#44154f] hover:bg-[#5f1d6e] border border-[#c5963d] text-left"
                  >
                    <div className="flex justify-between text-xs font-bold text-[#ffea84]">
                      <span>{it.name}</span>
                      <span>×{it.quantity}</span>
                    </div>
                    <div className="text-[10px] text-[#e4cde8] truncate">{it.desc}</div>
                  </button>
                ))}
                {consumables.length === 0 && (
                  <div className="col-span-2 text-xs text-center text-[#d4bcd9] py-2">
                    背包里没有可用丹药
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Latest Combat Log Banner */}
        {battle.lastLogs.length > 0 && battle.status === 'ongoing' && (
          <div className="px-2 py-0.5 bg-black/70 text-[11px] text-[#ffe99a] truncate">
            {battle.lastLogs[battle.lastLogs.length - 1].message}
          </div>
        )}

        {/* Bottom Countdown Trapezoid + Auto Button (matches classic_2.jpg) */}
        <div className="h-[34px] px-2 bg-[#4a5724] border-t border-[#293314] flex items-center justify-between shrink-0">
          <div className="w-[54px] text-[10px] text-[#e8f0c0]">键位1-7</div>
          <div className="px-4 py-1 bg-[#1e2324] border border-[#8e9e9f] text-[13px] font-bold text-white hx-stroke">
            {character.name}-出招({countdown})
          </div>
          <button
            type="button"
            onClick={() => setAutoBattle((v) => !v)}
            className={`hx-btn-red px-3 py-0.5 text-[13px] ${
              autoBattle ? 'ring-2 ring-[#ffe96e]' : ''
            }`}
          >
            {autoBattle ? '自动中' : '自动'}
          </button>
        </div>

        {/* Victory / Defeat / Fled Official Banner Overlay (f_sl.png & f_bb.png) */}
        {battle.status !== 'ongoing' && (
          <div className="absolute inset-0 z-30 bg-black/75 flex flex-col items-center justify-center p-4 gap-3">
            {battle.status === 'victory' && (
              <img
                src="/assets/hxsg/f_sl.png"
                alt="胜利"
                className="w-[240px] h-auto pixelated drop-shadow-[0_4px_12px_#000]"
              />
            )}
            {battle.status === 'defeat' && (
              <img
                src="/assets/hxsg/f_bb.png"
                alt="败北"
                className="w-[240px] h-auto pixelated drop-shadow-[0_4px_12px_#000]"
              />
            )}
            {battle.status === 'fled' && (
              <div className="text-2xl font-black text-[#ffe46e] hx-stroke">成功脱身！</div>
            )}

            <div className="w-full max-w-[290px] bg-[#2a0c31]/95 border-2 border-[#e0b84e] p-3 text-xs space-y-1.5 text-center">
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
                    <div className="text-[#91d5ff]">
                      战利品：【{battle.rewards.droppedItem.name}】×
                      {battle.rewards.droppedItem.quantity}
                    </div>
                  )}
                  {battle.rewards.capturedGeneral && (
                    <div className="text-[#ffcf54] font-bold">
                      成功招降副将：【{battle.rewards.capturedGeneral.name}】（成长{' '}
                      {battle.rewards.capturedGeneral.growth}）
                    </div>
                  )}
                </>
              ) : (
                <div className="text-[#e8d2ed]">
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

      {/* 3. Persistent Chat Dock under Battlefield */}
      <ChatDock messages={messages} onSend={onSendChat} compact />
    </div>
  );
}
