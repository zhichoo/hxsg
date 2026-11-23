import { useEffect, useRef, useState } from 'react';
import type { ChatChannel, ChatMessage } from '@hxsg/shared';
import { AssetImg } from './AssetImg';

interface ChatDockProps {
  messages: ChatMessage[];
  onSend: (channel: ChatChannel, content: string) => void;
  compact?: boolean;
}

const CHANNELS: Array<{ id: ChatChannel; label: string }> = [
  { id: 'qu', label: '区' },
  { id: 'pai', label: '派' },
  { id: 'shang', label: '商' },
  { id: 'shi', label: '世' },
];

export function ChatDock({ messages, onSend, compact = false }: ChatDockProps) {
  const [channel, setChannel] = useState<ChatChannel>('qu');
  const [inputOpen, setInputOpen] = useState(false);
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  const filtered = messages.filter((m) => channel === 'qu' || m.channel === channel || m.isSystem);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [filtered.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = text.trim();
    if (!val) return;
    onSend(channel, val);
    setText('');
    setInputOpen(false);
  };

  return (
    <div className="relative flex flex-col border-t border-[#4b5f63] bg-[#2a3335]">
      {/* Top tab strip: 快捷键 + 区 派 商 世 (matches classic_3.jpg) */}
      <div className="flex items-center justify-between h-[26px] bg-[#1e2628] border-b border-[#46595d]">
        <div className="h-full px-3 flex items-center bg-gradient-to-b from-[#d98424] to-[#9b4c0e] text-[#ffefab] text-[12px] font-bold [clip-path:polygon(0_0,100%_0,88%_100%,0_100%)] pr-5">
          快捷键
        </div>
        <div className="flex items-center h-full">
          {CHANNELS.map((c) => {
            const active = c.id === channel;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setChannel(c.id)}
                className={`h-full px-3.5 text-[13px] font-bold transition ${
                  active
                    ? 'bg-[#6e7d80] text-white hx-stroke border-t border-x border-[#9cb0b3]'
                    : 'bg-[#2a3436] text-[#c7d3d5] hover:text-white'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrolling chat body + vertical 发言 button */}
      <div
        className={`relative flex overflow-hidden ${compact ? 'h-[98px]' : 'flex-1 min-h-[110px]'}`}
      >
        <AssetImg
          path="chat_bgb.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover pixelated"
        />
        <div
          ref={listRef}
          className="relative z-10 flex-1 overflow-y-auto hx-scroll px-2 py-1 space-y-0.5 text-[13px] leading-[1.4] bg-[#141c1e]/88"
        >
          {filtered.length === 0 ? (
            <div className="text-[#c8dcde] text-xs py-1">
              欢迎进入三国世界，点右侧「发言」发送聊天消息。
            </div>
          ) : (
            filtered.slice(-30).map((m) => (
              <div key={m.id} className="break-words">
                <span className="text-[#c2d4d6] mr-1">{m.time}</span>
                {m.isSystem ? (
                  <>
                    <span className="text-[#ff6b6b] font-bold">【系统】</span>
                    <span className="text-[#ffec8b]">{m.content}</span>
                  </>
                ) : (
                  <>
                    <span className="text-[#dcff63] font-bold">{m.senderName}:</span>
                    <span className="text-[#ffffff] ml-1">{m.content}</span>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Classic vertical 发言 button */}
        <button
          type="button"
          onClick={() => setInputOpen((v) => !v)}
          title="发送消息"
          className="relative z-10 w-[42px] shrink-0 bg-[#1a2426]/80 flex items-center justify-center border-l border-[#475d61] hover:brightness-110 active:scale-95"
        >
          <AssetImg
            path="chat_fy.png"
            alt="发言"
            className="w-[34px] h-auto pixelated"
          />
        </button>
      </div>

      {/* Inline input drawer when 发言 clicked */}
      {inputOpen && (
        <form
          onSubmit={submit}
          className="flex items-center gap-1.5 p-1.5 bg-[#12191b] border-t border-[#c89c3b]"
        >
          <span className="px-1.5 py-0.5 text-[11px] bg-[#304245] text-[#ffe57d] border border-[#6c868a]">
            {CHANNELS.find((c) => c.id === channel)?.label}
          </span>
          <input
            autoFocus
            type="text"
            maxLength={120}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="输入聊天内容，回车发送..."
            className="flex-1 px-2 py-1 bg-black border border-[#5c7478] text-xs text-white focus:outline-none focus:border-[#ffd85c]"
          />
          <button type="submit" className="hx-btn-gold px-3 py-1 text-xs">
            发送
          </button>
        </form>
      )}
    </div>
  );
}
