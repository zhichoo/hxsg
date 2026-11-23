import { useEffect, useRef } from 'react';

interface PixelSpriteProps {
  spriteKey: string;
  scale?: number;
  flipX?: boolean;
  className?: string;
}

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

    let cancelled = false;
    let rafId = 0;

    const load = (src: string) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });

    Promise.all([
      load(`/assets/hxsg/${spriteKey}_h.png`),
      load(`/assets/hxsg/${spriteKey}_b.png`),
      load(`/assets/hxsg/${spriteKey}_f.png`),
    ]).then(([head, body, legs]) => {
      if (cancelled) return;
      const draw = (now: number) => {
        if (cancelled) return;
        const bob = Math.sin(now / 260) > 0 ? intScale : 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        if (flipX) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        const cx = Math.floor(canvas.width / 2);
        const baseY = canvas.height - 4 * intScale;

        if (legs) {
          const fw = Math.floor(legs.width / 2);
          ctx.drawImage(
            legs,
            0,
            0,
            fw,
            legs.height,
            cx - Math.floor((fw * intScale) / 2),
            baseY - legs.height * intScale,
            fw * intScale,
            legs.height * intScale,
          );
        }
        if (body) {
          const bw = Math.round(body.width * 0.42);
          ctx.drawImage(
            body,
            0,
            0,
            bw,
            body.height,
            cx - Math.floor((bw * intScale) / 2),
            baseY - (body.height + 6) * intScale + bob,
            bw * intScale,
            body.height * intScale,
          );
        }
        if (head) {
          ctx.drawImage(
            head,
            0,
            0,
            head.width,
            head.height,
            cx - Math.floor((head.width * intScale) / 2),
            baseY - (head.height + 16) * intScale + bob,
            head.width * intScale,
            head.height * intScale,
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
  }, [spriteKey, intScale, flipX]);

  return (
    <canvas
      ref={canvasRef}
      width={logicalW}
      height={logicalH}
      style={{ width: logicalW, height: logicalH }}
      className={`pixelated ${className}`}
    />
  );
}
