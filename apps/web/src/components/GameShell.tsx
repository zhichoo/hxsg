import type { ReactNode } from 'react';

interface GameShellProps {
  children: ReactNode;
  toast?: string | null;
}

export function GameShell({ children, toast }: GameShellProps) {
  return (
    <div className="min-h-[100dvh] w-full bg-[#090a10] flex items-center justify-center sm:p-3">
      <div className="relative w-full max-w-[430px] h-[100dvh] sm:h-[min(780px,95dvh)] bg-black overflow-hidden flex flex-col sm:border-2 sm:border-[#5e4b25] sm:shadow-[0_0_32px_rgba(0,0,0,0.95)]">
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
