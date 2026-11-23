import { useEffect, useState } from 'react';
import {
  EQUIPMENT_SLOT_LABELS,
  EQUIPMENT_TEMPLATES,
  GENERAL_TEMPLATES,
  ITEMS,
  ROLE_CLASS_META,
  type CharacterView,
  type EquipmentQuality,
  type EquipmentSlot,
  type EquipmentView,
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
  | 'rank'
  | 'shop'
  | 'blacksmith'
  | 'tavern'
  | 'notice'
  | 'gm';

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
  onUpdateCharacter: (ch: CharacterView) => void;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

const TITLES: Record<SubPanelType, string> = {
  status: '人物状态',
  items: '行囊与装备',
  generals: '副将营帐',
  rank: '排行榜',
  shop: '回春药铺',
  blacksmith: '铁匠铺与马市',
  tavern: '许昌招贤馆',
  notice: '游戏公告',
  gm: 'GM 管理面板',
};

export function SubPanels({
  panel,
  realmId,
  character,
  onUpdateCharacter,
  onClose,
  onNotify,
}: SubPanelsProps) {
  const [statusTab, setStatusTab] = useState<'stats' | 'resist' | 'skills'>('stats');
  const [bagTab, setBagTab] = useState<'equip' | 'consumable'>('equip');
  const [smithTab, setSmithTab] = useState<'gear' | 'mount'>('gear');
  const [digResult, setDigResult] = useState<TreasureDigResult | null>(null);
  const [rankSort, setRankSort] = useState<'level' | 'silver' | 'gold'>('level');
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [gmCode, setGmCode] = useState('');
  const [announceText, setAnnounceText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (panel === 'rank') {
      api
        .getRankings(realmId, rankSort)
        .then((r) => setRankings(r.rankings))
        .catch((e: Error) => onNotify(e.message));
    }
  }, [panel, realmId, rankSort, onNotify]);

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
        <span className="text-[17px] font-bold tracking-widest hx-stroke">{TITLES[panel]}</span>
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
                      <div className="text-base font-bold text-[#ffe678] truncate">{character.name}</div>
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
                </div>
              )}

              {statusTab === 'resist' && (
                <div className="p-2.5 bg-[#230629]/90 border border-[#b68d3a] space-y-2">
                  <div className="text-xs text-[#ffea84] font-bold">
                    剩余抗性点：{character.resist.freePoints}（每点 +3%，单项上限 75%）
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
                        disabled={busy || character.resist.freePoints < 1 || pct >= 75}
                        onClick={() =>
                          run(
                            () => api.allocateResist({ realmId, [key]: 1 }),
                            `${label} 提升至 ${pct + 3}%`,
                          )
                        }
                        className="hx-btn-gold px-2.5 py-1 text-[11px] shrink-0 disabled:opacity-40"
                      >
                        +3%
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {statusTab === 'skills' && (
                <div className="space-y-2">
                  <div className="text-xs text-[#ffea84]">
                    在战斗中多施放技能即可提升熟练度，进阶后群体技能打击人数与威力自动成长！
                  </div>
                  {character.skills.map((sk) => {
                    const pct = Math.min(100, Math.round((sk.proficiency / sk.nextTierProf) * 100));
                    return (
                      <div
                        key={sk.skillId}
                        className="p-2.5 bg-[#25072b]/90 border border-[#9666a1] space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#ffe678] text-sm">
                            {sk.name}{' '}
                            <span className="text-[#8de4ff] text-xs">({sk.tier}阶)</span>
                          </span>
                          <span className="text-[11px] text-[#e8d2ee]">
                            耗精 {sk.mpCost} · 最多 {sk.maxTargets} 目标
                          </span>
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
                      当前穿戴（无宝石无锻造，穿戴即享全额属性与抗性）
                    </div>
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

          {/* BLACKSMITH & HORSE MARKET */}
          {panel === 'blacksmith' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#ffe27a] font-bold">当前银两：{character.silver} 两</span>
                <span className="text-[#d7bddf]">极品神兵与赤兔需靠打怪/挖宝获得</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
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
                  军马场（战马）
                </button>
              </div>
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
            </div>
          )}

          {/* GENERALS */}
          {panel === 'generals' && (
            <div className="space-y-2">
              <div className="text-xs text-[#ffde7d] mb-1">
                最多同时出战 3 名副将（对应主城左侧三个「将」槽位）：
              </div>
              {character.generals.map((g) => (
                <div
                  key={g.id}
                  className="p-2 bg-[#26072d]/90 border border-[#9d6fa8] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <AssetImg
                      path={`${g.spriteKey}_h.png`}
                      alt={g.name}
                      className="w-8 h-8 pixelated bg-[#1d2b18] border border-[#d6ab48] p-0.5"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-[#ffe678]">
                        {g.name} Lv.{g.level}{' '}
                        {g.slot !== null && (
                          <span className="ml-1 px-1 bg-[#b82018] text-white text-[10px]">
                            出战{g.slot + 1}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#e5cde9]">
                        血{g.maxHp} · 攻{g.atk} · 速{g.spd} · 成长{g.growth}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {g.slot !== null ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(() => api.setGeneralSlot(realmId, g.id, null), `已让 ${g.name} 休息`)
                        }
                        className="px-2 py-1 text-[11px] bg-[#52245c] border border-[#c095cc] text-white"
                      >
                        卸下
                      </button>
                    ) : (
                      [0, 1, 2].map((slot) => (
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
                          className="hx-btn-gold px-1.5 py-0.5 text-[11px]"
                        >
                          位{slot + 1}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ))}
              {character.generals.length === 0 && (
                <div className="text-center text-[#d8bedf] py-8">
                  暂无副将，可在许昌「设施 → 招贤馆」招募或在战斗中使用「招降」！
                </div>
              )}
            </div>
          )}

          {/* RANKINGS (matches classic_5.jpg) */}
          {panel === 'rank' && (
            <div className="space-y-2.5">
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
                    className="py-1.5 px-1 flex items-center justify-between text-[13px]"
                  >
                    <div>
                      <span className="text-[#ffd24d] font-bold mr-1.5">{r.rank}.</span>
                      <span className="text-[#ff4f4f] font-bold hx-stroke">{r.name}</span>
                      <span className="text-[#e5d2eb] text-xs ml-1.5">
                        ({ROLE_CLASS_META[r.roleClass].label} · {r.level}级)
                      </span>
                    </div>
                    <span className="text-xs text-[#ffe685]">
                      {rankSort === 'silver'
                        ? `${r.silver}银`
                        : rankSort === 'gold'
                          ? `${r.gold}金`
                          : `Lv.${r.level}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PHARMACY SHOP */}
          {panel === 'shop' && (
            <div className="space-y-2">
              <div className="text-xs text-[#ffe27a]">当前银两：{character.silver} 两</div>
              {Object.values(ITEMS).map((it) => (
                <div
                  key={it.itemId}
                  className="p-2 bg-[#27082e]/90 border border-[#8e6299] flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-[#ffe678]">
                      {it.name}{' '}
                      <span className="text-[#a4e8ff] text-xs">{it.priceSilver} 银/个</span>
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

          {/* TAVERN (RECRUIT GENERALS) */}
          {panel === 'tavern' && (
            <div className="space-y-2">
              <div className="text-xs text-[#ffe27a]">当前银两：{character.silver} 两</div>
              {Object.values(GENERAL_TEMPLATES).map((tpl) => (
                <div
                  key={tpl.templateId}
                  className="p-2 bg-[#27082e]/90 border border-[#9d6fa8] flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <AssetImg
                      path={
                        tpl.avatarKey.startsWith('f')
                          ? tpl.avatarKey
                          : `portraits/${tpl.avatarKey}`
                      }
                      alt={tpl.name}
                      className="w-10 h-10 pixelated border border-[#d6ab48]"
                    />
                    <div>
                      <div className="font-bold text-[#ffe678]">
                        {tpl.name}{' '}
                        <span className="text-xs text-[#9ce5ff]">成长 {tpl.growth}</span>
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
                    onClick={() =>
                      run(
                        () => api.recruitGeneral(realmId, tpl.templateId),
                        `成功招募副将【${tpl.name}】！`,
                      )
                    }
                    className="hx-btn-gold px-3 py-1 text-xs shrink-0"
                  >
                    招募
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* NOTICE */}
          {panel === 'notice' && (
            <div className="space-y-2 text-xs leading-relaxed text-[#f7ebfa]">
              <div className="text-[#ffe473] font-bold text-sm">幻想三国 · 经典版 v0.1</div>
              <p>· 1:1 复刻经典版美术切图与像素回合制战斗舞台。</p>
              <p>· 支持手机触控与电脑键盘快捷键（战斗中按 1~7 快速出招）。</p>
              <p>· 当前已开放：许昌/郊外/长社/洛阳/城外/涿郡、三大职业技能、副将招募/招降/出战、药铺/客栈、实时区/派/商/世聊天、全服排行榜与 GM 面板。</p>
            </div>
          )}

          {/* GM PANEL */}
          {panel === 'gm' && (
            <div className="space-y-2.5 text-xs">
              <div className="p-2 bg-[#2a082f] border border-[#d9aa42] text-[#ffea88]">
                {character.isGm
                  ? '当前账号为【服主GM】，可直接免口令操作。'
                  : '普通账号需输入 GM 口令（默认 hxsg888）方可使用。'}
              </div>
              {!character.isGm && (
                <input
                  type="password"
                  value={gmCode}
                  onChange={(e) => setGmCode(e.target.value)}
                  placeholder="输入 GM 口令（默认 hxsg888）"
                  className="w-full px-2.5 py-1.5 bg-[#120416] border border-[#9e7430] text-white"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api.gmGrant({ realmId, passcode: gmCode, silver: 10000 }),
                      'GM 发放 10,000 银两成功',
                    )
                  }
                  className="hx-btn-gold py-1.5"
                >
                  +10,000 银两
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api.gmGrant({ realmId, passcode: gmCode, gold: 500 }),
                      'GM 发放 500 金砖成功',
                    )
                  }
                  className="hx-btn-gold py-1.5"
                >
                  +500 金砖
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api.gmGrant({ realmId, passcode: gmCode, exp: 500 }),
                      'GM 发放 500 经验成功',
                    )
                  }
                  className="hx-btn-gold py-1.5"
                >
                  +500 经验
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api.gmGrant({ realmId, passcode: gmCode, fullHeal: true }),
                      '已一键满血满蓝',
                    )
                  }
                  className="hx-btn-gold py-1.5"
                >
                  一键满血满蓝
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        api.gmGrant({
                          realmId,
                          passcode: gmCode,
                          grantBaotu: 5,
                        }),
                      'GM 发放 5 张【藏宝图】成功！',
                    )
                  }
                  className="hx-btn-gold py-1.5"
                >
                  +5 藏宝图
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        api.gmGrant({
                          realmId,
                          passcode: gmCode,
                          grantEquipId: 'chitu_ma',
                        }),
                      '已直接领取【赤兔宝马】（请到物品穿戴）！',
                    )
                  }
                  className="hx-btn-gold py-1.5"
                >
                  领取【赤兔宝马】
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        api.gmGrant({
                          realmId,
                          passcode: gmCode,
                          grantGeneralId: 'zhaoyun',
                        }),
                      '已直接领取神将【赵云】！',
                    )
                  }
                  className="col-span-2 hx-btn-red py-1.5"
                >
                  一键领取神将【赵云】
                </button>
              </div>
              <div className="pt-2 border-t border-white/15 flex gap-1.5">
                <input
                  type="text"
                  value={announceText}
                  onChange={(e) => setAnnounceText(e.target.value)}
                  placeholder="发送全服系统公告..."
                  className="flex-1 px-2 py-1 bg-[#120416] border border-[#9e7430] text-white"
                />
                <button
                  type="button"
                  disabled={busy || !announceText.trim()}
                  onClick={async () => {
                    await run(
                      () => api.gmGrant({ realmId, passcode: gmCode, announce: announceText }),
                      '系统公告已广播',
                    );
                    setAnnounceText('');
                  }}
                  className="hx-btn-gold px-3 py-1"
                >
                  广播
                </button>
              </div>
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
