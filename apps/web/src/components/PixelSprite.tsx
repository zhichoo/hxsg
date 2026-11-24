import { useEffect, useRef } from 'react';
import { loadAssetImage } from '../platform/host';

interface PixelSpriteProps {
  spriteKey: string;
  scale?: number;
  flipX?: boolean;
  className?: string;
}

const RIGS = {
  '1': { legIdle: [0, 18] as const, bodyIdle: [0, 22, -13] as const, bodyY: -19, headY: -36, baseLegsW: 37, baseBodyW: 60 },
  '2': { legIdle: [0, 14] as const, bodyIdle: [0, 23, -10] as const, bodyY: -17, headY: -34, baseLegsW: 28, baseBodyW: 61 },
  '3': { legIdle: [0, 14] as const, bodyIdle: [0, 31, -11] as const, bodyY: -18, headY: -34, baseLegsW: 28, baseBodyW: 67 },
};

export function PixelSprite({
  spriteKey,
  scale = 1,
  flipX = false,
  className = '',
}: PixelSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intScale = Math.max(1, Math.round(scale));
  const logicalW = 44 * intScale;
  const logicalH = 44 * intScale;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 2));
    canvas.width = Math.round(logicalW * dpr);
    canvas.height = Math.round(logicalH * dpr);

    const rig = spriteKey.includes('2') ? RIGS['2'] : spriteKey.includes('3') ? RIGS['3'] : RIGS['1'];

    let cancelled = false;
    let rafId = 0;

    Promise.all([
      loadAssetImage(`${spriteKey}_h.png`),
      loadAssetImage(`${spriteKey}_b.png`),
      loadAssetImage(`${spriteKey}_f.png`),
    ]).then(([head, body, legs]) => {
      if (cancelled) return;
      const hiRes = Boolean((head && head.width > 21) || (body && body.width > rig.baseBodyW));
      const draw = (now: number) => {
        if (cancelled) return;
        const bob = Math.sin(now / 260) > 0 ? intScale : 0;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, logicalW, logicalH);
        ctx.imageSmoothingEnabled = hiRes;
        if (hiRes) ctx.imageSmoothingQuality = 'high';
        ctx.save();
        ctx.translate(Math.floor(logicalW / 2), logicalH - 4 * intScale);
        if (flipX) ctx.scale(-1, 1);

        if (legs) {
          const legRes = Math.max(1, legs.width / rig.baseLegsW);
          const [sx, sw] = rig.legIdle;
          const dw = sw * intScale;
          const dh = (legs.height / legRes) * intScale;
          ctx.drawImage(legs, sx * legRes, 0, sw * legRes, legs.height, Math.round(-dw / 2), -dh, dw, dh);
        }
        if (body) {
          const isWideWarrior = !spriteKey.includes('2') && !spriteKey.includes('3') && body.width === 288;
          const baseBodyW = isWideWarrior ? 72 : rig.baseBodyW;
          const bodyRes = Math.max(1, body.width / baseBodyW);
          const [sx, sw, dxPx] = isWideWarrior ? ([0, 34, -17] as const) : rig.bodyIdle;
          const dw = sw * intScale;
          const dh = (body.height / bodyRes) * intScale;
          ctx.drawImage(
            body,
            sx * bodyRes,
            0,
            sw * bodyRes,
            body.height,
            Math.round(dxPx * intScale),
            Math.round(rig.bodyY * intScale) + bob,
            dw,
            dh,
          );
        }
        if (head) {
          const headRes = Math.max(1, head.width / 21);
          const dw = (head.width / headRes) * intScale;
          const dh = (head.height / headRes) * intScale;
          ctx.drawImage(
            head,
            0,
            0,
            head.width,
            head.height,
            Math.round(-dw / 2),
            Math.round(rig.headY * intScale) + bob,
            dw,
            dh,
          );
        }
        ctx.restore();
        rafId = requestAnimationFrame(draw);
      };
      rafId = requestAnimationFrame(draw);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [spriteKey, intScale, flipX, logicalW, logicalH]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: logicalW, height: logicalH }}
      className={className}
    />
  );
}
