import { useEffect, useRef, useState } from 'react';
import { CLASSIC_EMOJIS, type ChatChannel, type ChatMessage } from '@hxsg/shared';
import { AssetImg } from './AssetImg';

interface ChatDockProps {
  messages: ChatMessage[];
  onSend: (channel: ChatChannel, content: string, recipientName?: string) => void;
  compact?: boolean;
  whisperTarget?: string | null;
  onClearWhisper?: () => void;
  onClickPlayer?: (characterId: number, name: string) => void;
}

const CHANNELS: Array<{ id: ChatChannel; label: string }> = [
  { id: 'qu', label: '区' },
  { id: 'pai', label: '派' },
  { id: 'shang', label: '商' },
  { id: 'shi', label: '世' },
  { id: 'si', label: '私' },
];

const EMOJI_SET = new Set(CLASSIC_EMOJIS.map((e) => e.code));

function renderChatContent(content: string) {
  const parts = content.split(/(\[f\d{3}\])/g);
  return parts.map((part, idx) => {
    const m = /^\[(f\d{3})\]$/.exec(part);
    if (m && EMOJI_SET.has(m[1])) {
      return (
        <AssetImg
          key={idx}
          path={`${m[1]}.png`}
          alt={part}
          className="inline-block w-[18px] h-[18px] align-text-bottom mx-0.5 pixelated"
        />
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export function ChatDock({
  messages,
  onSend,
  compact = false,
  whisperTarget,
  onClearWhisper,
  onClickPlayer,
}: ChatDockProps) {
  const [channel, setChannel] = useState<ChatChannel>('qu');
  const [inputOpen, setInputOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [text, setText] = useState('');
  const [recipient, setRecipient] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (whisperTarget) {
      setChannel('si');
      setRecipient(whisperTarget);
      setInputOpen(true);
    }
  }, [whisperTarget]);

  const filtered = messages.filter((m) => {
    if (channel === 'qu') return true;
    if (channel === 'si') return m.channel === 'si';
    return m.channel === channel || m.isSystem;
  });

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [filtered.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = text.trim();
    if (!val) return;
    if (channel === 'si') {
      const targetName = recipient.trim();
      if (!targetName) return;
      onSend('si', val, targetName);
    } else {
      onSend(channel, val);
    }
    setText('');
    setEmojiOpen(false);
    setInputOpen(false);
    if (whisperTarget && onClearWhisper) onClearWhisper();
  };

  const insertEmoji = (code: string) => {
    setText((prev) => `${prev}[${code}]`.slice(0, 120));
    setInputOpen(true);
  };

  return (
    <div className="relative flex flex-col border-t border-[#4b5f63] bg-[#2a3335]">
      {/* Top tab strip: 快捷键 + 区 派 商 世 私 */}
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
                className={`h-full px-3 text-[13px] font-bold transition ${
                  active
                    ? c.id === 'si'
                      ? 'bg-[#7d267c] text-[#ffe9ff] hx-stroke border-t border-x border-[#e598e3]'
                      : 'bg-[#6e7d80] text-white hx-stroke border-t border-x border-[#9cb0b3]'
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
              {channel === 'si'
                ? '暂无私聊记录，点击地图玩家或好友即可发起密语。'
                : '欢迎进入三国世界，点右侧「发言」发送聊天或表情。'}
            </div>
          ) : (
            filtered.slice(-36).map((m) => (
              <div key={m.id} className="break-words">
                <span className="text-[#c2d4d6] mr-1">{m.time}</span>
                {m.isSystem ? (
                  <>
                    <span className="text-[#ff6b6b] font-bold">【系统】</span>
                    <span className="text-[#ffec8b]">{renderChatContent(m.content)}</span>
                  </>
                ) : m.channel === 'si' ? (
                  <>
                    <span className="text-[#ff9ef2] font-bold mr-0.5">[私]</span>
                    <button
                      type="button"
                      onClick={() => m.senderId > 0 && onClickPlayer?.(m.senderId, m.senderName)}
                      className="text-[#ffb8f6] font-bold hover:underline"
                    >
                      {m.senderName}
                    </button>
                    {m.recipientName && (
                      <span className="text-[#d9a8db]"> → {m.recipientName}</span>
                    )}
                    <span className="text-[#ffe6fc] ml-1">{renderChatContent(m.content)}</span>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => m.senderId > 0 && onClickPlayer?.(m.senderId, m.senderName)}
                      className="text-[#dcff63] font-bold hover:underline"
                    >
                      {m.senderName}:
                    </button>
                    <span className="text-[#ffffff] ml-1">{renderChatContent(m.content)}</span>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Classic vertical 发言 button */}
        <button
          type="button"
          onClick={() => {
            setInputOpen((v) => !v);
            setEmojiOpen(false);
          }}
          title="发送消息"
          className="relative z-10 w-[42px] shrink-0 bg-[#1a2426]/80 flex items-center justify-center border-l border-[#475d61] hover:brightness-110 active:scale-95"
        >
          <AssetImg path="chat_fy.png" alt="发言" className="w-[34px] h-auto pixelated" />
        </button>
      </div>

      {/* Classic 24-emoji picker popover (f000 ~ f023) */}
      {inputOpen && emojiOpen && (
        <div className="p-1.5 bg-[#151d20] border-t border-[#c89c3b] grid grid-cols-8 gap-1">
          {CLASSIC_EMOJIS.map((em) => (
            <button
              key={em.code}
              type="button"
              title={em.label}
              onClick={() => insertEmoji(em.code)}
              className="flex items-center justify-center p-1 bg-[#222f33] hover:bg-[#3a4d54] border border-[#4a6269]"
            >
              <AssetImg path={em.file} alt={em.label} className="w-[20px] h-[20px] pixelated" />
            </button>
          ))}
        </div>
      )}

      {/* Inline input drawer when 发言 clicked */}
      {inputOpen && (
        <form
          onSubmit={submit}
          className="flex items-center gap-1 p-1.5 bg-[#12191b] border-t border-[#c89c3b]"
        >
          <span className="px-1.5 py-0.5 text-[11px] bg-[#304245] text-[#ffe57d] border border-[#6c868a] shrink-0">
            {CHANNELS.find((c) => c.id === channel)?.label}
          </span>
          {channel === 'si' && (
            <input
              type="text"
              maxLength={12}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="对方名号"
              className="w-[74px] px-1.5 py-1 bg-black border border-[#a85aa6] text-xs text-[#ffbdf8] focus:outline-none focus:border-[#ff8ef7] shrink-0"
            />
          )}
          <button
            type="button"
            onClick={() => setEmojiOpen((v) => !v)}
            title="插入原版表情"
            className={`px-1.5 py-0.5 border shrink-0 flex items-center justify-center ${
              emojiOpen
                ? 'bg-[#805514] border-[#ffe16b]'
                : 'bg-[#243236] border-[#5c7478] hover:brightness-110'
            }`}
          >
            <AssetImg path="chat_bq.png" alt="表情" className="w-[18px] h-[18px] pixelated" />
          </button>
          <input
            autoFocus
            type="text"
            maxLength={120}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={channel === 'si' ? '输入私聊内容...' : '输入聊天内容，回车发送...'}
            className="flex-1 min-w-0 px-2 py-1 bg-black border border-[#5c7478] text-xs text-white focus:outline-none focus:border-[#ffd85c]"
          />
          <button type="submit" className="hx-btn-gold px-2.5 py-1 text-xs shrink-0">
            发送
          </button>
        </form>
      )}
    </div>
  );
}
