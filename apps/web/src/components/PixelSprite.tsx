import { useEffect, useRef } from 'react';

interface PixelSpriteProps {
  spriteKey: string;
  scale?: number;
  flipX?: boolean;
  className?: string;
}

export function PixelSprite({
  spriteKey,
  scale = 2,
  flipX = false,
  className = '',
}: PixelSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
        const bob = Math.sin(now / 260) > 0 ? 1 : 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.save();
        if (flipX) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        const cx = canvas.width / 2;
        const baseY = canvas.height - 6;

        if (legs) {
          const fw = Math.floor(legs.width / 2);
          ctx.drawImage(
            legs,
            0,
            0,
            fw,
            legs.height,
            Math.round(cx - (fw * scale) / 2),
            Math.round(baseY - legs.height * scale),
            fw * scale,
            legs.height * scale,
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
            Math.round(cx - (bw * scale) / 2),
            Math.round(baseY - (body.height + 6) * scale + bob),
            bw * scale,
            body.height * scale,
          );
        }
        if (head) {
          ctx.drawImage(
            head,
            0,
            0,
            head.width,
            head.height,
            Math.round(cx - (head.width * scale) / 2),
            Math.round(baseY - (head.height + 17) * scale + bob),
            head.width * scale,
            head.height * scale,
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
  }, [spriteKey, scale, flipX]);

  return (
    <canvas
      ref={canvasRef}
      width={Math.round(40 * scale)}
      height={Math.round(44 * scale)}
      className={`pixelated ${className}`}
    />
  );
}
