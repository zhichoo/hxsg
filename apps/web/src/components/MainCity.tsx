import { useState } from 'react';
import {
  MAPS,
  ROLE_CLASS_META,
  type CharacterView,
  type ChatChannel,
  type ChatMessage,
  type MapNpc,
  type OnlinePlayerSummary,
} from '@hxsg/shared';
import { AssetBg, AssetImg } from './AssetImg';
import { ChatDock } from './ChatDock';
import type { SubPanelType } from './SubPanels';

type MainTab = 'npc' | 'facility' | 'move' | 'func';

interface MainCityProps {
  character: CharacterView;
  mapPlayers: OnlinePlayerSummary[];
  messages: ChatMessage[];
  onSendChat: (channel: ChatChannel, content: string) => void;
  onMoveMap: (mapId: string) => void;
  onStartBattle: (enemyGroupId: string) => void;
  onRestInn: () => void;
  onOpenPanel: (panel: SubPanelType) => void;
  onLogout: () => void;
  onNotify: (msg: string) => void;
}

export function MainCity({
  character,
  mapPlayers,
  messages,
  onSendChat,
  onMoveMap,
  onStartBattle,
  onRestInn,
  onOpenPanel,
  onLogout,
  onNotify,
}: MainCityProps) {
  const [tab, setTab] = useState<MainTab>('npc');
  const [dialogue, setDialogue] = useState<{ npc: string; text: string } | null>(null);

  const currentMap = MAPS[character.mapId] ?? MAPS.xuchang;
  const classMeta = ROLE_CLASS_META[character.roleClass];
  const hpPct = Math.max(0, Math.min(100, (character.hp / character.maxHp) * 100));
  const mpPct = Math.max(0, Math.min(100, (character.mp / character.maxMp) * 100));
  const expRemain = Math.max(0, character.expToNext - character.exp);
  const activeGenerals = [0, 1, 2].map(
    (slot) => character.generals.find((g) => g.slot === slot) ?? null,
  );

  const mainQuests = character.quests?.mainQuests ?? [];
  const currentMainQuest =
    mainQuests.find((q) => q.status === 'ready') ??
    mainQuests.find((q) => q.status === 'active') ??
    mainQuests.find((q) => q.status === 'available') ??
    null;
  const paohuan = character.quests?.paohuan;

  const questTargetMaps = new Set<string>();
  if (currentMainQuest && currentMainQuest.status === 'active') {
    questTargetMaps.add(currentMainQuest.targetMapId);
  }
  if (paohuan && paohuan.status === 'active' && paohuan.targetMapId) {
    questTargetMaps.add(paohuan.targetMapId);
  }

  const handleNpcClick = (npc: MapNpc) => {
    if (npc.id === 'npc_main' || npc.id === 'npc_jingzhou_main') {
      onOpenPanel('quests');
      return;
    }
    if (npc.id === 'npc_paohuan') {
      onOpenPanel('paohuan');
      return;
    }
    if (
      npc.id === 'npc_taoyuan' &&
      currentMainQuest?.questId === 'main_02' &&
      (currentMainQuest.status === 'active' || currentMainQuest.status === 'ready')
    ) {
      onOpenPanel('quests');
      return;
    }
    if (npc.action === 'battle' && npc.enemyGroupId) {
      onStartBattle(npc.enemyGroupId);
    } else if (npc.dialogue) {
      setDialogue({ npc: npc.name, text: npc.dialogue });
    }
  };

  const getNpcBadge = (npc: MapNpc): { label: string; cls: string } => {
    if (npc.id === 'npc_main' || npc.id === 'npc_jingzhou_main') {
      if (currentMainQuest?.status === 'ready') {
        return { label: '可交!', cls: 'bg-[#1b7a2c] text-[#e6ffea] border-[#7dff92] animate-pulse' };
      }
      if (currentMainQuest?.status === 'available') {
        return { label: '可接!', cls: 'bg-[#b87612] text-[#fff6cc] border-[#ffe16b]' };
      }
      return { label: '主线', cls: 'bg-[#1a4dc2] text-white border-[#8bc0ff]' };
    }
    if (npc.id === 'npc_paohuan') {
      if (paohuan?.status === 'ready') {
        return { label: '交环!', cls: 'bg-[#1b7a2c] text-[#e6ffea] border-[#7dff92] animate-pulse' };
      }
      if (paohuan?.status === 'idle') {
        return { label: `第${paohuan.ring}环`, cls: 'bg-[#b87612] text-[#fff6cc] border-[#ffe16b]' };
      }
      return { label: '跑环', cls: 'bg-[#1a4dc2] text-white border-[#8bc0ff]' };
    }
    if (npc.action === 'battle') {
      const isBoss = npc.enemyGroupId?.startsWith('boss_');
      return {
        label: isBoss ? 'BOSS' : '战斗',
        cls: isBoss
          ? 'bg-[#8f0d46] text-[#ffe999] border-[#ff8bc8]'
          : 'bg-[#c41b1b] text-[#fff2a6] border-[#f4c653]',
      };
    }
    return { label: '对话', cls: 'bg-[#1a4dc2] text-white border-[#8bc0ff]' };
  };

  const funcItems: Array<{ label: string; onClick: () => void }> = [
    { label: '状态', onClick: () => onOpenPanel('status') },
    { label: '物品', onClick: () => onOpenPanel('items') },
    { label: '副将', onClick: () => onOpenPanel('generals') },
    { label: '任务', onClick: () => onOpenPanel('quests') },
    { label: '历练', onClick: () => onOpenPanel('daily') },
    { label: '跑环', onClick: () => onOpenPanel('paohuan') },
    { label: '天玄塔', onClick: () => onOpenPanel('tower') },
    { label: '赌坊', onClick: () => onOpenPanel('casino') },
    { label: '排行', onClick: () => onOpenPanel('rank') },
    { label: '招贤', onClick: () => onOpenPanel('tavern') },
    { label: '飞鸽', onClick: () => onOpenPanel('mail') },
    { label: '钱庄', onClick: () => onOpenPanel('bank') },
    { label: '集市', onClick: () => onOpenPanel('market') },
    { label: '客栈', onClick: () => onRestInn() },
    { label: 'GM', onClick: () => onOpenPanel('gm') },
    { label: '登出', onClick: onLogout },
  ];

  const tabAssets: Array<{ id: MainTab; normal: string; active: string; alt: string }> = [
    { id: 'npc', normal: 'gnk_1.png', active: 'gnk_s1.png', alt: '人物' },
    { id: 'facility', normal: 'gnk_2.png', active: 'gnk_s2.png', alt: '设施' },
    { id: 'move', normal: 'gnk_3.png', active: 'gnk_s3.png', alt: '移动' },
    { id: 'func', normal: 'gnk_4.png', active: 'gnk_s4.png', alt: '功能' },
  ];

  const rightTitleLabel: Record<MainTab, string> = {
    npc: '人物',
    facility: '设施',
    move: '移动',
    func: '功能',
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1b0c0c] overflow-hidden">
      {/* 1. Top Classic Location Header */}
      <AssetBg
        path="tit_bg.png"
        className="h-[38px] border-b border-[#4c6165] shrink-0"
      >
        <span className="absolute left-2 text-[10px] text-[#cfe3e6] bg-black/45 px-1.5 py-0.5 border border-[#5f7c80] truncate max-w-[96px]">
          {currentMap.region}
        </span>
        <span className="text-[17px] font-bold tracking-widest text-white hx-stroke">
          {currentMap.name}
        </span>
        <div className="absolute right-2 flex items-center gap-1.5">
          {character.unreadMailCount > 0 && (
            <button
              type="button"
              onClick={() => onOpenPanel('mail')}
              className="text-[10.5px] font-bold text-[#fff4b8] bg-[#b82018] px-1.5 py-0.5 border border-[#ffe26b] animate-pulse"
              title="有未读飞鸽传书"
            >
              ✉ {character.unreadMailCount}
            </button>
          )}
          <span className="text-[10px] text-[#cfe3e6] bg-black/45 px-1.5 py-0.5 border border-[#5f7c80]">
            {currentMap.recommendedLevel}
          </span>
        </div>
      </AssetBg>

      {/* 2. Main Split Panel: Left Hero Info + Right Function/NPC/Move/Facility */}
      <div className="grid grid-cols-[44%_56%] bg-[#2d0c09] border-b border-[#5e3b1b] shrink-0">
        {/* LEFT COLUMN */}
        <div className="p-1.5 flex flex-col gap-1.5 bg-gradient-to-b from-[#3f140d] to-[#230906] border-r border-[#805c22]">
          {/* Avatar + Name + HP/MP bars over real sc_bg_1.png */}
          <div className="flex flex-col">
            <div className="relative w-full aspect-[482/205]">
              <AssetImg
                path="sc_bg_1.png"
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-top pixelated"
              />
              {/* Character Portrait inside golden circle (switches to official rebirth head icon after 1转!) */}
              <AssetImg
                path={
                  character.rebirth > 0
                    ? `${
                        character.roleClass === 'wushi'
                          ? 'r1z'
                          : character.roleClass === 'wenren'
                            ? 'r2z'
                            : 'r3z'
                      }${character.gender === 'female' ? 'n' : ''}_h.png`
                    : `portraits/${character.portrait}`
                }
                alt={character.name}
                className="absolute left-[9%] top-[27%] w-[21%] aspect-square rounded-full object-cover pixelated border border-[#734a13]"
              />
              {/* Name */}
              <div className="absolute left-[35%] top-[5%] right-[4%] text-[13px] font-bold text-[#fff8cc] truncate hx-stroke">
                {character.rebirth > 0 ? `[${character.rebirth}转]` : ''}
                {character.name}
              </div>
              {/* HP Bar */}
              <div className="absolute left-[35%] top-[37%] right-[5%] h-[14%] bg-[#1a0505] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#b81212] via-[#ef2c1a] to-[#ff6742]"
                  style={{ width: `${hpPct}%` }}
                />
              </div>
              {/* MP Bar */}
              <div className="absolute left-[35%] top-[59%] right-[5%] h-[14%] bg-[#061029] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#1131a8] via-[#2262e8] to-[#5aa8ff]"
                  style={{ width: `${mpPct}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between text-[11px] font-bold text-[#fff2d1] bg-[#160705] border border-[#6e4c1d] px-1.5 py-0.5">
              <span>血 {character.hp}/{character.maxHp}</span>
              <span className="text-[#99d0ff]">精 {character.mp}/{character.maxMp}</span>
            </div>
          </div>

          {/* 3 General Slots using real sc_fjbg.png */}
          <button
            type="button"
            onClick={() => onOpenPanel('generals')}
            className="relative w-full aspect-[441/117] group"
            title="点击管理出战副将"
          >
            <AssetImg
              path="sc_fjbg.png"
              alt="副将槽位"
              className="w-full h-full object-contain pixelated"
            />
            <div className="absolute inset-0 grid grid-cols-3 px-[8.5%] py-[10%] gap-1.5 items-center">
              {activeGenerals.map((g, idx) => (
                <div
                  key={idx}
                  className="w-full h-full flex items-center justify-center overflow-hidden"
                >
                  {g && (
                    <AssetImg
                      path={
                        g.avatarKey.startsWith('f')
                          ? g.avatarKey
                          : `portraits/${g.avatarKey}`
                      }
                      alt={g.name}
                      className="w-[82%] aspect-square rounded-full object-cover pixelated border border-[#e6be56] shadow-[0_1px_2px_#000]"
                    />
                  )}
                </div>
              ))}
            </div>
          </button>

          {/* Black Gold-Bordered Character Stats Box (matches classic_3.jpg) */}
          <div className="flex-1 bg-[#140d09] border-2 border-[#b9964e] p-1.5 text-[12px] leading-[1.45] flex flex-col justify-between">
            <div>
              <div className="text-white font-bold">
                职业:{character.level}级{classMeta.label}
              </div>
              <div className="text-[#e8e8e8]">银:{character.silver}</div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-[#ffe04b] font-bold">金:{character.gold}</span>
                <button
                  type="button"
                  onClick={() => onOpenPanel('gm')}
                  className="px-1.5 py-0.5 bg-[#c71a1a] text-white text-[11px] font-bold border border-[#ffb870] hover:brightness-110"
                >
                  福利GM
                </button>
              </div>
            </div>
            <div className="pt-1 border-t border-white/15">
              <div className="flex items-center justify-between text-[11px] text-[#f0e6cc]">
                <span>升级还需经验:</span>
                {(character.alloc.freePoints > 0 || character.resist.freePoints > 0) && (
                  <button
                    type="button"
                    onClick={() => onOpenPanel('status')}
                    className="px-1.5 py-0.5 bg-[#1b6e29] border border-[#7cff90] text-[#e6ffe9] text-[10px] font-bold animate-pulse"
                  >
                    可加点!
                  </button>
                )}
              </div>
              <div className="text-center text-[#ffe678] font-bold text-[13px]">{expRemain}</div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (sc_bg_5 dark crimson gold-corner frame) */}
        <div
          className="relative p-2 flex flex-col justify-between min-h-[246px] bg-[#4a120d]"
          style={{
            border: '2px solid #c99d3b',
            boxShadow: 'inset 0 0 0 2px #2a0906',
          }}
        >
          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto hx-scroll space-y-1.5 pr-0.5">
            {tab === 'npc' && (
              <>
                {character.daily?.worldBoss?.mapId === currentMap.id && (
                  <button
                    type="button"
                    onClick={() => onOpenPanel('daily')}
                    className="w-full flex items-center justify-between px-2 py-1.5 bg-[#471035]/90 border border-[#f5c249] hover:bg-[#66194d] transition text-left"
                  >
                    <span className="text-[13px] font-bold text-[#ffe985] hx-stroke truncate pr-1">
                      ★【{character.daily.worldBoss.title}】{character.daily.worldBoss.bossName}
                    </span>
                    <span className="px-2 py-0.5 text-[10.5px] font-bold border bg-[#99153a] text-[#fff2a6] border-[#ffca63] shrink-0">
                      {character.daily.worldBoss.claimedToday ? '已领奖' : '整点杀星'}
                    </span>
                  </button>
                )}
                {currentMap.npcs.map((npc) => {
                  const badge = getNpcBadge(npc);
                  return (
                    <button
                      key={npc.id}
                      type="button"
                      onClick={() => handleNpcClick(npc)}
                      className="w-full flex items-center justify-between px-2 py-1.5 bg-[#2a0a07]/80 border-b border-[#a67c32]/40 hover:bg-[#5e1b13] transition text-left"
                    >
                      <span className="text-[14px] font-bold text-white hx-stroke truncate pr-1">
                        {npc.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[11px] font-bold border shrink-0 ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </button>
                  );
                })}
                {currentMap.npcs.length === 0 && (
                  <div className="text-xs text-[#e0c4a0] py-4 text-center">此处空无一人</div>
                )}
              </>
            )}

            {tab === 'facility' && (
              <>
                {currentMap.facilities.map((fac) => (
                  <button
                    key={fac.id}
                    type="button"
                    onClick={() => {
                      if (fac.kind === 'inn') onRestInn();
                      else if (fac.kind === 'pharmacy') onOpenPanel('shop');
                      else if (fac.kind === 'blacksmith') onOpenPanel('blacksmith');
                      else if (fac.kind === 'tavern') onOpenPanel('tavern');
                      else if (fac.kind === 'tower') onOpenPanel('tower');
                      else if (fac.kind === 'daily') onOpenPanel('daily');
                      else if (fac.kind === 'casino') onOpenPanel('casino');
                      else if (fac.kind === 'bank') onOpenPanel('bank');
                      else if (fac.kind === 'market') onOpenPanel('market');
                      else if (fac.kind === 'gm') onOpenPanel('gm');
                    }}
                    className="w-full flex items-center gap-2 px-1.5 py-1.5 bg-[#2b0b07]/85 border border-[#8d6728] hover:bg-[#5b1d12] text-left"
                  >
                    <AssetImg
                      path={fac.icon}
                      alt={fac.name}
                      className="w-9 h-8 object-contain pixelated shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-[#ffe67e] truncate">
                        {fac.name}
                      </div>
                      <div className="text-[10.5px] text-[#e7cfbb] truncate">{fac.desc}</div>
                    </div>
                  </button>
                ))}
                {currentMap.facilities.length === 0 && (
                  <div className="text-xs text-[#e0c4a0] py-5 text-center">
                    野外荒郊暂无城池设施，可点「移动」回许昌或洛阳。
                  </div>
                )}
              </>
            )}

            {tab === 'move' && (
              <>
                {currentMap.neighbors.map((nid) => {
                  const target = MAPS[nid];
                  if (!target) return null;
                  return (
                    <button
                      key={nid}
                      type="button"
                      onClick={() => onMoveMap(nid)}
                      className="w-full flex items-center justify-between px-2 py-1.5 bg-[#2b0b07]/85 border border-[#8d6728] hover:bg-[#5c1e12]"
                    >
                      <div className="flex items-center gap-2">
                        <AssetImg
                          path={target.thumb}
                          alt=""
                          className="w-6 h-5 object-contain pixelated"
                        />
                        <div className="text-left">
                          <div className="text-[13px] font-bold text-white hx-stroke flex items-center gap-1">
                            <span>{target.name}</span>
                            {questTargetMaps.has(nid) && (
                              <span className="text-[9.5px] px-1 bg-[#1b6e29] border border-[#7cff90] text-[#e6ffe9] font-bold">
                                任务
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#e0c29e]">{target.region}</div>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 border ${
                          target.isSafe
                            ? 'bg-[#1b4a26] border-[#6bd182] text-[#c8ffcf]'
                            : 'bg-[#6b1a12] border-[#f0a050] text-[#ffe0a8]'
                        }`}
                      >
                        {target.recommendedLevel}
                      </span>
                    </button>
                  );
                })}
              </>
            )}

            {tab === 'func' && (
              <div className="grid grid-cols-3 gap-x-1 gap-y-2 pt-0.5">
                {funcItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    className="hx-pennant h-[29px] flex items-center justify-center pr-2 hover:brightness-110 active:scale-95"
                  >
                    <span className="text-[13px] font-black text-white hx-stroke">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bottom-right Classic Blue-Outlined Section Title */}
          <div className="pt-1 flex items-center justify-between border-t border-[#a97d2e]/40">
            <span className="text-[11px] text-[#f7e4c8] truncate max-w-[125px]">
              {currentMap.desc}
            </span>
            <span className="text-[20px] font-black italic tracking-wider text-[#f3faff] hx-stroke-blue shrink-0 leading-none">
              {rightTitleLabel[tab]}
            </span>
          </div>
        </div>
      </div>

      {/* 2.5 Compact Quest Tracker Strip */}
      {(currentMainQuest || (paohuan && paohuan.status !== 'idle')) && (
        <button
          type="button"
          onClick={() =>
            onOpenPanel(
              paohuan?.status === 'ready'
                ? 'paohuan'
                : currentMainQuest?.status === 'ready'
                  ? 'quests'
                  : currentMainQuest
                    ? 'quests'
                    : 'paohuan',
            )
          }
          className="h-[25px] px-2 bg-[#1c0c1f] border-b border-[#7c5c28] flex items-center justify-between gap-2 text-[11px] hover:bg-[#2c1232] shrink-0 text-left"
        >
          <span className="truncate text-[#ffe899] font-bold">
            {paohuan?.status === 'ready'
              ? `📜 跑环第${paohuan.ring}环已完成！点击领奖`
              : currentMainQuest
                ? currentMainQuest.status === 'ready'
                  ? `📜 主线【${currentMainQuest.title}】已达成！点击领奖`
                  : currentMainQuest.status === 'available'
                    ? `📜 新主线可接：第${currentMainQuest.chapter}章·${currentMainQuest.title}`
                    : `📜 主线·${currentMainQuest.title}：${currentMainQuest.targetMapName}·${currentMainQuest.targetName} (${currentMainQuest.progress}/${currentMainQuest.requiredCount})`
                : paohuan && paohuan.status === 'active'
                  ? `📜 跑环第${paohuan.ring}环：${paohuan.targetName} (${paohuan.progress}/${paohuan.requiredCount})`
                  : ''}
          </span>
          <span className="text-[10px] px-1.5 bg-[#4a1a52] border border-[#c89b3c] text-[#fff0ad] shrink-0">
            任务卷轴
          </span>
        </button>
      )}

      {/* 3. Classic 4 Main Tab Buttons using REAL official PNGs (gnk_1..4 & gnk_s1..4) */}
      <div className="grid grid-cols-4 bg-black border-b border-[#5c4820] shrink-0">
        {tabAssets.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className="relative h-[46px] bg-black overflow-hidden active:brightness-90"
            >
              <AssetImg
                path={active ? t.active : t.normal}
                alt={t.alt}
                className="w-full h-full object-fill pixelated"
              />
            </button>
          );
        })}
      </div>

      {/* 4. Same-Map Online Players Pixel Avatar Strip (matches classic_3.jpg) */}
      <div className="h-[34px] px-2 bg-[#080708] border-b border-[#3c4d50] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {mapPlayers.slice(0, 7).map((p) => (
            <div
              key={p.id}
              title={`${p.name} (Lv.${p.level})`}
              className="flex items-center gap-0.5 bg-[#1b191d] border border-[#5c4e32] px-1 py-0.5"
            >
              <AssetImg
                path={p.avatarSprite}
                alt={p.name}
                className="w-5 h-5 pixelated"
              />
            </div>
          ))}
          {mapPlayers.length === 0 && (
            <span className="text-[11px] text-[#7c8a8c]">当前地图仅你一人</span>
          )}
        </div>
        <span className="text-[12px] text-[#9eb6ff] font-bold shrink-0">
          在线({mapPlayers.length})
        </span>
      </div>

      {/* 5. Bottom Real-Time Chat Dock (区 派 商 世) */}
      <ChatDock messages={messages} onSend={onSendChat} />

      {/* NPC Dialogue Modal */}
      {dialogue && (
        <div
          className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setDialogue(null)}
        >
          <div
            className="w-full max-w-[330px] bg-[#2e0c36] border-2 border-[#e0b850] p-3.5 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center text-[#ffe26b] font-bold text-base border-b border-[#9e7430] pb-1.5">
              {dialogue.npc}
            </div>
            <p className="text-[13px] text-[#f5e7fa] leading-relaxed">{dialogue.text}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setDialogue(null)}
                className="hx-btn-gold px-4 py-1 text-xs"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
