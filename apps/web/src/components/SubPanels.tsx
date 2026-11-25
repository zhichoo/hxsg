import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CRAFT_RECIPES,
  EQUIPMENT_SLOT_LABELS,
  EQUIPMENT_TEMPLATES,
  findMapPath,
  formatMapRoute,
  GENERAL_SKILL_BOOKS,
  GENERAL_TEMPLATES,
  getTowerFloorMeta,
  ITEMS,
  MAPS,
  ROLE_CLASS_META,
  type BattleState,
  type CasinoStateView,
  type CharacterView,
  type EquipmentQuality,
  type EquipmentSlot,
  type EquipmentView,
  type FriendView,
  type MailView,
  type MarketListingKind,
  type MarketListingView,
  type PlayerInspectView,
  type RankEntry,
  type TreasureDigResult,
} from '@hxsg/shared';
import { api } from '../api';
import { AssetBg, AssetImg } from './AssetImg';
import { PixelSprite } from './PixelSprite';

export type SubPanelType =
  | 'status'
  | 'items'
  | 'generals'
  | 'quests'
  | 'paohuan'
  | 'daily'
  | 'tower'
  | 'casino'
  | 'bank'
  | 'market'
  | 'mail'
  | 'friends'
  | 'inspect'
  | 'rank'
  | 'shop'
  | 'blacksmith'
  | 'tavern'
  | 'notice';

const QUALITY_COLOR: Record<EquipmentQuality, string> = {
  common: 'text-white',
  fine: 'text-[#7dff92]',
  rare: 'text-[#74c9ff]',
  legend: 'text-[#ffbe47]',
};

const QUALITY_LABEL: Record<EquipmentQuality, string> = {
  common: '普通',
  fine: '精良',
  rare: '极品',
  legend: '神兵',
};

const EQUIP_SLOTS: EquipmentSlot[] = ['weapon', 'helmet', 'armor', 'boots', 'mount'];

function formatEquipStats(eq: {
  hpBonus?: number;
  mpBonus?: number;
  atkBonus?: number;
  defBonus?: number;
  spdBonus?: number;
  resPhys?: number;
  resChaos?: number;
  resSeal?: number;
  resTrap?: number;
  resMagic?: number;
}): string {
  const parts: string[] = [];
  if (eq.atkBonus) parts.push(`攻+${eq.atkBonus}`);
  if (eq.hpBonus) parts.push(`血+${eq.hpBonus}`);
  if (eq.mpBonus) parts.push(`精+${eq.mpBonus}`);
  if (eq.defBonus) parts.push(`防+${eq.defBonus}`);
  if (eq.spdBonus) parts.push(`速+${eq.spdBonus}`);
  if (eq.resPhys) parts.push(`抗物+${eq.resPhys}%`);
  if (eq.resChaos) parts.push(`抗乱+${eq.resChaos}%`);
  if (eq.resSeal) parts.push(`抗封+${eq.resSeal}%`);
  if (eq.resTrap) parts.push(`抗围+${eq.resTrap}%`);
  if (eq.resMagic) parts.push(`抗法+${eq.resMagic}%`);
  return parts.join(' · ') || '基础属性';
}

interface SubPanelsProps {
  panel: SubPanelType;
  realmId: string;
  character: CharacterView;
  inspectPlayerId?: number | null;
  onInspectPlayer?: (characterId: number) => void;
  onStartWhisper?: (name: string) => void;
  onUpdateCharacter: (ch: CharacterView) => void;
  onEnterBattle?: (battle: BattleState) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

const TITLES: Record<SubPanelType, string> = {
  status: '人物状态',
  items: '行囊与装备',
  generals: '副将营帐',
  quests: '任务卷轴',
  paohuan: '许昌跑环',
  daily: '每日历练',
  tower: '天玄塔试炼',
  casino: '许昌赌坊',
  bank: '许昌钱庄',
  market: '许昌集市',
  mail: '飞鸽传书',
  friends: '江湖好友',
  inspect: '侠士资料',
  rank: '排行榜与擂台',
  shop: '回春药铺',
  blacksmith: '铁匠铺与马市',
  tavern: '许昌招贤馆',
  notice: '游戏公告',
};

export function SubPanels({
  panel,
  realmId,
  character,
  inspectPlayerId,
  onInspectPlayer,
  onStartWhisper,
  onUpdateCharacter,
  onEnterBattle,
  onClose,
  onNotify,
}: SubPanelsProps) {
  const [statusTab, setStatusTab] = useState<'stats' | 'resist' | 'skills'>('stats');
  const [bagTab, setBagTab] = useState<'equip' | 'consumable'>('equip');
  const [smithTab, setSmithTab] = useState<'gear' | 'mount' | 'craft'>('gear');
  const [tavernTab, setTavernTab] = useState<'recruit' | 'books'>('recruit');
  const [learningGenId, setLearningGenId] = useState<number | null>(null);
  const [friends, setFriends] = useState<FriendView[]>([]);
  const [friendNameInput, setFriendNameInput] = useState('');
  const [inspectedPlayer, setInspectedPlayer] = useState<PlayerInspectView | null>(null);
  const [questTab, setQuestTab] = useState<'main' | 'paohuan'>(
    panel === 'paohuan' ? 'paohuan' : 'main',
  );
  const [dailyTab, setDailyTab] = useState<'keju' | 'escort' | 'worldboss'>('keju');
  const [kejuFeedback, setKejuFeedback] = useState<{
    correct: boolean;
    message: string;
    explanation: string;
  } | null>(null);
  const [casinoTab, setCasinoTab] = useState<'dice' | 'chibi'>('dice');
  const [casinoRecordTab, setCasinoRecordTab] = useState<'history' | 'mybets' | 'winners'>('history');
  const [betCurrency, setBetCurrency] = useState<'silver' | 'gold'>('silver');
  const [betAmount, setBetAmount] = useState<number>(200);
  const [casinoState, setCasinoState] = useState<CasinoStateView | null>(null);
  const [casinoClockOffset, setCasinoClockOffset] = useState<number>(0);
  const [casinoNow, setCasinoNow] = useState<number>(() => Date.now());
  const pendingCasinoBetIdsRef = useRef<Set<number>>(new Set());
  const lastCasinoFetchRef = useRef<number>(0);
  const [bankAmount, setBankAmount] = useState<string>('500');
  const [marketTab, setMarketTab] = useState<'browse' | 'sell' | 'mine'>('browse');
  const [marketFilter, setMarketFilter] = useState<'all' | MarketListingKind>('all');
  const [listings, setListings] = useState<MarketListingView[]>([]);
  const [sellKind, setSellKind] = useState<MarketListingKind>('equipment');
  const [sellCurrency, setSellCurrency] = useState<'silver' | 'gold'>('silver');
  const [sellPrice, setSellPrice] = useState<string>('500');
  const [mailTab, setMailTab] = useState<'inbox' | 'compose'>('inbox');
  const [mails, setMails] = useState<MailView[]>([]);
  const [mailTo, setMailTo] = useState<string>('');
  const [mailSubject, setMailSubject] = useState<string>('');
  const [mailBody, setMailBody] = useState<string>('');
  const [mailSilver, setMailSilver] = useState<string>('0');
  const [mailGold, setMailGold] = useState<string>('0');
  const [digResult, setDigResult] = useState<TreasureDigResult | null>(null);
  const [rankSort, setRankSort] = useState<'level' | 'silver' | 'gold'>('level');
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (panel === 'paohuan') setQuestTab('paohuan');
    else if (panel === 'quests') setQuestTab('main');
  }, [panel]);

  const syncCasinoState = useCallback(
    async (silent = false) => {
      const now = Date.now();
      lastCasinoFetchRef.current = now;
      try {
        const res = await api.getCasinoState(realmId);
        const allRecent = [...res.state.dice.myRecentBets, ...res.state.chibi.myRecentBets];
        const prevPending = pendingCasinoBetIdsRef.current;
        if (prevPending.size > 0) {
          const settledNow = allRecent.filter(
            (b) => prevPending.has(b.id) && b.status !== 'pending',
          );
          if (settledNow.length > 0) {
            let wonSilver = 0;
            let wonGold = 0;
            let winCount = 0;
            for (const b of settledNow) {
              if (b.status === 'won') {
                winCount += 1;
                if (b.currency === 'gold') wonGold += b.payout;
                else wonSilver += b.payout;
              }
            }
            const roundLabel = `第 ${settledNow[0].roundNo} 期`;
            if (winCount > 0) {
              const parts: string[] = [];
              if (wonSilver > 0) parts.push(`${wonSilver} 银两`);
              if (wonGold > 0) parts.push(`${wonGold} 金砖`);
              onNotify(`🎲 赌坊${roundLabel}已开奖！恭喜中奖，派彩 ${parts.join(' + ')}！`);
            } else {
              onNotify(`🎲 赌坊${roundLabel}已开奖，遗憾未中，再接再厉！`);
            }
          }
        }
        pendingCasinoBetIdsRef.current = new Set(
          allRecent.filter((b) => b.status === 'pending').map((b) => b.id),
        );
        setCasinoState(res.state);
        setCasinoClockOffset(res.state.serverNow - Date.now());
        onUpdateCharacter(res.character);
      } catch (err) {
        if (!silent) {
          onNotify(err instanceof Error ? err.message : '获取赌坊盘口失败');
        }
      }
    },
    [realmId, onNotify, onUpdateCharacter],
  );

  useEffect(() => {
    if (panel !== 'casino') return;
    void syncCasinoState(false);
    const tick = window.setInterval(() => {
      setCasinoNow(Date.now());
    }, 1000);
    const poll = window.setInterval(() => {
      void syncCasinoState(true);
    }, 10_000);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [panel, syncCasinoState]);

  useEffect(() => {
    if (panel !== 'casino' || !casinoState) return;
    const estServerNow = casinoNow + casinoClockOffset;
    const diceDue = estServerNow >= casinoState.dice.currentRound.drawAt + 350;
    const chibiDue = estServerNow >= casinoState.chibi.currentRound.drawAt + 350;
    if ((diceDue || chibiDue) && Date.now() - lastCasinoFetchRef.current >= 1200) {
      void syncCasinoState(true);
    }
  }, [panel, casinoNow, casinoClockOffset, casinoState, syncCasinoState]);

  useEffect(() => {
    if (panel === 'rank') {
      api
        .getRankings(realmId, rankSort)
        .then((r) => setRankings(r.rankings))
        .catch((e: Error) => onNotify(e.message));
    }
    if (panel === 'market') {
      api
        .getMarketListings(realmId, marketTab === 'mine' ? 'all' : marketFilter)
        .then((r) => setListings(r.listings))
        .catch((e: Error) => onNotify(e.message));
    }
    if (panel === 'mail') {
      api
        .getMails(realmId)
        .then((r) => setMails(r.mails))
        .catch((e: Error) => onNotify(e.message));
    }
    if (panel === 'friends') {
      api
        .getFriends(realmId)
        .then((r) => setFriends(r.friends))
        .catch((e: Error) => onNotify(e.message));
    }
    if (panel === 'inspect' && inspectPlayerId) {
      setInspectedPlayer(null);
      api
        .inspectPlayer(realmId, inspectPlayerId)
        .then((r) => setInspectedPlayer(r.player))
        .catch((e: Error) => onNotify(e.message));
    }
  }, [panel, realmId, rankSort, marketFilter, marketTab, inspectPlayerId, onNotify]);

  const run = async (fn: () => Promise<{ character: CharacterView }>, okMsg: string) => {
    setBusy(true);
    try {
      const res = await fn();
      onUpdateCharacter(res.character);
      onNotify(okMsg);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const classMeta = ROLE_CLASS_META[character.roleClass];
  const mySprite = character.gender === 'female' ? classMeta.femaleSprite : classMeta.maleSprite;
  const equippedBySlot = new Map<EquipmentSlot, EquipmentView>(
    character.equipment.filter((e) => e.equipped).map((e) => [e.slot, e]),
  );
  const equippedMount = equippedBySlot.get('mount');

  const handleDigTreasure = async () => {
    setBusy(true);
    try {
      const res = await api.digTreasure(realmId);
      onUpdateCharacter(res.character);
      setDigResult(res.result);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : '挖宝失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#1b0820]">
      {/* Classic Top Header */}
      <AssetBg
        path="tit_bg.png"
        className="h-[38px] border-b border-[#5b6a6c] shrink-0"
      >
        <span className="text-[17px] font-bold tracking-widest text-white hx-stroke">{TITLES[panel]}</span>
      </AssetBg>

      {/* Classic Deep-Purple Body with Silver Cloud Pillars (classic_5.jpg) */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-[14px] hx-cloud-pillar shrink-0 border-r border-black" />
        <div className="flex-1 hx-purple-bg p-3 overflow-y-auto hx-scroll text-[13px] relative">
          {/* STATUS: 属性加点 / 抗性配点 / 技能熟练 */}
          {panel === 'status' && (
            <div className="space-y-2.5">
              {/* Sub-tabs */}
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                {(
                  [
                    ['stats', `属性加点${character.alloc.freePoints > 0 ? `(${character.alloc.freePoints})` : ''}`],
                    ['resist', `抗性配点${character.resist.freePoints > 0 ? `(${character.resist.freePoints})` : ''}`],
                    ['skills', '技能熟练'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setStatusTab(k)}
                    className={`py-1.5 font-bold border ${
                      statusTab === k
                        ? 'bg-[#c96215] border-[#ffdf75] text-white'
                        : 'bg-[#5c2569] border-[#a574b0] text-[#f3e3f7]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {statusTab === 'stats' && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5 p-2.5 bg-[#26072c]/90 border border-[#b78f3c]">
                    <div className="w-[84px] h-[84px] bg-[#2a3820] border border-[#e0b84f] flex items-center justify-center shrink-0">
                      <PixelSprite spriteKey={mySprite} scale={2} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5 text-xs">
                      <div className="text-base font-bold text-[#ffe678] truncate flex items-center gap-1">
                        <span>{character.name}</span>
                        {character.rebirth > 0 && (
                          <span className="px-1 py-0.5 text-[10px] bg-[#9b5b08] border border-[#ffe678] text-[#fff8cc] shrink-0">
                            {character.rebirth}转
                          </span>
                        )}
                      </div>
                      <div>
                        职业：{character.level}级 {classMeta.label}（
                        {character.gender === 'female' ? '女' : '男'}）
                      </div>
                      <div>
                        经验：{character.exp} / {character.expToNext}
                      </div>
                      <div className="text-[#ffe04b]">
                        金砖：{character.gold} · 银两：{character.silver}
                      </div>
                      {equippedMount && (
                        <div className="text-[11px] text-[#9be8ff]">
                          坐骑：{equippedMount.name}
                        </div>
                      )}
                    </div>
                    {equippedMount && (
                      <div className="w-[54px] h-[54px] bg-[#1c2817] border border-[#d6ab48] flex items-center justify-center shrink-0 p-1">
                        <AssetImg
                          path={equippedMount.icon}
                          alt={equippedMount.name}
                          className="w-full h-full object-contain pixelated"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <div className="p-2 bg-[#25072b]/85 border border-[#7c4d87]">
                      气血：{character.hp}/{character.maxHp}
                      {character.equipBonus.hp > 0 && (
                        <span className="text-[#7dff92] ml-1">(+{character.equipBonus.hp})</span>
                      )}
                    </div>
                    <div className="p-2 bg-[#25072b]/85 border border-[#7c4d87]">
                      精力：{character.mp}/{character.maxMp}
                      {character.equipBonus.mp > 0 && (
                        <span className="text-[#7dff92] ml-1">(+{character.equipBonus.mp})</span>
                      )}
                    </div>
                    <div className="p-2 bg-[#25072b]/85 border border-[#7c4d87]">
                      攻击：{character.atk}
                      {character.equipBonus.atk > 0 && (
                        <span className="text-[#7dff92] ml-1">(+{character.equipBonus.atk})</span>
                      )}
                    </div>
                    <div className="p-2 bg-[#25072b]/85 border border-[#7c4d87]">
                      速度：{character.spd}
                      {character.equipBonus.spd > 0 && (
                        <span className="text-[#7dff92] ml-1">(+{character.equipBonus.spd})</span>
                      )}
                      <span className="text-[#d6bddf] ml-1">防{character.def}</span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#230629]/90 border border-[#b68d3a] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#ffea84] font-bold">
                        剩余自由属性点：{character.alloc.freePoints}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => run(() => api.resetStats(realmId), '已重置所有属性点')}
                        className="px-2 py-0.5 bg-[#5a1f66] border border-[#c795d1] text-[#f8e7fc] text-[11px]"
                      >
                        洗点重置
                      </button>
                    </div>
                    {(
                      [
                        ['vit', '体质', '气血+18 / 防+1', character.alloc.vit],
                        ['str', '力量', '攻击+3', character.alloc.str],
                        ['int', '智力', '精力+16 / 法伤提升', character.alloc.int],
                        ['agi', '敏捷', '速度+3', character.alloc.agi],
                      ] as const
                    ).map(([key, label, tip, val]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-xs py-1 border-t border-white/10"
                      >
                        <div>
                          <span className="font-bold text-white">{label}</span>
                          <span className="text-[#ffe27a] ml-1.5">已加 {val}</span>
                          <span className="text-[#d7bddf] text-[11px] ml-1.5">({tip})</span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={busy || character.alloc.freePoints < 1}
                            onClick={() =>
                              run(
                                () => api.allocateStats({ realmId, [key]: 1 }),
                                `${label} +1`,
                              )
                            }
                            className="hx-btn-gold px-2 py-0.5 text-[11px] disabled:opacity-40"
                          >
                            +1
                          </button>
                          <button
                            type="button"
                            disabled={busy || character.alloc.freePoints < 5}
                            onClick={() =>
                              run(
                                () => api.allocateStats({ realmId, [key]: 5 }),
                                `${label} +5`,
                              )
                            }
                            className="hx-btn-gold px-2 py-0.5 text-[11px] disabled:opacity-40"
                          >
                            +5
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 主角 60 级一转破境 */}
                  <div className="p-2.5 bg-[#2a0b24]/95 border-2 border-[#e0b84e] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-black text-[#ffe678]">
                        {character.rebirth > 0
                          ? `🌟 已破境【${character.rebirth}转重生】`
                          : '🔥 主角 60 级一转破境'}
                      </span>
                      <span className="text-[11px] text-[#9ee0ff]">
                        {character.rebirth > 0 ? '首期最高境界' : `进度 Lv.${character.level}/60`}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#e7cfbb] leading-relaxed">
                      满 60 级可一转重练（等级回 1 级，保留全部装备/副将/熟练度/主线，且无视装备等级限制），永久获得
                      <span className="text-[#ffcf54] font-bold">
                        {' '}+30 自由属性点、+10 抗性点、全属性成长 +15%、抗性上限 85% 及专属一转外观
                      </span>
                      ！
                    </div>
                    {character.rebirth === 0 && (
                      <button
                        type="button"
                        disabled={busy || character.level < 60}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const res = await api.rebirthCharacter(realmId);
                            onUpdateCharacter(res.character);
                            onNotify(res.message);
                          } catch (err) {
                            onNotify(err instanceof Error ? err.message : '一转失败');
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className={`w-full py-1.5 font-bold border ${
                          character.level >= 60
                            ? 'hx-btn-red'
                            : 'bg-[#361c3d] border-[#6a4c73] text-[#9f82a8]'
                        }`}
                      >
                        {character.level >= 60 ? '⚡ 立即 60 级一转重生' : `需达到 60 级（还差 ${60 - character.level} 级）`}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {statusTab === 'resist' && (() => {
                const resCap = 75 + (character.rebirth ?? 0) * 10;
                return (
                <div className="p-2.5 bg-[#230629]/90 border border-[#b68d3a] space-y-2">
                  <div className="text-xs text-[#ffea84] font-bold">
                    剩余抗性点：{character.resist.freePoints}（每点 +3%，单项上限 {resCap}%）
                  </div>
                  {(
                    [
                      ['phys', '抗物理', '减免物理普攻与武士技能伤害', character.resist.phys],
                      ['chaos', '抗乱', '抵御文人「离间计」混乱控制', character.resist.chaos],
                      ['seal', '抗封', '抵御文人「定身计」封印控制', character.resist.seal],
                      ['trap', '抗围', '抵御文人「画地为牢」围困', character.resist.trap],
                      ['magic', '抗法术', '减免雷法/火计/呼风唤雨伤害', character.resist.magic],
                    ] as const
                  ).map(([key, label, tip, pct]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between text-xs py-1.5 border-t border-white/10"
                    >
                      <div>
                        <span className="font-bold text-white">{label}</span>
                        <span className="text-[#87e8ff] font-bold ml-2">{pct}%</span>
                        <div className="text-[11px] text-[#dec4e6]">{tip}</div>
                      </div>
                      <button
                        type="button"
                        disabled={busy || character.resist.freePoints < 1 || pct >= resCap}
                        onClick={() =>
                          run(
                            () => api.allocateResist({ realmId, [key]: 1 }),
                            `${label} 提升至 ${Math.min(resCap, pct + 3)}%`,
                          )
                        }
                        className="hx-btn-gold px-2.5 py-1 text-[11px] shrink-0 disabled:opacity-40"
                      >
                        +3%
                      </button>
                    </div>
                  ))}
                </div>
                );
              })()}

              {statusTab === 'skills' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#ffea84]">
                    <span>战斗施法或武馆消耗银两均可提升技能熟练度与阶位！</span>
                    <span className="shrink-0 font-bold">银两：{character.silver}</span>
                  </div>
                  {character.skills.map((sk) => {
                    const pct = Math.min(100, Math.round((sk.proficiency / sk.nextTierProf) * 100));
                    const isMax = sk.proficiency >= 2000;
                    const trainCost = 300 + sk.tier * 280;
                    return (
                      <div
                        key={sk.skillId}
                        className="p-2.5 bg-[#25072b]/90 border border-[#9666a1] space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#ffe678] text-sm">
                            {sk.name}{' '}
                            <span className="text-[#8de4ff] text-xs">({sk.tier}阶)</span>
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[11px] text-[#e8d2ee]">
                              耗精 {sk.mpCost} · {sk.maxTargets}目标
                            </span>
                            <button
                              type="button"
                              disabled={busy || isMax}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  const res = await api.trainSkill(realmId, sk.skillId);
                                  onUpdateCharacter(res.character);
                                  onNotify(res.message);
                                } catch (err) {
                                  onNotify(err instanceof Error ? err.message : '修炼失败');
                                } finally {
                                  setBusy(false);
                                }
                              }}
                              className="hx-btn-gold px-2 py-0.5 text-[10.5px] disabled:opacity-45"
                            >
                              {isMax ? '已圆满' : `武馆点技(${trainCost}银)`}
                            </button>
                          </div>
                        </div>
                        <div className="text-[11px] text-[#eddcf2]">{sk.desc}</div>
                        <div className="pt-1">
                          <div className="flex justify-between text-[10.5px] text-[#ffd77a] mb-0.5">
                            <span>熟练度</span>
                            <span>
                              {sk.proficiency} / {sk.nextTierProf}
                            </span>
                          </div>
                          <div className="h-2 bg-[#140318] border border-[#734a7d] overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#d98515] to-[#ffe666]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ITEMS & EQUIPMENT BAG */}
          {panel === 'items' && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setBagTab('equip')}
                  className={`py-1.5 font-bold border ${
                    bagTab === 'equip'
                      ? 'bg-[#c96215] border-[#ffdf75] text-white'
                      : 'bg-[#5c2569] border-[#a574b0] text-[#f3e3f7]'
                  }`}
                >
                  装备与战马 ({character.equipment.length}/30)
                </button>
                <button
                  type="button"
                  onClick={() => setBagTab('consumable')}
                  className={`py-1.5 font-bold border ${
                    bagTab === 'consumable'
                      ? 'bg-[#c96215] border-[#ffdf75] text-white'
                      : 'bg-[#5c2569] border-[#a574b0] text-[#f3e3f7]'
                  }`}
                >
                  丹药与藏宝图 ({character.inventory.reduce((s, i) => s + i.quantity, 0)})
                </button>
              </div>

              {bagTab === 'equip' && (
                <div className="space-y-2.5">
                  {/* 5 Equipped Slots */}
                  <div className="p-2 bg-[#230629]/90 border border-[#b68d3a] space-y-1.5">
                    <div className="text-xs font-bold text-[#ffea84]">
                      主角穿戴（同系 2件/4件 自动激活经典套装效果！）
                    </div>
                    {character.setBonuses && character.setBonuses.length > 0 && (
                      <div className="p-1.5 bg-[#15301a] border border-[#6be884] text-[11px] text-[#caffd5] space-y-0.5">
                        {character.setBonuses.map((s, idx) => (
                          <div key={idx}>✨ {s}</div>
                        ))}
                      </div>
                    )}
                    {EQUIP_SLOTS.map((slot) => {
                      const eq = equippedBySlot.get(slot);
                      return (
                        <div
                          key={slot}
                          className="flex items-center justify-between gap-2 py-1 border-t border-white/10 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-1.5 py-0.5 bg-[#4b1a56] border border-[#9666a1] text-[11px] text-[#ffdf78] shrink-0">
                              {EQUIPMENT_SLOT_LABELS[slot]}
                            </span>
                            {eq ? (
                              <>
                                <AssetImg
                                  path={eq.icon}
                                  alt={eq.name}
                                  className="w-7 h-7 object-contain pixelated shrink-0 bg-[#1a131f] border border-[#c69d46] p-0.5"
                                />
                                <div className="min-w-0">
                                  <div className={`font-bold truncate ${QUALITY_COLOR[eq.quality]}`}>
                                    {eq.name}
                                  </div>
                                  <div className="text-[10.5px] text-[#e3cce8] truncate">
                                    {formatEquipStats(eq)}
                                  </div>
                                </div>
                              </>
                            ) : (
                              <span className="text-[#9e86a6]">未装备</span>
                            )}
                          </div>
                          {eq && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () => api.unequipSlot(realmId, slot),
                                  `已卸下【${eq.name}】`,
                                )
                              }
                              className="px-2 py-0.5 text-[11px] bg-[#52245c] border border-[#c095cc] text-white shrink-0"
                            >
                              卸下
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Backpack Unequipped Equipment */}
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-[#ffdf78]">行囊中的装备：</div>
                    {character.equipment
                      .filter((e) => !e.equipped)
                      .map((eq) => (
                        <div
                          key={eq.id}
                          className="p-2 bg-[#27082e]/90 border border-[#8e6299] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <AssetImg
                              path={eq.icon}
                              alt={eq.name}
                              className="w-9 h-9 object-contain pixelated shrink-0 bg-[#19121e] border border-[#b9903d] p-0.5"
                            />
                            <div className="min-w-0">
                              <div className={`font-bold truncate ${QUALITY_COLOR[eq.quality]}`}>
                                [{QUALITY_LABEL[eq.quality]}] {eq.name}
                                <span className="text-[#d9c1e0] font-normal text-[11px] ml-1">
                                  ({EQUIPMENT_SLOT_LABELS[eq.slot]} · Lv.{eq.levelReq})
                                </span>
                              </div>
                              <div className="text-[11px] text-[#e6d1eb] truncate">
                                {formatEquipStats(eq)}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                run(() => api.equipItem(realmId, eq.id), `已穿戴【${eq.name}】`)
                              }
                              className="hx-btn-gold px-2.5 py-0.5 text-[11px]"
                            >
                              穿戴
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                run(
                                  () => api.sellEquipment(realmId, eq.id),
                                  `已出售【${eq.name}】获得 ${eq.sellSilver} 银`,
                                )
                              }
                              className="px-2 py-0.5 text-[10px] bg-[#4a1a1f] border border-[#b8666e] text-[#ffd4d8]"
                            >
                              卖{eq.sellSilver}银
                            </button>
                          </div>
                        </div>
                      ))}
                    {character.equipment.filter((e) => !e.equipped).length === 0 && (
                      <div className="text-center text-xs text-[#d8bedf] py-4">
                        行囊暂无未穿戴装备，可去许昌「铁匠铺与马市」购置、野外打怪或用「藏宝图」挖宝！
                      </div>
                    )}
                  </div>
                </div>
              )}

              {bagTab === 'consumable' && (
                <div className="space-y-2">
                  {digResult && (
                    <div className="p-2.5 bg-[#36110e] border-2 border-[#ffd85c] text-xs space-y-1">
                      <div className="font-bold text-[#ffea7a]">藏宝图奇遇</div>
                      <div className="text-white">{digResult.message}</div>
                      {digResult.equipment && (
                        <div className="text-[#9ae6ff]">
                          属性：{formatEquipStats(digResult.equipment)}（已存入装备栏）
                        </div>
                      )}
                    </div>
                  )}
                  {character.inventory.map((it) => (
                    <div
                      key={it.itemId}
                      className="p-2 bg-[#27082e]/90 border border-[#8e6299] flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-[#ffe780]">
                          {it.name} <span className="text-white text-xs">×{it.quantity}</span>
                        </div>
                        <div className="text-[11px] text-[#e0c7e8]">{it.desc}</div>
                      </div>
                      {it.itemId === 'baotu' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleDigTreasure()}
                          className="hx-btn-red px-3 py-1 text-xs shrink-0"
                        >
                          挖宝
                        </button>
                      ) : it.type === 'consumable' ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(() => api.useItem(realmId, it.itemId), `已使用【${it.name}】`)
                          }
                          className="hx-btn-gold px-3 py-1 text-xs shrink-0"
                        >
                          使用
                        </button>
                      ) : null}
                    </div>
                  ))}
                  {character.inventory.length === 0 && (
                    <div className="text-center text-[#d8bedf] py-8">
                      行囊空空如也，去回春药铺买点丹药或藏宝图吧
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* BLACKSMITH & HORSE MARKET (直购 + 打造/重铸随机词条) */}
          {panel === 'blacksmith' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#ffe27a] font-bold">银两：{character.silver} 两</span>
                <span className="text-[#9be8ff]">
                  玄铁矿×{character.inventory.find((i) => i.itemId === 'xuantie')?.quantity ?? 0} · 精炼石×
                  {character.inventory.find((i) => i.itemId === 'jinglianshi')?.quantity ?? 0}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSmithTab('gear')}
                  className={`py-1.5 font-bold border ${
                    smithTab === 'gear'
                      ? 'bg-[#c96215] border-[#ffdf75] text-white'
                      : 'bg-[#5c2569] border-[#a574b0] text-[#f3e3f7]'
                  }`}
                >
                  兵器与防具
                </button>
                <button
                  type="button"
                  onClick={() => setSmithTab('mount')}
                  className={`py-1.5 font-bold border ${
                    smithTab === 'mount'
                      ? 'bg-[#c96215] border-[#ffdf75] text-white'
                      : 'bg-[#5c2569] border-[#a574b0] text-[#f3e3f7]'
                  }`}
                >
                  军马场
                </button>
                <button
                  type="button"
                  onClick={() => setSmithTab('craft')}
                  className={`py-1.5 font-bold border ${
                    smithTab === 'craft'
                      ? 'bg-[#c96215] border-[#ffdf75] text-white'
                      : 'bg-[#5c2569] border-[#a574b0] text-[#f3e3f7]'
                  }`}
                >
                  🔨 打造/重铸
                </button>
              </div>
              {smithTab !== 'craft' ? (
                <div className="space-y-2">
                  {Object.values(EQUIPMENT_TEMPLATES)
                    .filter(
                      (tpl) =>
                        tpl.shopAvailable &&
                        (smithTab === 'mount' ? tpl.slot === 'mount' : tpl.slot !== 'mount'),
                    )
                    .map((tpl) => (
                      <div
                        key={tpl.templateId}
                        className="p-2 bg-[#27082e]/90 border border-[#9d6fa8] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <AssetImg
                            path={tpl.icon}
                            alt={tpl.name}
                            className="w-10 h-10 object-contain pixelated shrink-0 bg-[#1a131f] border border-[#c69d46] p-0.5"
                          />
                          <div className="min-w-0">
                            <div className={`font-bold truncate ${QUALITY_COLOR[tpl.quality]}`}>
                              {tpl.name}
                              <span className="text-[#d9c1e0] font-normal text-[11px] ml-1">
                                ({EQUIPMENT_SLOT_LABELS[tpl.slot]} · Lv.{tpl.levelReq})
                              </span>
                            </div>
                            <div className="text-[11px] text-[#9de6ff] truncate">
                              {formatEquipStats(tpl)}
                            </div>
                            <div className="text-[11px] text-[#ffd46b]">
                              售价：{tpl.priceSilver} 银
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => api.buyEquipment(realmId, tpl.templateId),
                              `已购入【${tpl.name}】（请到「物品」穿戴）`,
                            )
                          }
                          className="hx-btn-gold px-3 py-1 text-xs shrink-0"
                        >
                          购买
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  <div className="p-2 bg-[#220728] border border-[#c5963d] space-y-1.5">
                    <div className="font-bold text-[#ffe478]">
                      🔥 神兵打造（消耗玄铁矿 + 银两，随机词条波动 96%~130%，几率升品！）
                    </div>
                    {CRAFT_RECIPES.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-2 bg-[#2d0c36] border border-[#8e6299] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[#ffea96]">
                            {rec.name}{' '}
                            <span className="text-[#b8d4ff] text-[10.5px]">(Lv.{rec.levelReq}+)</span>
                          </div>
                          <div className="text-[10.5px] text-[#e6d0ed]">{rec.desc}</div>
                          <div className="text-[10.5px] text-[#ffd46b]">
                            需：玄铁矿×{rec.oreCost} + {rec.silverCost} 银
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const res = await api.craftEquipment(realmId, rec.id);
                              onUpdateCharacter(res.character);
                              onNotify(res.message);
                            } catch (err) {
                              onNotify(err instanceof Error ? err.message : '打造失败');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="hx-btn-red px-2.5 py-1 text-[11px] shrink-0"
                        >
                          打造
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="p-2 bg-[#220728] border border-[#8e6299] space-y-1.5">
                    <div className="font-bold text-[#9de6ff]">
                      ✨ 装备重铸（消耗 精炼石×1 + 少量银两，重随装备成色与抗性词条）
                    </div>
                    {character.equipment.length === 0 ? (
                      <div className="text-[#c5aacf] text-center py-2">暂无可重铸装备</div>
                    ) : (
                      character.equipment.slice(0, 15).map((eq) => (
                        <div
                          key={eq.id}
                          className="p-1.5 bg-[#2a0a32] border border-[#754d80] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className={`font-bold truncate ${QUALITY_COLOR[eq.quality]}`}>
                              {eq.name}{' '}
                              <span className="text-[10px] text-[#ffe27a]">
                                成色{eq.rollPct ?? 100}%
                              </span>
                              {eq.setName && (
                                <span className="ml-1 text-[10px] text-[#7dff92]">[{eq.setName}]</span>
                              )}
                            </div>
                            <div className="text-[10.5px] text-[#dfcae6] truncate">
                              {formatEquipStats(eq)}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const res = await api.reforgeEquipment(realmId, eq.id);
                                onUpdateCharacter(res.character);
                                onNotify(res.message);
                              } catch (err) {
                                onNotify(err instanceof Error ? err.message : '重铸失败');
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="hx-btn-gold px-2 py-0.5 text-[11px] shrink-0"
                          >
                            重铸
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GENERALS (副将深度培养：成长率/初值/专属技能/喂丹/洗髓/转生/解雇) */}
          {panel === 'generals' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs bg-[#230629]/90 border border-[#9d6fa8] px-2.5 py-1.5">
                <span className="text-[#ffde7d] font-bold">
                  副将营 ({character.generals.length}/16) · 最多出战 3 名
                </span>
                <span className="text-[#d9c1e0] text-[11px]">
                  经验丹×{character.inventory.find((i) => i.itemId === 'jingyandan')?.quantity ?? 0}{' '}
                  · 洗髓丹×{character.inventory.find((i) => i.itemId === 'xisuidan')?.quantity ?? 0}
                </span>
              </div>

              {character.generals.map((g) => {
                const rebirthReq = g.rebirth === 0 ? 20 : g.rebirth === 1 ? 40 : 999;
                const canRebirth = g.rebirth < 2 && g.level >= rebirthReq;
                const ownedBooks = character.inventory.filter(
                  (it) => Boolean(GENERAL_SKILL_BOOKS[it.itemId]) && it.quantity > 0,
                );
                const showBooks = learningGenId === g.id;
                return (
                  <div
                    key={g.id}
                    className="p-2.5 bg-[#26072d]/90 border border-[#9d6fa8] space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <AssetImg
                          path={
                            g.avatarKey.startsWith('f')
                              ? g.avatarKey
                              : `portraits/${g.avatarKey}`
                          }
                          alt={g.name}
                          className="w-10 h-10 pixelated bg-[#1d2b18] border border-[#d6ab48] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center flex-wrap gap-1 font-bold">
                            <span className={QUALITY_COLOR[g.rarity]}>
                              [{QUALITY_LABEL[g.rarity]}] {g.name}
                            </span>
                            <span className="text-white">Lv.{g.level}</span>
                            {g.rebirth > 0 && (
                              <span className="px-1 bg-[#a6670a] border border-[#ffdf75] text-[#fff6b8] text-[10px]">
                                {g.rebirth}转
                              </span>
                            )}
                            {g.slot !== null && (
                              <span className="px-1 bg-[#b82018] text-white text-[10px]">
                                出战{g.slot + 1}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#9be8ff]">
                            成长 {g.growth.toFixed(2)} · 专属【{g.skillName}】
                            {g.skill2Name ? (
                              <span className="text-[#ffe273]"> · 秘籍【{g.skill2Name}】</span>
                            ) : (
                              <span className="text-[#bba3c4]"> · 秘籍槽空</span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#e8d2ee]">
                            当前：血{g.maxHp} · 精{g.maxMp} · 攻{g.atk} · 速{g.spd}
                          </div>
                          <div className="text-[10.5px] text-[#cbb0d4]">
                            初值：血{g.baseHp} / 精{g.baseMp} / 攻{g.baseAtk} / 速{g.baseSpd} · 经验
                            {g.exp}/{g.expToNext}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px]">
                            <span
                              className={`font-bold ${
                                g.loyalty < 40 ? 'text-[#ff7070]' : 'text-[#ffe678]'
                              }`}
                            >
                              忠诚 {g.loyalty}/100
                            </span>
                            <span className="text-[#ff9ed2] font-bold">
                              默契 {g.intimacy}/100 ({g.intimacyTitle})
                            </span>
                            {g.intimacyStatPct > 0 && (
                              <span className="text-[#8cff9c]">
                                攻血+{g.intimacyStatPct}% 全抗+{g.intimacyResistBonus}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Slot buttons */}
                      <div className="flex flex-col gap-1 shrink-0">
                        {g.slot !== null ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () => api.setGeneralSlot(realmId, g.id, null),
                                `已让 ${g.name} 休息`,
                              )
                            }
                            className="px-2 py-0.5 text-[11px] bg-[#52245c] border border-[#c095cc] text-white"
                          >
                            卸下
                          </button>
                        ) : (
                          <div className="flex gap-1">
                            {[0, 1, 2].map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  run(
                                    () => api.setGeneralSlot(realmId, g.id, slot),
                                    `${g.name} 已出战到槽位 ${slot + 1}`,
                                  )
                                }
                                className="hx-btn-gold px-1.5 py-0.5 text-[10.5px]"
                              >
                                位{slot + 1}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cultivation actions: 喂经验丹 / 洗髓 / 转生 / 解雇 */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-white/10">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => api.feedGeneral(realmId, g.id),
                            `${g.name} 服下经验丹，实力大增！`,
                          )
                        }
                        className="hx-btn-gold px-2 py-0.5 text-[11px]"
                      >
                        喂经验丹
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const res = await api.washGeneral(realmId, g.id);
                            onUpdateCharacter(res.character);
                            onNotify(
                              `洗髓完成！${res.general.name} 现为[${QUALITY_LABEL[res.general.rarity]}] 成长 ${res.general.growth.toFixed(2)}`,
                            );
                          } catch (err) {
                            onNotify(err instanceof Error ? err.message : '洗髓失败');
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="px-2 py-0.5 text-[11px] bg-[#1a4a7a] border border-[#7cc8ff] text-white font-bold"
                      >
                        洗髓重洗
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setLearningGenId(showBooks ? null : g.id)}
                        className="px-2 py-0.5 text-[11px] bg-[#1e5c35] border border-[#7cff9c] text-[#e6ffec] font-bold"
                      >
                        {showBooks ? '收起秘籍' : `习技(${ownedBooks.length})`}
                      </button>
                      {g.loyalty < 100 && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            const foodId = character.inventory.some(
                              (i) => i.itemId === 'roubaozi' && i.quantity > 0,
                            )
                              ? 'roubaozi'
                              : 'zhongyidan';
                            setBusy(true);
                            try {
                              const res = await api.feedGeneralLoyalty(realmId, g.id, foodId);
                              onUpdateCharacter(res.character);
                              onNotify(res.message);
                            } catch (err) {
                              onNotify(
                                err instanceof Error
                                  ? err.message
                                  : '请先去回春药铺买肉包子或忠义丹',
                              );
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="px-2 py-0.5 text-[11px] bg-[#6e3610] border border-[#ffb96b] text-[#fff1d6] font-bold"
                        >
                          喂口粮
                        </button>
                      )}
                      {g.rebirth < 2 && (
                        <button
                          type="button"
                          disabled={busy || !canRebirth}
                          onClick={() =>
                            run(
                              () => api.rebirthGeneral(realmId, g.id),
                              `恭喜！${g.name} 成功 ${g.rebirth + 1} 转，成长率与初值大幅飞跃！`,
                            )
                          }
                          className={`px-2 py-0.5 text-[11px] font-bold border ${
                            canRebirth
                              ? 'hx-btn-red'
                              : 'bg-[#361c3d] border-[#6a4c73] text-[#9f82a8]'
                          }`}
                        >
                          {g.rebirth + 1}转(需{rebirthReq}级)
                        </button>
                      )}
                      {g.slot === null && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const res = await api.dismissGeneral(realmId, g.id);
                              onUpdateCharacter(res.character);
                              onNotify(`已解雇 ${g.name}，收回遣散银 ${res.refundSilver} 两`);
                            } catch (err) {
                              onNotify(err instanceof Error ? err.message : '解雇失败');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="ml-auto px-2 py-0.5 text-[10.5px] bg-[#4a1a1f] border border-[#b8666e] text-[#ffd4d8]"
                        >
                          解雇
                        </button>
                      )}
                    </div>

                    {showBooks && (
                      <div className="p-2 bg-black/35 border border-[#6e9c78] space-y-1.5">
                        <div className="text-[11px] text-[#a6ffba] font-bold">
                          选择秘籍研习【秘籍槽2】（将覆盖旧秘籍，不影响专属技，默契 +8）：
                        </div>
                        {ownedBooks.length === 0 ? (
                          <div className="text-[11px] text-[#e2cce8]">
                            行囊中暂无副将技能书，可去「招贤馆 → 武学秘籍」购买或击杀剧情 BOSS 掉落！
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {ownedBooks.map((bk) => (
                              <button
                                key={bk.itemId}
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    const res = await api.learnGeneralSkill(
                                      realmId,
                                      g.id,
                                      bk.itemId,
                                    );
                                    onUpdateCharacter(res.character);
                                    onNotify(res.message);
                                    setLearningGenId(null);
                                  } catch (err) {
                                    onNotify(err instanceof Error ? err.message : '研习失败');
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="px-2 py-1 bg-[#3b1547] border border-[#e0b84e] text-[#ffea99] text-[11px] hover:bg-[#571e69]"
                              >
                                {bk.name} ×{bk.quantity}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {character.generals.length === 0 && (
                <div className="text-center text-[#d8bedf] py-8">
                  暂无副将，可在许昌「设施 → 招贤馆」招募/寻访，或在战斗中使用「招降」！
                </div>
              )}
            </div>
          )}

          {/* RANKINGS & ASYNC ARENA */}
          {panel === 'rank' && (
            <div className="space-y-2.5">
              <div className="p-2 bg-[#230629]/90 border border-[#e0b84e] text-xs flex items-center justify-between gap-2">
                <span className="text-[#ffe478] font-bold">
                  ⚔ 擂台战绩：{character.arena.wins}胜 {character.arena.losses}负
                </span>
                <span className="text-[#bfeec2] text-[11px]">
                  今日有奖切磋剩余 {character.arena.dailyRewardsLeft}/5 次
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#e8d0ee]">榜单：</span>
                {(
                  [
                    ['level', '高手榜'],
                    ['silver', '富豪榜'],
                    ['gold', '金砖榜'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRankSort(k)}
                    className={`px-2.5 py-1 font-bold border ${
                      rankSort === k
                        ? 'bg-[#c96215] border-[#ffdf75] text-white'
                        : 'bg-[#8d7b19] border-[#d6c24f] text-[#fff8cc]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="divide-y divide-white/15">
                {rankings.map((r) => (
                  <div
                    key={r.id}
                    className="py-1.5 px-1 flex items-center justify-between gap-1.5 text-[13px]"
                  >
                    <div className="min-w-0 truncate">
                      <span className="text-[#ffd24d] font-bold mr-1">{r.rank}.</span>
                      <button
                        type="button"
                        onClick={() => onInspectPlayer?.(r.id)}
                        className="text-[#ff4f4f] font-bold hx-stroke hover:underline"
                        title="点击查看资料/加好友/私聊"
                      >
                        {r.name}
                      </button>
                      {r.rebirth > 0 && (
                        <span className="ml-1 px-1 py-0.5 text-[10px] bg-[#9b5b08] border border-[#ffe678] text-[#fff8cc]">
                          {r.rebirth}转
                        </span>
                      )}
                      <span className="text-[#e5d2eb] text-xs ml-1">
                        ({ROLE_CLASS_META[r.roleClass].label}·{r.level}级)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-[#ffe685]">
                        {rankSort === 'silver'
                          ? `${r.silver}银`
                          : rankSort === 'gold'
                            ? `${r.gold}金`
                            : `Lv.${r.level}`}
                      </span>
                      {r.id !== character.id && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const res = await api.challengeArena(realmId, r.id);
                              onEnterBattle?.(res.battle);
                            } catch (err) {
                              onNotify(err instanceof Error ? err.message : '发起切磋失败');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="hx-btn-red px-2 py-0.5 text-[11px]"
                          title="挑战该玩家的离线镜像阵容"
                        >
                          切磋
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PHARMACY SHOP */}
          {panel === 'shop' && (
            <div className="space-y-2">
              <div className="text-xs text-[#ffe27a] flex items-center justify-between">
                <span>银两：{character.silver} 两</span>
                <span className="text-[#ffd24d]">金砖：{character.gold} 金</span>
              </div>
              {Object.values(ITEMS)
                .filter((it) => !GENERAL_SKILL_BOOKS[it.itemId])
                .map((it) => (
                <div
                  key={it.itemId}
                  className="p-2 bg-[#27082e]/90 border border-[#8e6299] flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-[#ffe678]">
                      {it.name}{' '}
                      {it.priceGold ? (
                        <span className="text-[#ffd24d] text-xs">{it.priceGold} 金/个</span>
                      ) : (
                        <span className="text-[#a4e8ff] text-xs">{it.priceSilver} 银/个</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#e0c7e8]">{it.desc}</div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      run(() => api.buyItem(realmId, it.itemId, 1), `已购买【${it.name}】×1`)
                    }
                    className="hx-btn-gold px-3 py-1 text-xs shrink-0"
                  >
                    购买
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* TAVERN (RECRUIT, DRAW GENERALS & SKILL BOOKS) */}
          {panel === 'tavern' && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setTavernTab('recruit')}
                  className={`py-1.5 font-bold border ${
                    tavernTab === 'recruit'
                      ? 'bg-[#c96215] border-[#ffdf75] text-white'
                      : 'bg-[#5c2569] border-[#a574b0] text-[#f3e3f7]'
                  }`}
                >
                  招贤纳士
                </button>
                <button
                  type="button"
                  onClick={() => setTavernTab('books')}
                  className={`py-1.5 font-bold border ${
                    tavernTab === 'books'
                      ? 'bg-[#c96215] border-[#ffdf75] text-white'
                      : 'bg-[#5c2569] border-[#a574b0] text-[#f3e3f7]'
                  }`}
                >
                  武学秘籍（副将习技）
                </button>
              </div>

              {tavernTab === 'books' ? (
                <div className="space-y-2">
                  <div className="text-xs text-[#ffe27a] flex items-center justify-between">
                    <span className="text-[#ffd24d]">当前金砖：{character.gold} 金</span>
                    <span className="text-[#d7bddf]">购后在「副将营帐」点击习技</span>
                  </div>
                  {Object.values(ITEMS)
                    .filter((it) => Boolean(GENERAL_SKILL_BOOKS[it.itemId]))
                    .map((it) => (
                      <div
                        key={it.itemId}
                        className="p-2 bg-[#27082e]/90 border border-[#8e6299] flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-bold text-[#ffe678] text-xs">
                            {it.name}{' '}
                            {it.priceGold ? (
                              <span className="text-[#ffd24d]">{it.priceGold} 金/本</span>
                            ) : (
                              <span className="text-[#a4e8ff]">{it.priceSilver} 银/本</span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#e0c7e8]">{it.desc}</div>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            run(() => api.buyItem(realmId, it.itemId, 1), `已购买【${it.name}】×1`)
                          }
                          className="hx-btn-gold px-3 py-1 text-xs shrink-0"
                        >
                          购买
                        </button>
                      </div>
                    ))}
                </div>
              ) : (
                <>
              {/* Token Draw Banner */}
              <div className="p-2.5 bg-[#36110e] border-2 border-[#e5b642] flex items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-bold text-[#ffea7a] text-sm">名将寻访（消耗 1 招贤令）</div>
                  <div className="text-[11px] text-[#f5dccc]">
                    有机会直接寻得 <span className="text-[#ffbe47] font-bold">吕布 / 诸葛亮 / 司马懿 / 周瑜 / 马超 / 关羽 / 貂蝉 / 赵云</span>
                    ，随机刷出极品成长率！
                  </div>
                  <div className="text-[11px] text-[#9de6ff] mt-0.5">
                    当前招贤令：{character.inventory.find((i) => i.itemId === 'jiangling')?.quantity ?? 0} 枚 · 银两：{character.silver} 两
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const res = await api.drawGeneral(realmId);
                      onUpdateCharacter(res.character);
                      onNotify(
                        `寻访大喜！获得[${QUALITY_LABEL[res.general.rarity]}]【${res.general.name}】（成长 ${res.general.growth.toFixed(2)}，技：${res.general.skillName}）`,
                      );
                    } catch (err) {
                      onNotify(err instanceof Error ? err.message : '寻访失败');
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="hx-btn-red px-3 py-1.5 text-xs shrink-0"
                >
                  令寻名将
                </button>
              </div>

              <div className="space-y-2">
                {Object.values(GENERAL_TEMPLATES)
                  .filter((tpl) => tpl.tavernDirect !== false)
                  .map((tpl) => (
                    <div
                      key={tpl.templateId}
                      className="p-2 bg-[#27082e]/90 border border-[#9d6fa8] flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <AssetImg
                          path={
                            tpl.avatarKey.startsWith('f')
                              ? tpl.avatarKey
                              : `portraits/${tpl.avatarKey}`
                          }
                          alt={tpl.name}
                          className="w-10 h-10 pixelated border border-[#d6ab48] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-[#ffe678] text-xs">
                            {tpl.name}{' '}
                            <span className="text-[#9ce5ff]">
                              成长 {tpl.growthMin.toFixed(2)}~{tpl.growthMax.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#e0c7e8]">{tpl.desc}</div>
                          <div className="text-[11px] text-[#ffd46b]">
                            身价：{tpl.recruitCostSilver} 银
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const res = await api.recruitGeneral(realmId, tpl.templateId);
                            onUpdateCharacter(res.character);
                            onNotify(
                              `成功招募[${QUALITY_LABEL[res.general.rarity]}]【${res.general.name}】（成长 ${res.general.growth.toFixed(2)}）！`,
                            );
                          } catch (err) {
                            onNotify(err instanceof Error ? err.message : '招募失败');
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="hx-btn-gold px-3 py-1 text-xs shrink-0"
                      >
                        招募
                      </button>
                    </div>
                  ))}
              </div>
                </>
              )}
            </div>
          )}

          {/* QUESTS & PAOHUAN */}
          {(panel === 'quests' || panel === 'paohuan') && (() => {
            const mainQuests = character.quests?.mainQuests ?? [];
            const paohuan = character.quests?.paohuan;
            const currentMain =
              mainQuests.find((q) => q.status === 'ready') ??
              mainQuests.find((q) => q.status === 'active') ??
              mainQuests.find((q) => q.status === 'available') ??
              null;
            const allMainClaimed =
              mainQuests.length > 0 && mainQuests.every((q) => q.status === 'claimed');

            const runQuestAction = async (
              fn: () => Promise<{ character: CharacterView; message: string }>,
            ) => {
              if (busy) return;
              setBusy(true);
              try {
                const res = await fn();
                onUpdateCharacter(res.character);
                onNotify(res.message);
              } catch (err) {
                onNotify(err instanceof Error ? err.message : '操作失败');
              } finally {
                setBusy(false);
              }
            };

            return (
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQuestTab('main')}
                    className={`py-1.5 font-bold border ${
                      questTab === 'main'
                        ? 'bg-[#c9952b] text-[#240a04] border-[#fff09a]'
                        : 'bg-[#2a0a30] text-[#f0d9f5] border-[#8b6232]'
                    }`}
                  >
                    三国主线 ({mainQuests.filter((q) => q.status === 'claimed').length}/
                    {mainQuests.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestTab('paohuan')}
                    className={`py-1.5 font-bold border ${
                      questTab === 'paohuan'
                        ? 'bg-[#c9952b] text-[#240a04] border-[#fff09a]'
                        : 'bg-[#2a0a30] text-[#f0d9f5] border-[#8b6232]'
                    }`}
                  >
                    许昌跑环 (第{paohuan?.ring ?? 1}/10环)
                  </button>
                </div>

                {questTab === 'main' && (
                  <div className="space-y-2.5">
                    {allMainClaimed ? (
                      <div className="p-3 bg-[#1d2e14] border-2 border-[#7dff92] text-center space-y-1">
                        <div className="text-[#ffe46e] font-black text-sm">
                          🏆 三国主线 {mainQuests.length} 章全通 · 威震华夏！
                        </div>
                        <div className="text-[#d6ffd9]">
                          少侠已历经黄巾、虎牢、官渡、赤壁诸大战役，可继续刷许昌跑环、培养转生名将！
                        </div>
                      </div>
                    ) : (
                      currentMain && (
                        <div className="p-2.5 bg-[#2a082f] border-2 border-[#e0b84e] space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-black text-sm text-[#ffe678]">
                              第{currentMain.chapter}章 · {currentMain.title}
                            </div>
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-bold border ${
                                currentMain.status === 'ready'
                                  ? 'bg-[#1b7a2c] text-[#e6ffea] border-[#7dff92]'
                                  : currentMain.status === 'active'
                                    ? 'bg-[#1a4dc2] text-white border-[#8bc0ff]'
                                    : 'bg-[#945c10] text-[#fff2b3] border-[#ffd866]'
                              }`}
                            >
                              {currentMain.status === 'ready'
                                ? '已达成·可领奖'
                                : currentMain.status === 'active'
                                  ? '进行中'
                                  : `推荐 Lv.${currentMain.recLevel}`}
                            </span>
                          </div>

                          <div className="p-2 bg-black/35 border border-[#7c5a2d] text-[#f7e7fc] leading-relaxed">
                            <span className="text-[#ffd46e] font-bold">
                              【{currentMain.npcName}】：
                            </span>
                            {currentMain.dialogue}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-[#ffeaad] font-bold">
                                目标：
                                {currentMain.objectiveKind === 'visit_map'
                                  ? `前往【${currentMain.targetMapName}】`
                                  : `在【${currentMain.targetMapName}】击败【${currentMain.targetName}】`}
                              </span>
                              <span className="text-[#8cff9c] font-bold">
                                {currentMain.progress} / {currentMain.requiredCount}
                              </span>
                            </div>
                            <div className="h-2 bg-black/60 border border-[#6e5028] overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#238a34] to-[#78ff8b]"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (currentMain.progress / Math.max(1, currentMain.requiredCount)) *
                                      100,
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="bg-black/30 p-1.5 border border-white/10 space-y-1">
                            <div className="text-[10.5px] text-[#e7cfbb]">本章丰厚奖励：</div>
                            <div className="flex flex-wrap gap-1.5 text-[11px]">
                              <span className="px-1.5 py-0.5 bg-[#381642] border border-[#966a35] text-[#ffe88a]">
                                经验 +{currentMain.rewards.exp}
                              </span>
                              <span className="px-1.5 py-0.5 bg-[#381642] border border-[#966a35] text-[#f0f0f0]">
                                银两 +{currentMain.rewards.silver}
                              </span>
                              {currentMain.rewards.gold && (
                                <span className="px-1.5 py-0.5 bg-[#4a320a] border border-[#f5c842] text-[#ffe159] font-bold">
                                  金砖 +{currentMain.rewards.gold}
                                </span>
                              )}
                              {currentMain.rewards.item && (
                                <span className="px-1.5 py-0.5 bg-[#19354d] border border-[#68b8ff] text-[#b8e2ff]">
                                  {currentMain.rewards.item.name}×{currentMain.rewards.item.quantity}
                                </span>
                              )}
                              {currentMain.rewards.equipName && (
                                <span className="px-1.5 py-0.5 bg-[#1b3d24] border border-[#6fe085] text-[#baffc6] font-bold">
                                  装备·{currentMain.rewards.equipName}
                                </span>
                              )}
                              {currentMain.rewards.generalName && (
                                <span className="px-1.5 py-0.5 bg-[#541717] border border-[#ff8b59] text-[#ffd49c] font-bold">
                                  副将·{currentMain.rewards.generalName}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-0.5">
                            {currentMain.status === 'available' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runQuestAction(() =>
                                    api.acceptMainQuest(realmId, currentMain.questId),
                                  )
                                }
                                className="hx-btn-gold px-4 py-1.5 text-xs"
                              >
                                接取本章主线
                              </button>
                            )}
                            {currentMain.status === 'ready' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runQuestAction(() =>
                                    api.claimMainQuest(realmId, currentMain.questId),
                                  )
                                }
                                className="hx-btn-red px-4 py-1.5 text-xs ring-1 ring-[#ffe678]"
                              >
                                交付领奖！
                              </button>
                            )}
                            {currentMain.status === 'active' && (() => {
                              const route = findMapPath(character.mapId, currentMain.targetMapId);
                              return (
                                <div className="text-[11px] text-[#e8cde9] text-right space-y-0.5">
                                  <div>
                                    {character.mapId === currentMain.targetMapId
                                      ? `已抵达【${currentMain.targetMapName}】，返回主界面点「人物」即可完成目标`
                                      : `请先点主界面「移动」前往【${currentMain.targetMapName}】${
                                          route.length >= 2
                                            ? `（路径：${formatMapRoute(route)}）`
                                            : ''
                                        }`}
                                  </div>
                                  {currentMain.questId === 'main_04' && (
                                    <div className="text-[10.5px] text-[#ffe099]">
                                      提示：建议先装备【百炼钢刀】、带齐副将并在客栈回满状态后再战张角
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )
                    )}

                    {/* All Chapters Overview */}
                    <div className="space-y-1">
                      <div className="text-[11px] text-[#e7cfbb] font-bold">三国剧情总览</div>
                      {mainQuests.map((q) => (
                        <div
                          key={q.questId}
                          className={`flex items-center justify-between px-2 py-1.5 border ${
                            q.status === 'claimed'
                              ? 'bg-[#1a2618]/80 border-[#4b7d48] text-[#bfeec2]'
                              : q.status === 'active' || q.status === 'ready'
                                ? 'bg-[#361140] border-[#e0b84e] text-white'
                                : 'bg-[#1b0820]/70 border-[#5e4266] text-[#a792ad]'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span className="font-bold">
                              第{q.chapter}章 {q.title}
                            </span>
                            <span className="text-[10px] ml-1.5 opacity-85">
                              (Lv.{q.recLevel} · {q.targetMapName})
                            </span>
                          </div>
                          <span className="text-[10.5px] shrink-0 font-bold">
                            {q.status === 'claimed'
                              ? '已完成 ✓'
                              : q.status === 'ready'
                                ? '可领奖'
                                : q.status === 'active'
                                  ? `${q.progress}/${q.requiredCount}`
                                  : q.status === 'available'
                                    ? '可接取'
                                    : '未解锁'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {questTab === 'paohuan' && paohuan && (
                  <div className="space-y-2.5">
                    <div className="p-2.5 bg-[#2a082f] border-2 border-[#e0b84e] space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-black text-sm text-[#ffe678]">
                            许昌经典跑环 · 第 {paohuan.ring} / 10 环
                          </div>
                          <div className="text-[10.5px] text-[#e7cfbb]">
                            环数越高经验银两越丰厚 · 累计大满贯 {paohuan.completedRounds} 轮 · 今日金砖 {paohuan.dailyGoldRoundsUsed ?? 0}/{paohuan.dailyGoldRoundsMax ?? 3} 轮
                          </div>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold border ${
                            paohuan.status === 'ready'
                              ? 'bg-[#1b7a2c] text-[#e6ffea] border-[#7dff92]'
                              : paohuan.status === 'active'
                                ? 'bg-[#1a4dc2] text-white border-[#8bc0ff]'
                                : 'bg-[#8a5410] text-[#fff2b3] border-[#ffd866]'
                          }`}
                        >
                          {paohuan.status === 'ready'
                            ? '可交环'
                            : paohuan.status === 'active'
                              ? '跑环中'
                              : '待接环'}
                        </span>
                      </div>

                      {/* 10-ring progress beads */}
                      <div className="grid grid-cols-10 gap-1">
                        {Array.from({ length: 10 }, (_, idx) => {
                          const num = idx + 1;
                          const done = num < paohuan.ring;
                          const curr = num === paohuan.ring;
                          const special = num === 5 || num === 10;
                          return (
                            <div
                              key={num}
                              className={`h-5 flex items-center justify-center text-[10px] font-bold border ${
                                done
                                  ? 'bg-[#1f6b2c] border-[#78ff8c] text-[#d6ffdc]'
                                  : curr
                                    ? 'bg-[#c98b1e] border-[#fff08c] text-[#220a04]'
                                    : special
                                      ? 'bg-[#4f1930] border-[#ff89b8] text-[#ffd4e5]'
                                      : 'bg-black/40 border-[#6e5275] text-[#b49ab8]'
                              }`}
                            >
                              {num}
                            </div>
                          );
                        })}
                      </div>

                      {paohuan.status === 'idle' ? (
                        <div className="p-2 bg-black/35 border border-[#7c5a2d] text-[#f5e3fa] leading-relaxed">
                          【跑环使者】：少侠今日精力充沛，快来接取第{' '}
                          <span className="text-[#ffe46e] font-bold">{paohuan.ring}</span>{' '}
                          环差事！根据当前等级（Lv.{character.level}）派发除害或送信任务。
                        </div>
                      ) : (
                        <div className="space-y-1.5 p-2 bg-black/35 border border-[#7c5a2d]">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#ffeaad]">
                              本环差事：{paohuan.targetName}
                            </span>
                            <span className="text-[#8cff9c] font-bold">
                              {paohuan.progress} / {paohuan.requiredCount}
                            </span>
                          </div>
                          {paohuan.targetMapName && (() => {
                            const pRoute = paohuan.targetMapId
                              ? findMapPath(character.mapId, paohuan.targetMapId)
                              : [];
                            return (
                              <div className="text-[11px] text-[#a9d6ff] space-y-0.5">
                                <div>
                                  目标地点：【{paohuan.targetMapName}】
                                  {paohuan.taskType === 'visit_map'
                                    ? '（移动到该地图即自动达成）'
                                    : '（击败对应怪物即可计数）'}
                                </div>
                                {paohuan.status === 'active' && pRoute.length >= 2 && (
                                  <div className="text-[10.5px] text-[#d8e6ff]">
                                    路径：{formatMapRoute(pRoute)}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          <div className="h-2 bg-black/60 border border-[#6e5028] overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#238a34] to-[#78ff8b]"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (paohuan.progress / Math.max(1, paohuan.requiredCount)) * 100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="bg-black/30 p-1.5 border border-white/10 space-y-1">
                        <div className="flex flex-wrap gap-1.5 text-[11px]">
                          <span className="px-1.5 py-0.5 bg-[#381642] border border-[#966a35] text-[#ffe88a]">
                            本环经验 +{paohuan.rewardExp}
                          </span>
                          <span className="px-1.5 py-0.5 bg-[#381642] border border-[#966a35] text-[#f0f0f0]">
                            本环银两 +{paohuan.rewardSilver}
                          </span>
                        </div>
                        {paohuan.bonusHint && (
                          <div className="text-[11px] text-[#ffcf54] font-bold">
                            ★ {paohuan.bonusHint}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        {paohuan.status !== 'idle' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runQuestAction(() => api.abandonPaohuan(realmId))
                            }
                            className="px-2.5 py-1 bg-[#3a1220] border border-[#a8516b] text-[#f5bfd0] text-[11px] hover:brightness-110"
                          >
                            放弃重来
                          </button>
                        ) : (
                          <span className="text-[10.5px] text-[#cbb6cf]">
                            第5环赠丹药/宝图 · 第10环必出金砖+神装
                          </span>
                        )}

                        {paohuan.status === 'idle' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runQuestAction(() => api.acceptPaohuan(realmId))
                            }
                            className="hx-btn-gold px-4 py-1.5 text-xs"
                          >
                            接取第 {paohuan.ring} 环
                          </button>
                        )}
                        {paohuan.status === 'ready' && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runQuestAction(() => api.claimPaohuan(realmId))
                            }
                            className="hx-btn-red px-4 py-1.5 text-xs ring-1 ring-[#ffe678]"
                          >
                            交付领奖！
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* DAILY (每日历练：科举5题 + 运镖1趟 + 整点杀星每日1次) */}
          {panel === 'daily' && (
            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['keju', `科举(${character.daily.keju.answered}/5)`],
                    ['escort', `运镖(${character.daily.escort.completedToday ? '已毕' : '1趟'})`],
                    ['worldboss', `杀星(${character.daily.worldBoss.claimedToday ? '已领' : '1次'})`],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setDailyTab(k)}
                    className={`py-1.5 font-bold border ${
                      dailyTab === k
                        ? 'bg-[#6c1b78] border-[#f2c95b] text-[#ffe985]'
                        : 'bg-[#2a0a30] border-[#774d80] text-[#d6bddc]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 1. 每日科举 5 题 */}
              {dailyTab === 'keju' && (
                <div className="p-2.5 bg-[#2a082f] border-2 border-[#e0b84e] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-[#ffe678]">每日科举文试（5题）</span>
                    <span className="text-[#9ee0ff] font-bold">
                      进度 {character.daily.keju.answered}/5 · 答对 {character.daily.keju.correct}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#e7cfbb]">
                    零消耗轻松拿大量经验与银两！5题全对高中状元加赠 金砖+50、招贤令×1、洗髓丹×1、藏宝图×1。
                  </div>

                  {kejuFeedback && (
                    <div
                      className={`p-2 border text-[11px] space-y-0.5 ${
                        kejuFeedback.correct
                          ? 'bg-[#173019] border-[#5cc466] text-[#d5ffda]'
                          : 'bg-[#3b1518] border-[#d66a6a] text-[#ffd4d4]'
                      }`}
                    >
                      <div className="font-bold">{kejuFeedback.message}</div>
                      <div className="text-[#f0dfb8]">典故解析：{kejuFeedback.explanation}</div>
                    </div>
                  )}

                  {character.daily.keju.completed || !character.daily.keju.currentQuestion ? (
                    <div className="p-3 bg-[#1a2618]/80 border border-[#4b7d48] text-[#bfeec2] text-center font-bold">
                      🎓 今日科举 5 题已全部完成（答对 {character.daily.keju.correct}/5），明日再来金榜题名吧！
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-2.5 bg-black/40 border border-[#966a2e] text-[#fff6d6] font-bold leading-relaxed">
                        第 {character.daily.keju.currentQuestion.index + 1} 题：
                        {character.daily.keju.currentQuestion.question}
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {character.daily.keju.currentQuestion.options.map((opt, idx) => (
                          <button
                            key={idx}
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const res = await api.answerKeju(realmId, idx);
                                onUpdateCharacter(res.character);
                                setKejuFeedback({
                                  correct: res.correct,
                                  message: res.message,
                                  explanation: res.explanation,
                                });
                                onNotify(res.message);
                              } catch (err) {
                                onNotify(err instanceof Error ? err.message : '答题失败');
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="w-full text-left px-3 py-2 bg-[#371040] hover:bg-[#531a61] border border-[#a87c3b] text-[#fff2c2] font-bold"
                          >
                            {['A', 'B', 'C', 'D'][idx]}. {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 2. 每日运镖 1 趟 */}
              {dailyTab === 'escort' && (
                <div className="p-2.5 bg-[#2a082f] border-2 border-[#e0b84e] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-[#ffe678]">皇家重镖（每日 1 趟）</span>
                    <span className="text-[#9ee0ff] font-bold">
                      {character.daily.escort.completedToday
                        ? '今日已交付 ✓'
                        : character.daily.escort.status === 'idle'
                          ? '待接镖'
                          : character.daily.escort.status === 'active'
                            ? '遇劫匪拦路'
                            : '可交付领赏'}
                    </span>
                  </div>
                  <div className="p-2 bg-black/35 border border-[#7c5a2d] space-y-1 text-[11px] text-[#f2dfbe]">
                    <div>单趟厚赏：经验 +{character.daily.escort.rewardExp} · 银两 +{character.daily.escort.rewardSilver} · 金砖 +{character.daily.escort.rewardGold}</div>
                    <div className="text-[#ffcf54] font-bold">★ 额外必得：藏宝图×2、副将经验丹×2</div>
                  </div>

                  {character.daily.escort.completedToday ? (
                    <div className="p-3 bg-[#1a2618]/80 border border-[#4b7d48] text-[#bfeec2] text-center font-bold">
                      🚚 今日重镖已安全送达并领赏，明日再来护镖！
                    </div>
                  ) : character.daily.escort.status === 'idle' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => api.startEscort(realmId),
                          '已接下今日皇家重镖！先击退劫匪再送往目标城池！',
                        )
                      }
                      className="w-full hx-btn-gold py-2 text-xs"
                    >
                      接取今日皇家重镖（每日 1 趟）
                    </button>
                  ) : character.daily.escort.status === 'active' ? (
                    <div className="space-y-2">
                      <div className="text-[#ffeaad]">
                        镖车路线：【{character.daily.escort.originMapName}】 → 【{character.daily.escort.targetMapName}】
                      </div>
                      <div className="text-[#ffb0b0]">
                        黑风寨匪徒半路杀出！击退他们即可安全交付镖车（若战败可回客栈补满重试，不扣次数）。
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const res = await api.battleEscortBandit(realmId);
                            onEnterBattle?.(res.battle);
                          } catch (err) {
                            onNotify(err instanceof Error ? err.message : '开战失败');
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="w-full hx-btn-red py-2 text-xs"
                      >
                        ⚔ 迎战劫镖黑风寨匪徒
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-[#bfeec2] font-bold">
                        ✓ 已击退劫匪！请前往【{character.daily.escort.targetMapName}】交付镖车领取大奖。
                      </div>
                      <div className="text-[11px] text-[#e7cfbb]">
                        当前所在：{character.mapId === character.daily.escort.targetMapId ? '已抵达目标城池！' : `需移动到【${character.daily.escort.targetMapName}】（主界面点「移动」即可到达）`}
                      </div>
                      <button
                        type="button"
                        disabled={busy || character.mapId !== character.daily.escort.targetMapId}
                        onClick={() =>
                          run(() => api.claimEscort(realmId), '交付重镖成功，已领取今日运镖大奖！')
                        }
                        className={`w-full py-2 text-xs font-bold border ${
                          character.mapId === character.daily.escort.targetMapId
                            ? 'hx-btn-gold'
                            : 'bg-[#361c3d] border-[#6a4c73] text-[#9f82a8]'
                        }`}
                      >
                        {character.mapId === character.daily.escort.targetMapId
                          ? '🎁 交付镖车领取今日大奖'
                          : `请先前往【${character.daily.escort.targetMapName}】`}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 3. 整点杀星 / 野外名将（每日 1 次丰厚奖） */}
              {dailyTab === 'worldboss' && (
                <div className="p-2.5 bg-[#2a082f] border-2 border-[#e0b84e] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-black text-sm text-[#ffe678]">
                        【{character.daily.worldBoss.title}】{character.daily.worldBoss.bossName}
                      </div>
                      <div className="text-[11px] text-[#9ee0ff]">
                        本整点现身：{character.daily.worldBoss.mapName}
                        {MAPS[character.daily.worldBoss.mapId]?.region
                          ? `（${MAPS[character.daily.worldBoss.mapId].region}）`
                          : ''}
                        {' · '}约 {character.daily.worldBoss.nextRefreshMinutes} 分钟后换阵
                      </div>
                      <div className="text-[10.5px] text-[#cbe9ff] mt-0.5">
                        可直接点下方按钮在历练台迎战，也可循路前往现场
                        {(() => {
                          const wbRoute = findMapPath(
                            character.mapId,
                            character.daily.worldBoss.mapId,
                          );
                          return wbRoute.length >= 2 ? `（路线：${formatMapRoute(wbRoute)}）` : '';
                        })()}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[11px] font-bold border shrink-0 ${
                        character.daily.worldBoss.claimedToday
                          ? 'bg-[#1a2618] border-[#4b7d48] text-[#bfeec2]'
                          : 'bg-[#7d1428] border-[#ffca5c] text-[#ffe899]'
                      }`}
                    >
                      {character.daily.worldBoss.claimedToday ? '今日已领奖 ✓' : '每日1次厚赏'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#e7cfbb] leading-relaxed">
                    {character.daily.worldBoss.desc}
                  </div>
                  <div className="p-2 bg-black/35 border border-[#7c5a2d] space-y-1 text-[11px] text-[#f2dfbe]">
                    <div>强度随你的主角等级自动匹配（单人携副将即可挑战，小服不抢怪不内卷）。</div>
                    <div className="text-[#ffcf54] font-bold">
                      ★ 每日首杀厚赏：大量经验与银两、金砖+45、洗髓丹×1、必得技能书×1 或 招贤令×2，更有 50% 几率爆同阶神兵极品！
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const res = await api.challengeWorldBoss(realmId);
                        onEnterBattle?.(res.battle);
                      } catch (err) {
                        onNotify(err instanceof Error ? err.message : '挑战失败');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="w-full hx-btn-red py-2 text-xs"
                  >
                    {character.daily.worldBoss.claimedToday
                      ? `⚔ 再次切磋【${character.daily.worldBoss.bossName}】`
                      : `⚔ 迎战本整点星宿【${character.daily.worldBoss.bossName}】`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TOWER (天玄塔50层爬塔与每日扫荡) */}
          {panel === 'tower' && (
            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 bg-[#2a082f] border-2 border-[#e0b84e] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-black text-sm text-[#ffe678]">
                      天玄塔 · 最高通关 {character.tower.highestFloor} / {character.tower.maxFloor} 层
                    </div>
                    <div className="text-[11px] text-[#e7cfbb]">
                      检验主角与副将阵容实力的经典单人爬塔试炼
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={busy || character.tower.highestFloor === 0 || character.tower.dailySwept}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const res = await api.sweepTower(realmId);
                        onUpdateCharacter(res.character);
                        onNotify(res.message);
                      } catch (err) {
                        onNotify(err instanceof Error ? err.message : '扫荡失败');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className={`px-2.5 py-1 text-[11px] font-bold border shrink-0 ${
                      character.tower.highestFloor > 0 && !character.tower.dailySwept
                        ? 'hx-btn-gold'
                        : 'bg-[#361c3d] border-[#6a4c73] text-[#9f82a8]'
                    }`}
                  >
                    {character.tower.dailySwept ? '今日已扫荡' : '每日扫荡'}
                  </button>
                </div>

                {/* Next floor card */}
                <div className="p-2 bg-black/35 border border-[#7c5a2d] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#ffeaad]">
                      下一挑战：{character.tower.nextFloorName}
                    </span>
                    <span className="text-[#9ee0ff]">
                      推荐 Lv.{character.tower.nextFloorRecLevel}
                    </span>
                  </div>
                  {character.tower.nextFloorMilestone && (
                    <div className="text-[11px] text-[#ffcf54] font-bold">
                      ★ {character.tower.nextFloorMilestone}
                    </div>
                  )}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const targetFloor = Math.min(
                            character.tower.maxFloor,
                            character.tower.highestFloor + 1,
                          );
                          const res = await api.challengeTower(realmId, targetFloor);
                          onEnterBattle?.(res.battle);
                        } catch (err) {
                          onNotify(err instanceof Error ? err.message : '进入天玄塔失败');
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="hx-btn-red px-4 py-1.5 text-xs"
                    >
                      {character.tower.highestFloor >= character.tower.maxFloor
                        ? '再战第 50 层·魔神吕布'
                        : `挑战第 ${character.tower.highestFloor + 1} 层`}
                    </button>
                  </div>
                </div>
              </div>

              {/* Milestone Floors Overview */}
              <div className="space-y-1">
                <div className="text-[11px] text-[#e7cfbb] font-bold">镇塔名将层首通大奖</div>
                {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((fl) => {
                  const meta = getTowerFloorMeta(fl);
                  const cleared = character.tower.highestFloor >= fl;
                  return (
                    <div
                      key={fl}
                      className={`p-2 border flex items-center justify-between gap-2 ${
                        cleared
                          ? 'bg-[#1a2618]/80 border-[#4b7d48] text-[#bfeec2]'
                          : 'bg-[#26072d]/85 border-[#8e6299] text-[#f3e3f7]'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-bold">{meta.name}</div>
                        <div className="text-[10.5px] text-[#ffd873]">{meta.milestone}</div>
                      </div>
                      <span className="text-[11px] font-bold shrink-0">
                        {cleared ? '已首通 ✓' : `Lv.${meta.recLevel}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CASINO (许昌赌坊：定时开盘 · 猜大小/豹子 + 赤壁押注 + 连续历史记录) */}
          {panel === 'casino' && (() => {
            const gameState = casinoState ? casinoState[casinoTab] : null;
            const currentRound = gameState?.currentRound ?? null;
            const estNow = casinoNow + casinoClockOffset;
            const remainMs = currentRound ? Math.max(0, currentRound.drawAt - estNow) : 0;
            const remainSec = Math.ceil(remainMs / 1000);
            const isLocked = currentRound ? remainMs <= currentRound.lockBeforeSec * 1000 : false;
            const mm = String(Math.floor(remainSec / 60)).padStart(2, '0');
            const ss = String(remainSec % 60).padStart(2, '0');

            const choiceLabels: Record<string, string> = {
              big: '大',
              small: '小',
              odd: '单',
              even: '双',
              baozi: '豹子',
              wei: '魏军',
              wu: '吴军',
              shu: '蜀军',
            };

            const fmtTime = (ts: number) =>
              new Date(ts).toLocaleTimeString('zh-CN', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
              });

            const placeDice = async (bt: 'big' | 'small' | 'odd' | 'even' | 'baozi') => {
              setBusy(true);
              try {
                const res = await api.playCasinoDice({
                  realmId,
                  betType: bt,
                  currency: betCurrency,
                  amount: betAmount,
                });
                pendingCasinoBetIdsRef.current.add(res.bet.id);
                setCasinoState(res.state);
                setCasinoClockOffset(res.state.serverNow - Date.now());
                onUpdateCharacter(res.character);
                onNotify(res.message);
              } catch (err) {
                onNotify(err instanceof Error ? err.message : '下注失败');
              } finally {
                setBusy(false);
              }
            };

            const placeChibi = async (pick: 'wei' | 'wu' | 'shu') => {
              setBusy(true);
              try {
                const res = await api.playCasinoChibi({
                  realmId,
                  pick,
                  currency: betCurrency,
                  amount: betAmount,
                });
                pendingCasinoBetIdsRef.current.add(res.bet.id);
                setCasinoState(res.state);
                setCasinoClockOffset(res.state.serverNow - Date.now());
                onUpdateCharacter(res.character);
                onNotify(res.message);
              } catch (err) {
                onNotify(err instanceof Error ? err.message : '押注失败');
              } finally {
                setBusy(false);
              }
            };

            const latestSettled = gameState?.history[0] ?? null;

            return (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between bg-[#230629]/90 border border-[#9d6fa8] px-2.5 py-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-[#ffe27a] font-bold">银两：{character.silver}</span>
                    <span className="text-[#ffd24d] font-bold">金砖：{character.gold}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void syncCasinoState(false)}
                    className="px-2 py-0.5 text-[11px] bg-[#3f164a] border border-[#b587c2] text-[#f5defa] hover:brightness-110"
                  >
                    刷新盘口
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCasinoTab('dice')}
                    className={`py-1.5 font-bold border ${
                      casinoTab === 'dice'
                        ? 'bg-[#c96215] border-[#ffdf75] text-white'
                        : 'bg-[#5c2569] border-[#a574b0] text-[#f3e3f7]'
                    }`}
                  >
                    🎲 猜大小/豹子 ({Math.round((casinoState?.dice.intervalSec ?? 180) / 60)}分/期)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCasinoTab('chibi')}
                    className={`py-1.5 font-bold border ${
                      casinoTab === 'chibi'
                        ? 'bg-[#c96215] border-[#ffdf75] text-white'
                        : 'bg-[#5c2569] border-[#a574b0] text-[#f3e3f7]'
                    }`}
                  >
                    🔥 赤壁押注 ({Math.round((casinoState?.chibi.intervalSec ?? 300) / 60)}分/期)
                  </button>
                </div>

                {/* Live Scheduled Round Countdown & Pool Banner */}
                {currentRound ? (
                  <div className="p-2.5 bg-[#1b0520] border-2 border-[#d4a33b] space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#ffe377] font-black text-sm">
                          第 {currentRound.roundNo} 期
                        </span>
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold border ${
                            isLocked
                              ? 'bg-[#6e1515] border-[#ff8080] text-[#ffe1e1]'
                              : 'bg-[#174623] border-[#69eb87] text-[#d6ffe0]'
                          }`}
                        >
                          {isLocked ? '封盘开奖中' : '开盘投注中'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-[#e7cfbb] mr-1">距开奖</span>
                        <span
                          className={`font-mono text-base font-black tracking-wider ${
                            isLocked ? 'text-[#ff7878]' : 'text-[#ffe97a]'
                          }`}
                        >
                          {mm}:{ss}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#e8d2ee] border-t border-white/10 pt-1">
                      <span>
                        本期奖池：<b className="text-white">{currentRound.totalBets}</b> 笔
                      </span>
                      <span>
                        银 <b className="text-[#ffe27a]">{currentRound.totalSilverBet}</b> · 金{' '}
                        <b className="text-[#ffd24d]">{currentRound.totalGoldBet}</b>
                      </span>
                    </div>

                    {currentRound.poolByChoice &&
                      Object.keys(currentRound.poolByChoice).length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {Object.entries(currentRound.poolByChoice).map(([k, v]) => (
                            <span
                              key={k}
                              className="px-1.5 py-0.5 text-[10.5px] bg-[#2e0c36] border border-[#7c5087] text-[#f4dff9]"
                            >
                              {choiceLabels[k] || k}：{v.silver > 0 ? `${v.silver}银` : ''}
                              {v.silver > 0 && v.gold > 0 ? '+' : ''}
                              {v.gold > 0 ? `${v.gold}金` : ''}
                            </span>
                          ))}
                        </div>
                      )}

                    {gameState && gameState.myCurrentBets.length > 0 && (
                      <div className="bg-[#13311a]/90 border border-[#5ad175] px-2 py-1 text-[11px] text-[#d9ffe2]">
                        <span className="font-bold text-[#8cffaa]">我本期已押：</span>
                        {gameState.myCurrentBets
                          .map(
                            (b) =>
                              `${choiceLabels[b.choice] || b.choice} ${b.amount}${
                                b.currency === 'gold' ? '金' : '银'
                              }`,
                          )
                          .join('、')}
                        <span className="text-[#a8e8b8] ml-1">（到点自动开奖派彩）</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 text-center text-[#d8bede] bg-[#230629] border border-[#84578f]">
                    正在连接许昌赌坊盘口...
                  </div>
                )}

                {/* Currency & Stake Controls */}
                <div className="p-2 bg-[#26072d]/90 border border-[#8e6299] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[#e7cfbb]">下注货币：</span>
                    <div className="flex gap-1.5">
                      {(['silver', 'gold'] as const).map((cur) => (
                        <button
                          key={cur}
                          type="button"
                          onClick={() => {
                            setBetCurrency(cur);
                            setBetAmount(cur === 'gold' ? 20 : 200);
                          }}
                          className={`px-2.5 py-0.5 font-bold border ${
                            betCurrency === cur
                              ? 'bg-[#c9952b] text-[#240a04] border-[#fff09a]'
                              : 'bg-[#2a0a30] text-[#f0d9f5] border-[#8b6232]'
                          }`}
                        >
                          {cur === 'silver' ? '银两' : '金砖'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[#e7cfbb]">筹码：</span>
                    {(betCurrency === 'silver' ? [100, 500, 2000, 10000] : [10, 50, 200, 500]).map(
                      (amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setBetAmount(amt)}
                          className={`px-2 py-0.5 border font-bold ${
                            betAmount === amt
                              ? 'bg-[#b82018] border-[#ffd86b] text-[#fff6cc]'
                              : 'bg-[#381440] border-[#8c6496] text-[#f0d9f5]'
                          }`}
                        >
                          {amt}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                {/* Betting Buttons */}
                {casinoTab === 'dice' && (
                  <div className="p-2.5 bg-[#2a082f] border-2 border-[#e0b84e] space-y-2">
                    <div className="text-[11px] text-[#f2dcf7]">
                      每 {Math.round((casinoState?.dice.intervalSec ?? 180) / 60)} 分钟定时开盅：大(11~18)/小(3~10)/单/双 赔率{' '}
                      <b className="text-[#ffe46e]">1:1</b>（开豹子通吃非豹子注），押中
                      <b className="text-[#ff8cc8]">豹子</b>狂赢{' '}
                      <b className="text-[#ffcf54]">1:15</b>！支持同期多笔组合下注。
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          ['big', '押 大 (11~18) 1:1'],
                          ['small', '押 小 (3~10) 1:1'],
                          ['odd', '押 单数 1:1'],
                          ['even', '押 双数 1:1'],
                        ] as const
                      ).map(([bt, label]) => (
                        <button
                          key={bt}
                          type="button"
                          disabled={busy || isLocked || !currentRound}
                          onClick={() => void placeDice(bt)}
                          className="hx-btn-gold py-1.5 text-xs disabled:opacity-50"
                        >
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={busy || isLocked || !currentRound}
                        onClick={() => void placeDice('baozi')}
                        className="col-span-2 hx-btn-red py-1.5 text-xs disabled:opacity-50"
                      >
                        🎲 搏一搏 · 押豹子（1:15 暴富！）
                      </button>
                    </div>
                  </div>
                )}

                {casinoTab === 'chibi' && (
                  <div className="p-2.5 bg-[#2a082f] border-2 border-[#e0b84e] space-y-2">
                    <div className="text-[11px] text-[#f2dcf7]">
                      每 {Math.round((casinoState?.chibi.intervalSec ?? 300) / 60)} 分钟定时开战：选定阵营下注，倒计时归零全服同步开盘派奖！
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          ['wei', '押 魏军', '2.1倍', 'bg-[#1b3a6b] border-[#7cb5ff]'],
                          ['wu', '押 吴军', '2.3倍', 'bg-[#6b1919] border-[#ff8b8b]'],
                          ['shu', '押 蜀军', '4.2倍', 'bg-[#1d5428] border-[#82ff99]'],
                        ] as const
                      ).map(([pick, label, mult, cls]) => (
                        <button
                          key={pick}
                          type="button"
                          disabled={busy || isLocked || !currentRound}
                          onClick={() => void placeChibi(pick)}
                          className={`py-2 border text-white font-bold hover:brightness-110 disabled:opacity-50 ${cls}`}
                        >
                          <div>{label}</div>
                          <div className="text-[10.5px] text-[#ffe678]">{mult}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Latest Settled Round Spotlight */}
                {latestSettled && (
                  <div className="p-2 bg-[#1c0722] border border-[#a87c35] space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-[#e7cfbb]">
                      <span className="font-bold text-[#ffe27a]">
                        上期开奖 · 第 {latestSettled.roundNo} 期
                      </span>
                      <span>{fmtTime(latestSettled.drawAt)}</span>
                    </div>
                    {casinoTab === 'dice' && latestSettled.dice ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black tracking-widest text-[#ffe878]">
                          [ {latestSettled.dice[0]} ] [ {latestSettled.dice[1]} ] [{' '}
                          {latestSettled.dice[2]} ]
                        </span>
                        <span className="font-bold text-white">
                          {latestSettled.isBaozi
                            ? '🔥 豹子通吃！'
                            : `${latestSettled.sum}点 · ${(latestSettled.sum ?? 0) >= 11 ? '大' : '小'} / ${
                                (latestSettled.sum ?? 0) % 2 === 1 ? '单' : '双'
                              }`}
                        </span>
                      </div>
                    ) : (
                      latestSettled.chibiWinner && (
                        <div className="space-y-0.5">
                          <div className="font-bold text-[#ffe878]">
                            胜出阵营：【{choiceLabels[latestSettled.chibiWinner]}】
                          </div>
                          {latestSettled.chibiReport && (
                            <div className="text-[11px] text-[#f0d8f5]">
                              ⚔ {latestSettled.chibiReport}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* History / My Bets / Winners Sub-tabs */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      type="button"
                      onClick={() => setCasinoRecordTab('history')}
                      className={`py-1 text-[11px] font-bold border ${
                        casinoRecordTab === 'history'
                          ? 'bg-[#7d4916] border-[#ffdf75] text-[#fff6cc]'
                          : 'bg-[#2a0a31] border-[#734a7d] text-[#d6badc]'
                      }`}
                    >
                      📜 开奖记录
                    </button>
                    <button
                      type="button"
                      onClick={() => setCasinoRecordTab('mybets')}
                      className={`py-1 text-[11px] font-bold border ${
                        casinoRecordTab === 'mybets'
                          ? 'bg-[#7d4916] border-[#ffdf75] text-[#fff6cc]'
                          : 'bg-[#2a0a31] border-[#734a7d] text-[#d6badc]'
                      }`}
                    >
                      🧾 注单({gameState?.myRecentBets.length ?? 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCasinoRecordTab('winners')}
                      className={`py-1 text-[11px] font-bold border ${
                        casinoRecordTab === 'winners'
                          ? 'bg-[#7d4916] border-[#ffdf75] text-[#fff6cc]'
                          : 'bg-[#2a0a31] border-[#734a7d] text-[#d6badc]'
                      }`}
                    >
                      🏆 大户榜
                    </button>
                  </div>

                  {casinoRecordTab === 'history' && gameState && (
                    <div className="max-h-[220px] overflow-y-auto hx-scroll divide-y divide-white/10 border border-[#7c5087] bg-[#18051d]/90">
                      {gameState.history.map((r) => {
                        const played = (r.myBetCount ?? 0) > 0;
                        const myWinSilver = r.mySilverPayout ?? 0;
                        const myWinGold = r.myGoldPayout ?? 0;
                        const wonAny = myWinSilver > 0 || myWinGold > 0;
                        return (
                          <div
                            key={r.id}
                            className="px-2 py-1.5 flex items-center justify-between gap-2 text-[11px]"
                          >
                            <div className="min-w-0">
                              <span className="text-[#ffd875] font-bold mr-1.5">
                                #{r.roundNo}
                              </span>
                              <span className="text-[#bfa2c7] mr-1.5">{fmtTime(r.drawAt)}</span>
                              {casinoTab === 'dice' && r.dice ? (
                                <span className="text-white font-bold">
                                  [{r.dice[0]}·{r.dice[1]}·{r.dice[2]}]{' '}
                                  {r.isBaozi ? (
                                    <span className="text-[#ffcf54]">豹子</span>
                                  ) : (
                                    <span>
                                      {r.sum}点{' '}
                                      <span
                                        className={
                                          (r.sum ?? 0) >= 11 ? 'text-[#ff8c8c]' : 'text-[#82c0ff]'
                                        }
                                      >
                                        {(r.sum ?? 0) >= 11 ? '大' : '小'}
                                      </span>
                                      /{(r.sum ?? 0) % 2 === 1 ? '单' : '双'}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="font-bold text-white">
                                  {r.chibiWinner ? choiceLabels[r.chibiWinner] : '-'}胜
                                </span>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              {played ? (
                                wonAny ? (
                                  <span className="text-[#7dff92] font-bold">
                                    中{' '}
                                    {[
                                      myWinSilver > 0 ? `+${myWinSilver}银` : '',
                                      myWinGold > 0 ? `+${myWinGold}金` : '',
                                    ]
                                      .filter(Boolean)
                                      .join(' ')}
                                  </span>
                                ) : (
                                  <span className="text-[#ff8e96]">未中</span>
                                )
                              ) : r.totalBets > 0 ? (
                                <span className="text-[#c5a8cc]">{r.totalBets}注</span>
                              ) : (
                                <span className="text-[#886d8f]">无人下注</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {casinoRecordTab === 'mybets' && gameState && (
                    <div className="max-h-[220px] overflow-y-auto hx-scroll divide-y divide-white/10 border border-[#7c5087] bg-[#18051d]/90">
                      {gameState.myRecentBets.length === 0 ? (
                        <div className="p-3 text-center text-[#b79bbe]">
                          暂未在本玩法下注，选好筹码即可参与本期开盘！
                        </div>
                      ) : (
                        gameState.myRecentBets.map((b) => {
                          const unit = b.currency === 'gold' ? '金' : '银';
                          return (
                            <div
                              key={b.id}
                              className="px-2 py-1.5 flex items-center justify-between gap-2 text-[11px]"
                            >
                              <div>
                                <span className="text-[#ffd875] font-bold mr-1.5">
                                  第{b.roundNo}期
                                </span>
                                <span className="text-white font-bold mr-1">
                                  押【{choiceLabels[b.choice] || b.choice}】
                                </span>
                                <span className="text-[#e7cfbb]">
                                  {b.amount}
                                  {unit}
                                </span>
                              </div>
                              <div className="shrink-0 font-bold">
                                {b.status === 'pending' && (
                                  <span className="text-[#ffe478]">待开奖</span>
                                )}
                                {b.status === 'won' && (
                                  <span className="text-[#7dff92]">
                                    中奖 +{b.payout}
                                    {unit}
                                  </span>
                                )}
                                {b.status === 'lost' && (
                                  <span className="text-[#ff8e96]">未中</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {casinoRecordTab === 'winners' && gameState && (
                    <div className="space-y-2 border border-[#7c5087] bg-[#18051d]/90 p-2 text-[11px]">
                      <div>
                        <div className="font-bold text-[#ffe478] mb-1">
                          🎊 最近中奖大户榜
                        </div>
                        {gameState.lastRoundTopWinners.length === 0 ? (
                          <div className="text-[#b79bbe]">近期尚无中奖记录，快来夺得头彩！</div>
                        ) : (
                          <div className="space-y-1">
                            {gameState.lastRoundTopWinners.map((w, idx) => (
                              <div
                                key={`${w.characterId}-${idx}`}
                                className="flex items-center justify-between border-b border-white/10 pb-0.5"
                              >
                                <span>
                                  <span className="text-[#ffd875] mr-1">第{w.roundNo}期</span>
                                  <button
                                    type="button"
                                    onClick={() => onInspectPlayer?.(w.characterId)}
                                    className="font-bold text-white hover:underline"
                                  >
                                    {w.characterName}
                                  </button>
                                  <span className="text-[#cbb0d4] ml-1">
                                    押[{choiceLabels[w.choice] || w.choice}]
                                  </span>
                                </span>
                                <span className="text-[#7dff92] font-bold">
                                  +{w.payout}
                                  {w.currency === 'gold' ? '金' : '银'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-1 border-t border-white/15">
                        <div className="font-bold text-[#ffcf54] mb-1">
                          👑 今日赌神榜（本服当日累计派彩）
                        </div>
                        {gameState.todayLeaderboard.length === 0 ? (
                          <div className="text-[#b79bbe]">今日暂无人上榜，虚位以待！</div>
                        ) : (
                          <div className="space-y-1">
                            {gameState.todayLeaderboard.map((row) => (
                              <div
                                key={row.characterId}
                                className="flex items-center justify-between"
                              >
                                <span>
                                  <span className="text-[#ffd24d] font-bold mr-1">
                                    {row.rank}.
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => onInspectPlayer?.(row.characterId)}
                                    className="font-bold text-white hover:underline"
                                  >
                                    {row.characterName}
                                  </button>
                                  <span className="text-[#bda4c4] ml-1">({row.winCount}次命中)</span>
                                </span>
                                <span className="text-[#ffe27a] font-bold">
                                  {[
                                    row.totalSilverWon > 0 ? `${row.totalSilverWon}银` : '',
                                    row.totalGoldWon > 0 ? `${row.totalGoldWon}金` : '',
                                  ]
                                    .filter(Boolean)
                                    .join(' + ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* FRIENDS PANEL (4.7 江湖好友) */}
          {panel === 'friends' && (() => {
            const handleAddFriend = async () => {
              if (busy || !friendNameInput.trim()) return;
              setBusy(true);
              try {
                const res = await api.addFriend(realmId, {
                  targetName: friendNameInput.trim(),
                });
                setFriends(res.friends);
                onUpdateCharacter(res.character);
                setFriendNameInput('');
                onNotify(res.message);
              } catch (err) {
                onNotify(err instanceof Error ? err.message : '添加好友失败');
              } finally {
                setBusy(false);
              }
            };
            return (
            <div className="space-y-2.5 text-xs">
              <div className="flex gap-1.5">
                <input
                  type="text"
                  maxLength={20}
                  value={friendNameInput}
                  onChange={(e) => setFriendNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void handleAddFriend();
                    }
                  }}
                  placeholder="输入玩家名号加为好友..."
                  className="flex-1 px-2 py-1.5 bg-[#120416] border border-[#9e7430] text-white"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleAddFriend()}
                  className="hx-btn-gold px-3 py-1"
                >
                  加好友
                </button>
              </div>

              <div className="space-y-1.5">
                {friends.length === 0 ? (
                  <div className="text-center text-[#d2bad8] py-6">
                    暂无好友，点击同图在线玩家或输入名号即可结交江湖豪杰！
                  </div>
                ) : (
                  friends.map((f) => (
                    <div
                      key={f.characterId}
                      className="p-2 bg-[#26072d]/90 border border-[#9d6fa8] flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => onInspectPlayer?.(f.characterId)}
                        className="flex items-center gap-2 min-w-0 text-left"
                      >
                        <AssetImg
                          path={`portraits/${f.portrait}`}
                          alt={f.name}
                          className="w-9 h-9 pixelated border border-[#d6ab48] shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-[#ffe678] truncate">
                            {f.name}{' '}
                            <span
                              className={`text-[10px] px-1 border ${
                                f.online
                                  ? 'bg-[#174d24] border-[#7dff92] text-[#d6ffe0]'
                                  : 'bg-[#2e2033] border-[#7d6885] text-[#b8a5bf]'
                              }`}
                            >
                              {f.online ? '在线' : '离线'}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#e6d0ed]">
                            {ROLE_CLASS_META[f.roleClass].label} · Lv.{f.level}
                            {f.rebirth > 0 ? ` [${f.rebirth}转]` : ''} · {f.mapName}
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onStartWhisper?.(f.name)}
                          className="px-2 py-0.5 text-[11px] bg-[#6e247c] border border-[#e396f0] text-[#ffe6ff] font-bold"
                        >
                          私聊
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const res = await api.removeFriend(realmId, f.characterId);
                              setFriends(res.friends);
                              onUpdateCharacter(res.character);
                              onNotify(res.message);
                            } catch (err) {
                              onNotify(err instanceof Error ? err.message : '移除失败');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="px-1.5 py-0.5 text-[10.5px] bg-[#4a1a1f] border border-[#b8666e] text-[#ffd4d8]"
                        >
                          删
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            );
          })()}

          {/* PLAYER INSPECT PANEL (4.7 查看侠士资料/装备/副将/加好友/私聊/切磋) */}
          {panel === 'inspect' && (
            <div className="space-y-2.5 text-xs">
              {!inspectedPlayer ? (
                <div className="text-center text-[#d2bad8] py-8">正在读取侠士资料...</div>
              ) : (
                <>
                  <div className="p-2.5 bg-[#230629]/95 border-2 border-[#e0b84e] flex items-center gap-3">
                    <AssetImg
                      path={`portraits/${inspectedPlayer.portrait}`}
                      alt={inspectedPlayer.name}
                      className="w-12 h-12 pixelated border-2 border-[#e0b84e] shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-black text-[#ffe478]">
                          {inspectedPlayer.rebirth > 0 ? `[${inspectedPlayer.rebirth}转]` : ''}
                          {inspectedPlayer.name}
                        </span>
                        <span
                          className={`text-[10px] px-1 border ${
                            inspectedPlayer.online
                              ? 'bg-[#174d24] border-[#7dff92] text-[#d6ffe0]'
                              : 'bg-[#2e2033] border-[#7d6885] text-[#b8a5bf]'
                          }`}
                        >
                          {inspectedPlayer.online ? '在线' : '离线'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#e8d2ee]">
                        {ROLE_CLASS_META[inspectedPlayer.roleClass].label} · Lv.{inspectedPlayer.level}{' '}
                        · 位于 {inspectedPlayer.mapName}
                      </div>
                      <div className="text-[11px] text-[#9be8ff]">
                        血{inspectedPlayer.maxHp} 攻{inspectedPlayer.atk} 防{inspectedPlayer.def} 速
                        {inspectedPlayer.spd} · 塔{inspectedPlayer.towerFloor}层 · 擂台
                        {inspectedPlayer.arenaWins}胜{inspectedPlayer.arenaLosses}负
                      </div>
                    </div>
                  </div>

                  {inspectedPlayer.id !== character.id && (
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => onStartWhisper?.(inspectedPlayer.name)}
                        className="py-1.5 bg-[#6e247c] border border-[#e396f0] text-[#ffe6ff] font-bold"
                      >
                        💬 发起私聊
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            if (inspectedPlayer.isFriend) {
                              const res = await api.removeFriend(realmId, inspectedPlayer.id);
                              onUpdateCharacter(res.character);
                              setInspectedPlayer({ ...inspectedPlayer, isFriend: false });
                              onNotify(res.message);
                            } else {
                              const res = await api.addFriend(realmId, {
                                targetCharacterId: inspectedPlayer.id,
                              });
                              onUpdateCharacter(res.character);
                              setInspectedPlayer({ ...inspectedPlayer, isFriend: true });
                              onNotify(res.message);
                            }
                          } catch (err) {
                            onNotify(err instanceof Error ? err.message : '操作失败');
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="hx-btn-gold py-1.5 text-xs"
                      >
                        {inspectedPlayer.isFriend ? '✓ 删好友' : '+ 加好友'}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const res = await api.challengeArena(realmId, inspectedPlayer.id);
                            onEnterBattle?.(res.battle);
                          } catch (err) {
                            onNotify(err instanceof Error ? err.message : '发起切磋失败');
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="hx-btn-red py-1.5 text-xs"
                      >
                        ⚔ 镜像切磋
                      </button>
                    </div>
                  )}

                  {/* Equipped Gear */}
                  <div className="p-2 bg-[#230629]/90 border border-[#9d6fa8] space-y-1">
                    <div className="font-bold text-[#ffea84]">
                      穿戴装备 ({inspectedPlayer.equippedItems.length}/5)
                    </div>
                    {inspectedPlayer.setBonuses.length > 0 && (
                      <div className="text-[10.5px] text-[#7dff92]">
                        ✨ {inspectedPlayer.setBonuses.join('；')}
                      </div>
                    )}
                    {inspectedPlayer.equippedItems.length === 0 ? (
                      <div className="text-[#b8a2bf]">暂未穿戴装备</div>
                    ) : (
                      inspectedPlayer.equippedItems.map((eq) => (
                        <div key={eq.id} className="flex items-center justify-between text-[11px]">
                          <span className={`font-bold ${QUALITY_COLOR[eq.quality]}`}>
                            [{EQUIPMENT_SLOT_LABELS[eq.slot]}] {eq.name}
                          </span>
                          <span className="text-[#e0c8e6] truncate ml-2">
                            {formatEquipStats(eq)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Active Generals */}
                  <div className="p-2 bg-[#230629]/90 border border-[#9d6fa8] space-y-1.5">
                    <div className="font-bold text-[#ffea84]">
                      出战副将 ({inspectedPlayer.activeGenerals.length}/3)
                    </div>
                    {inspectedPlayer.activeGenerals.length === 0 ? (
                      <div className="text-[#b8a2bf]">暂无出战副将</div>
                    ) : (
                      inspectedPlayer.activeGenerals.map((g) => (
                        <div key={g.id} className="flex items-center gap-2 text-[11px]">
                          <AssetImg
                            path={`portraits/${g.avatarKey}`}
                            alt={g.name}
                            className="w-8 h-8 pixelated border border-[#d6ab48]"
                          />
                          <div>
                            <div className={`font-bold ${QUALITY_COLOR[g.rarity]}`}>
                              {g.name} Lv.{g.level}
                              {g.rebirth > 0 ? ` [${g.rebirth}转]` : ''} · 成长{g.growth.toFixed(2)}
                            </div>
                            <div className="text-[#dfcae6]">
                              血{g.maxHp} · 攻{g.atk} · 速{g.spd}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* BANK (许昌钱庄：存取与金银兑换) */}
          {panel === 'bank' && (() => {
            const rawBankAmt = Number(bankAmount);
            const amt =
              bankAmount.trim() && Number.isFinite(rawBankAmt) ? Math.floor(rawBankAmt) : 0;
            const doBank = async (
              action:
                | 'deposit_silver'
                | 'withdraw_silver'
                | 'deposit_gold'
                | 'withdraw_gold'
                | 'gold_to_silver'
                | 'silver_to_gold',
              amount: number,
            ) => {
              if (busy) return;
              if (!Number.isFinite(amount) || amount < 1) {
                onNotify('请输入大于 0 的数额');
                return;
              }
              setBusy(true);
              try {
                const res = await api.bankTransfer({ realmId, action, amount });
                onUpdateCharacter(res.character);
                onNotify(res.message);
              } catch (err) {
                onNotify(err instanceof Error ? err.message : '钱庄操作失败');
              } finally {
                setBusy(false);
              }
            };
            return (
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-[#26072d]/90 border border-[#9d6fa8] space-y-0.5">
                    <div className="text-[#d9c1e0] text-[11px]">随身携带</div>
                    <div className="text-white font-bold">银两：{character.silver}</div>
                    <div className="text-[#ffe04b] font-bold">金砖：{character.gold}</div>
                  </div>
                  <div className="p-2 bg-[#2a1408]/90 border border-[#e0b84e] space-y-0.5">
                    <div className="text-[#f7d89c] text-[11px]">钱庄金库（集市收款直达）</div>
                    <div className="text-white font-bold">存银：{character.bank.silver}</div>
                    <div className="text-[#ffe04b] font-bold">存金：{character.bank.gold}</div>
                  </div>
                </div>

                <div className="p-2.5 bg-[#2a082f] border border-[#b88b3d] space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[#ffe485] font-bold shrink-0">存取数额：</span>
                    <input
                      type="number"
                      min={1}
                      value={bankAmount}
                      onChange={(e) => setBankAmount(e.target.value)}
                      className="flex-1 px-2 py-1 bg-[#120416] border border-[#9e7430] text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void doBank('deposit_silver', amt)}
                      className="hx-btn-gold py-1.5"
                    >
                      存入银两
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void doBank('withdraw_silver', amt)}
                      className="hx-btn-gold py-1.5"
                    >
                      取出银两
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void doBank('deposit_gold', amt)}
                      className="px-2 py-1.5 bg-[#5c3d0c] border border-[#f0c756] text-[#fff2b3] font-bold"
                    >
                      存入金砖
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void doBank('withdraw_gold', amt)}
                      className="px-2 py-1.5 bg-[#5c3d0c] border border-[#f0c756] text-[#fff2b3] font-bold"
                    >
                      取出金砖
                    </button>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    <button
                      type="button"
                      disabled={busy || character.bank.silver <= 0}
                      onClick={() => void doBank('withdraw_silver', character.bank.silver)}
                      className="flex-1 py-1 bg-[#1e4a2b] border border-[#72e089] text-[#d6ffde] text-[11px] font-bold"
                    >
                      一键提取全部存银
                    </button>
                    <button
                      type="button"
                      disabled={busy || character.bank.gold <= 0}
                      onClick={() => void doBank('withdraw_gold', character.bank.gold)}
                      className="flex-1 py-1 bg-[#1e4a2b] border border-[#72e089] text-[#d6ffde] text-[11px] font-bold"
                    >
                      一键提取全部存金
                    </button>
                  </div>
                </div>

                {/* Classic Gold <-> Silver Exchange */}
                <div className="p-2.5 bg-[#2a082f] border border-[#b88b3d] space-y-2">
                  <div className="font-bold text-[#ffe678]">金银兑汇（实时汇率）</div>
                  <div className="text-[11px] text-[#e7cfbb]">
                    · 1 金砖 → 500 银两（免手续费） · 550 银两 → 1 金砖
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void doBank('gold_to_silver', 10)}
                      className="hx-btn-gold py-1.5 text-[11px]"
                    >
                      10 金砖 → 5000 银
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void doBank('silver_to_gold', 10)}
                      className="hx-btn-gold py-1.5 text-[11px]"
                    >
                      5500 银 → 10 金砖
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void doBank('gold_to_silver', 50)}
                      className="hx-btn-gold py-1.5 text-[11px]"
                    >
                      50 金砖 → 25000 银
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void doBank('silver_to_gold', 50)}
                      className="hx-btn-gold py-1.5 text-[11px]"
                    >
                      27500 银 → 50 金砖
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* MARKET (许昌集市：离线摆摊寄售装备/副将/道具) */}
          {panel === 'market' && (() => {
            const refreshMarket = async () => {
              const r = await api.getMarketListings(
                realmId,
                marketTab === 'mine' ? 'all' : marketFilter,
              );
              setListings(r.listings);
            };
            const visibleListings =
              marketTab === 'mine'
                ? listings.filter((l) => l.sellerId === character.id)
                : listings;
            const unequippedGear = character.equipment.filter((e) => !e.equipped);
            const benchedGenerals = character.generals.filter((g) => g.slot === null);
            const rawSellPrice = Number(sellPrice);
            const parsedPrice =
              sellPrice.trim() && Number.isFinite(rawSellPrice) ? Math.floor(rawSellPrice) : 0;

            const handleSell = async (kind: MarketListingKind, refId: string | number) => {
              if (busy) return;
              if (parsedPrice < 1) {
                onNotify('请输入大于 0 的上架价格');
                return;
              }
              setBusy(true);
              try {
                const res = await api.createMarketListing({
                  realmId,
                  kind,
                  refId,
                  quantity: 1,
                  currency: sellCurrency,
                  price: parsedPrice,
                });
                onUpdateCharacter(res.character);
                onNotify(res.message);
                await refreshMarket();
              } catch (err) {
                onNotify(err instanceof Error ? err.message : '上架失败');
              } finally {
                setBusy(false);
              }
            };

            return (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between bg-[#230629]/90 border border-[#9d6fa8] px-2.5 py-1.5">
                  <span className="text-[#ffe27a] font-bold">
                    银:{character.silver} · 金:{character.gold}
                  </span>
                  <span className="text-[11px] text-[#bfeec2]">成交税5% · 货款直入钱庄</span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['browse', '逛集市'],
                      ['sell', '我要摆摊'],
                      ['mine', '我的摊位'],
                    ] as const
                  ).map(([t, label]) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setMarketTab(t)}
                      className={`py-1.5 font-bold border ${
                        marketTab === t
                          ? 'bg-[#c96215] border-[#ffdf75] text-white'
                          : 'bg-[#5c2569] border-[#a574b0] text-[#f3e3f7]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {marketTab === 'browse' && (
                  <div className="space-y-2">
                    <div className="flex gap-1">
                      {(
                        [
                          ['all', '全部'],
                          ['equipment', '装备'],
                          ['general', '副将'],
                          ['item', '道具/秘籍'],
                        ] as const
                      ).map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => setMarketFilter(k)}
                          className={`px-2 py-0.5 text-[11px] border font-bold ${
                            marketFilter === k
                              ? 'bg-[#c9952b] text-[#240a04] border-[#fff09a]'
                              : 'bg-[#2a0a30] text-[#f0d9f5] border-[#8b6232]'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {visibleListings.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 bg-[#26072d]/90 border border-[#9d6fa8] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[#ffe678] truncate">
                            [{item.kind === 'equipment' ? '装备' : item.kind === 'general' ? '副将' : '道具'}]{' '}
                            {item.title}
                          </div>
                          <div className="text-[11px] text-[#9de6ff] truncate">{item.summary}</div>
                          <div className="text-[10.5px] text-[#d9c1e0]">
                            摊主：{item.sellerName} · 标价{' '}
                            <span className="text-[#ffd24d] font-bold">
                              {item.price} {item.currency === 'gold' ? '金砖' : '银两'}
                            </span>
                          </div>
                        </div>
                        {item.sellerId === character.id ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const res = await api.cancelMarketListing(realmId, item.id);
                                onUpdateCharacter(res.character);
                                onNotify(res.message);
                                await refreshMarket();
                              } catch (err) {
                                onNotify(err instanceof Error ? err.message : '下架失败');
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="px-2.5 py-1 bg-[#4a1a1f] border border-[#b8666e] text-[#ffd4d8] text-[11px] shrink-0"
                          >
                            下架
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                const res = await api.buyMarketListing(realmId, item.id);
                                onUpdateCharacter(res.character);
                                onNotify(res.message);
                                await refreshMarket();
                              } catch (err) {
                                onNotify(err instanceof Error ? err.message : '购买失败');
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="hx-btn-gold px-3 py-1 text-xs shrink-0"
                          >
                            购买
                          </button>
                        )}
                      </div>
                    ))}
                    {visibleListings.length === 0 && (
                      <div className="text-center text-[#d8bedf] py-8">
                        集市暂无人摆摊，快去「我要摆摊」上架多余装备或极品副将吧！
                      </div>
                    )}
                  </div>
                )}

                {marketTab === 'sell' && (
                  <div className="space-y-2">
                    <div className="p-2 bg-[#2a082f] border border-[#b88b3d] space-y-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#e7cfbb]">上架类型：</span>
                        {(
                          [
                            ['equipment', `闲置装备(${unequippedGear.length})`],
                            ['general', `闲置副将(${benchedGenerals.length})`],
                            ['item', `道具(${character.inventory.length})`],
                          ] as const
                        ).map(([k, label]) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setSellKind(k)}
                            className={`px-2 py-0.5 text-[11px] border font-bold ${
                              sellKind === k
                                ? 'bg-[#c9952b] text-[#240a04] border-[#fff09a]'
                                : 'bg-[#2a0a30] text-[#f0d9f5] border-[#8b6232]'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#e7cfbb]">定价：</span>
                        <input
                          type="number"
                          min={1}
                          value={sellPrice}
                          onChange={(e) => setSellPrice(e.target.value)}
                          className="w-24 px-2 py-0.5 bg-[#120416] border border-[#9e7430] text-white"
                        />
                        {(['silver', 'gold'] as const).map((cur) => (
                          <button
                            key={cur}
                            type="button"
                            onClick={() => setSellCurrency(cur)}
                            className={`px-2 py-0.5 border font-bold ${
                              sellCurrency === cur
                                ? 'bg-[#b82018] border-[#ffd86b] text-[#fff6cc]'
                                : 'bg-[#381440] border-[#8c6496] text-[#f0d9f5]'
                            }`}
                          >
                            {cur === 'silver' ? '银两' : '金砖'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {sellKind === 'equipment' && (
                      <div className="space-y-1.5">
                        {unequippedGear.map((eq) => (
                          <div
                            key={eq.id}
                            className="p-2 bg-[#26072d]/90 border border-[#8e6299] flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className={`font-bold truncate ${QUALITY_COLOR[eq.quality]}`}>
                                {eq.name} (Lv.{eq.levelReq})
                              </div>
                              <div className="text-[11px] text-[#9de6ff] truncate">
                                {formatEquipStats(eq)}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleSell('equipment', eq.id)}
                              className="hx-btn-gold px-2.5 py-1 text-[11px] shrink-0"
                            >
                              上架
                            </button>
                          </div>
                        ))}
                        {unequippedGear.length === 0 && (
                          <div className="text-center text-[#d8bedf] py-6">
                            暂无未穿戴的闲置装备
                          </div>
                        )}
                      </div>
                    )}

                    {sellKind === 'general' && (
                      <div className="space-y-1.5">
                        {benchedGenerals.map((g) => (
                          <div
                            key={g.id}
                            className="p-2 bg-[#26072d]/90 border border-[#8e6299] flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className={`font-bold truncate ${QUALITY_COLOR[g.rarity]}`}>
                                {g.name} Lv.{g.level}
                                {g.rebirth > 0 ? ` [${g.rebirth}转]` : ''}
                              </div>
                              <div className="text-[11px] text-[#9de6ff] truncate">
                                成长 {g.growth.toFixed(2)} · 技:{g.skillName}
                                {g.skill2Name ? `/${g.skill2Name}` : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleSell('general', g.id)}
                              className="hx-btn-gold px-2.5 py-1 text-[11px] shrink-0"
                            >
                              上架
                            </button>
                          </div>
                        ))}
                        {benchedGenerals.length === 0 && (
                          <div className="text-center text-[#d8bedf] py-6">
                            暂无休息中的闲置副将（请先卸下出战副将）
                          </div>
                        )}
                      </div>
                    )}

                    {sellKind === 'item' && (
                      <div className="space-y-1.5">
                        {character.inventory.map((it) => (
                          <div
                            key={it.itemId}
                            className="p-2 bg-[#26072d]/90 border border-[#8e6299] flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-[#ffe678] truncate">
                                {it.name} ×{it.quantity}
                              </div>
                              <div className="text-[11px] text-[#d9c1e0] truncate">{it.desc}</div>
                            </div>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleSell('item', it.itemId)}
                              className="hx-btn-gold px-2.5 py-1 text-[11px] shrink-0"
                            >
                              上架×1
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {marketTab === 'mine' && (
                  <div className="space-y-2">
                    {visibleListings.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 bg-[#26072d]/90 border border-[#e0b84e] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-[#ffe678] truncate">{item.title}</div>
                          <div className="text-[11px] text-[#9de6ff] truncate">{item.summary}</div>
                          <div className="text-[10.5px] text-[#ffd24d]">
                            标价：{item.price} {item.currency === 'gold' ? '金砖' : '银两'}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              const res = await api.cancelMarketListing(realmId, item.id);
                              onUpdateCharacter(res.character);
                              onNotify(res.message);
                              await refreshMarket();
                            } catch (err) {
                              onNotify(err instanceof Error ? err.message : '下架失败');
                            } finally {
                              setBusy(false);
                            }
                          }}
                          className="px-2.5 py-1 bg-[#4a1a1f] border border-[#b8666e] text-[#ffd4d8] text-[11px] shrink-0"
                        >
                          下架取回
                        </button>
                      </div>
                    ))}
                    {visibleListings.length === 0 && (
                      <div className="text-center text-[#d8bedf] py-8">
                        你当前没有在售摊位，成交货款会自动存入「许昌钱庄」
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* MAIL (飞鸽传书：收件箱/领附件/写信赠礼) */}
          {panel === 'mail' && (() => {
            const refreshMails = async () => {
              const r = await api.getMails(realmId);
              setMails(r.mails);
            };
            return (
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMailTab('inbox')}
                    className={`py-1.5 font-bold border ${
                      mailTab === 'inbox'
                        ? 'bg-[#c96215] border-[#ffdf75] text-white'
                        : 'bg-[#5c2569] border-[#a574b0] text-[#f3e3f7]'
                    }`}
                  >
                    收件箱 ({mails.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setMailTab('compose')}
                    className={`py-1.5 font-bold border ${
                      mailTab === 'compose'
                        ? 'bg-[#c96215] border-[#ffdf75] text-white'
                        : 'bg-[#5c2569] border-[#a574b0] text-[#f3e3f7]'
                    }`}
                  >
                    ✉ 飞鸽写信
                  </button>
                </div>

                {mailTab === 'inbox' && (
                  <div className="space-y-2">
                    {mails.map((m) => {
                      const hasUnclaimed = !m.claimed && (m.attachSilver > 0 || m.attachGold > 0);
                      return (
                        <div
                          key={m.id}
                          className={`p-2 border space-y-1.5 ${
                            !m.isRead
                              ? 'bg-[#361142] border-[#ffe16b]'
                              : 'bg-[#26072d]/90 border-[#8e6299]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-bold text-[#ffe678] truncate">
                              {!m.isRead && (
                                <span className="mr-1 px-1 bg-[#c41b1b] text-white text-[10px]">
                                  新
                                </span>
                              )}
                              {m.subject}
                            </div>
                            <span className="text-[10.5px] text-[#d6bce0] shrink-0">
                              来自：{m.senderName}
                            </span>
                          </div>
                          <div className="text-[#f5e7fa] leading-relaxed whitespace-pre-wrap break-all">
                            {m.body}
                          </div>
                          {(m.attachSilver > 0 || m.attachGold > 0) && (
                            <div className="text-[11px] text-[#9be8ff] font-bold">
                              附件：
                              {m.attachSilver > 0 ? `银两 ${m.attachSilver} ` : ''}
                              {m.attachGold > 0 ? `金砖 ${m.attachGold}` : ''}
                              {m.claimed ? '（已领取）' : ''}
                            </div>
                          )}
                          <div className="flex justify-end gap-1.5 pt-0.5">
                            {!m.isRead && !hasUnclaimed && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    const res = await api.readMail(realmId, m.id);
                                    onUpdateCharacter(res.character);
                                    await refreshMails();
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="px-2 py-0.5 bg-[#2a4a7a] border border-[#8cc8ff] text-white text-[11px]"
                              >
                                标为已读
                              </button>
                            )}
                            {hasUnclaimed && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    const res = await api.claimMail(realmId, m.id);
                                    onUpdateCharacter(res.character);
                                    onNotify(res.message);
                                    await refreshMails();
                                  } catch (err) {
                                    onNotify(err instanceof Error ? err.message : '领取失败');
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="hx-btn-gold px-2.5 py-0.5 text-[11px]"
                              >
                                领取附件
                              </button>
                            )}
                            {!hasUnclaimed && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    const res = await api.deleteMail(realmId, m.id);
                                    onUpdateCharacter(res.character);
                                    onNotify(res.message);
                                    await refreshMails();
                                  } catch (err) {
                                    onNotify(err instanceof Error ? err.message : '删除失败');
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                                className="px-2 py-0.5 bg-[#4a1a1f] border border-[#b8666e] text-[#ffd4d8] text-[11px]"
                              >
                                删除
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {mails.length === 0 && (
                      <div className="text-center text-[#d8bedf] py-8">
                        暂无飞鸽传书（集市成交、擂台切磋或好友来信会送达此处）
                      </div>
                    )}
                  </div>
                )}

                {mailTab === 'compose' && (
                  <div className="p-2.5 bg-[#2a082f] border border-[#b88b3d] space-y-2">
                    <div className="text-[11px] text-[#ffe27a]">
                      随身：银两 {character.silver} · 金砖 {character.gold}
                    </div>
                    <input
                      type="text"
                      value={mailTo}
                      onChange={(e) => setMailTo(e.target.value)}
                      placeholder="收件人角色名（同区）"
                      className="w-full px-2 py-1 bg-[#120416] border border-[#9e7430] text-white"
                    />
                    <input
                      type="text"
                      value={mailSubject}
                      onChange={(e) => setMailSubject(e.target.value)}
                      placeholder="信件标题（选填）"
                      className="w-full px-2 py-1 bg-[#120416] border border-[#9e7430] text-white"
                    />
                    <textarea
                      rows={3}
                      value={mailBody}
                      onChange={(e) => setMailBody(e.target.value)}
                      placeholder="写下想对好友说的话..."
                      className="w-full px-2 py-1 bg-[#120416] border border-[#9e7430] text-white"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-0.5">
                        <span className="text-[11px] text-[#e7cfbb]">附寄银两（选填）</span>
                        <input
                          type="number"
                          min={0}
                          value={mailSilver}
                          onChange={(e) => setMailSilver(e.target.value)}
                          className="w-full px-2 py-1 bg-[#120416] border border-[#9e7430] text-white"
                        />
                      </label>
                      <label className="space-y-0.5">
                        <span className="text-[11px] text-[#e7cfbb]">附寄金砖（选填）</span>
                        <input
                          type="number"
                          min={0}
                          value={mailGold}
                          onChange={(e) => setMailGold(e.target.value)}
                          className="w-full px-2 py-1 bg-[#120416] border border-[#9e7430] text-white"
                        />
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={busy || !mailTo.trim() || !mailBody.trim()}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const res = await api.sendMail({
                              realmId,
                              recipientName: mailTo,
                              subject: mailSubject || '飞鸽传书',
                              body: mailBody,
                              attachSilver: Number(mailSilver) || 0,
                              attachGold: Number(mailGold) || 0,
                            });
                            onUpdateCharacter(res.character);
                            onNotify(res.message);
                            setMailTo('');
                            setMailSubject('');
                            setMailBody('');
                            setMailSilver('0');
                            setMailGold('0');
                            setMailTab('inbox');
                          } catch (err) {
                            onNotify(err instanceof Error ? err.message : '发送失败');
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="hx-btn-gold px-4 py-1.5 text-xs"
                      >
                        放飞信鸽
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* NOTICE */}
          {panel === 'notice' && (
            <div className="space-y-2 text-xs leading-relaxed text-[#f7ebfa]">
              <div className="text-[#ffe473] font-bold text-sm">幻想三国 · 经典版 v0.2</div>
              <p>· 1:1 复刻经典版美术切图与像素回合制战斗舞台。</p>
              <p>· 支持手机触控与电脑键盘快捷键（战斗中按 1~7 快速出招）。</p>
              <p>· 已开放地图：许昌、许昌郊外、长社、洛阳、洛阳城外、虎牢关、官渡、赤壁、涿郡。</p>
              <p>· 已开放玩法：三国 8 章主线剧情与剧情 BOSS、许昌经典 10 环跑环、自由加点与 5 项抗性、技能熟练度、5 槽经典装备与战马、藏宝图挖宝、招贤令寻访名将、副将洗髓/1~2转与专属技战斗。</p>
            </div>
          )}

        </div>
        <div className="w-[14px] hx-cloud-pillar shrink-0 border-l border-black" />
      </div>

      {/* Bottom Bar with Golden 返回 Button (classic_5.jpg) */}
      <div className="h-[44px] px-4 bg-[#26082c] border-t border-[#7a5085] flex items-center justify-end shrink-0">
        <button type="button" onClick={onClose} className="hx-btn-gold px-6 py-1 text-sm">
          返回
        </button>
      </div>
    </div>
  );
}
