import type { ReactNode } from 'react';
import type { PlatformTheme } from '../platform/host';

interface GameShellProps {
  children: ReactNode;
  toast?: string | null;
  isMapp?: boolean;
  theme?: PlatformTheme | null;
}

export function GameShell({ children, toast, isMapp = false, theme }: GameShellProps) {
  const outerBg =
    theme?.mode === 'light'
      ? 'bg-[#e8e5dc]'
      : 'bg-[#090a10]';

  // In MAPP mode avoid 100dvh + padding resize feedback loops inside the Discourse host iframe
  const outerLayout = isMapp
    ? `w-full py-2 flex items-center justify-center ${outerBg}`
    : `min-h-[100dvh] w-full flex items-center justify-center sm:p-3 ${outerBg}`;

  const frameLayout = isMapp
    ? 'relative w-full max-w-[430px] h-[740px] bg-black text-white overflow-hidden flex flex-col border-2 border-[#5e4b25] shadow-[0_0_24px_rgba(0,0,0,0.65)]'
    : 'relative w-full max-w-[430px] h-[100dvh] sm:h-[min(780px,95dvh)] bg-black text-white overflow-hidden flex flex-col sm:border-2 sm:border-[#5e4b25] sm:shadow-[0_0_32px_rgba(0,0,0,0.95)]';

  return (
    <div className={outerLayout}>
      <div className={frameLayout}>
        {children}
        {toast && (
          <div className="pointer-events-none absolute top-11 left-1/2 -translate-x-1/2 z-50 w-[88%] max-w-[340px] px-3 py-1.5 bg-[#1b0808]/95 border border-[#e3b94b] text-[#ffef9c] text-xs text-center hx-stroke shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
