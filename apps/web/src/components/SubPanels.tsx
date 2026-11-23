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
  | 'quests'
  | 'paohuan'
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
  quests: '任务卷轴',
  paohuan: '许昌跑环',
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
  const [questTab, setQuestTab] = useState<'main' | 'paohuan'>(
    panel === 'paohuan' ? 'paohuan' : 'main',
  );
  const [digResult, setDigResult] = useState<TreasureDigResult | null>(null);
  const [rankSort, setRankSort] = useState<'level' | 'silver' | 'gold'>('level');
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [gmCode, setGmCode] = useState('');
  const [announceText, setAnnounceText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (panel === 'paohuan') setQuestTab('paohuan');
    else if (panel === 'quests') setQuestTab('main');
  }, [panel]);

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

          {/* GENERALS (副将深度培养：成长率/初值/专属技能/喂丹/洗髓/转生/解雇) */}
          {panel === 'generals' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs bg-[#230629]/90 border border-[#9d6fa8] px-2.5 py-1.5">
                <span className="text-[#ffde7d] font-bold">
                  副将营 ({character.generals.length}/12) · 最多出战 3 名
                </span>
                <span className="text-[#d9c1e0] text-[11px]">
                  经验丹×{character.inventory.find((i) => i.itemId === 'jingyandan')?.quantity ?? 0}{' '}
                  · 洗髓丹×{character.inventory.find((i) => i.itemId === 'xisuidan')?.quantity ?? 0}
                </span>
              </div>

              {character.generals.map((g) => {
                const rebirthReq = g.rebirth === 0 ? 10 : g.rebirth === 1 ? 20 : 999;
                const canRebirth = g.rebirth < 2 && g.level >= rebirthReq;
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
                            成长 {g.growth.toFixed(2)} · 专属技【{g.skillName}】
                          </div>
                          <div className="text-[11px] text-[#e8d2ee]">
                            当前：血{g.maxHp} · 精{g.maxMp} · 攻{g.atk} · 速{g.spd}
                          </div>
                          <div className="text-[10.5px] text-[#cbb0d4]">
                            初值：血{g.baseHp} / 精{g.baseMp} / 攻{g.baseAtk} / 速{g.baseSpd} · 经验
                            {g.exp}/{g.expToNext}
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

          {/* TAVERN (RECRUIT & DRAW GENERALS) */}
          {panel === 'tavern' && (
            <div className="space-y-2.5">
              {/* Token Draw Banner */}
              <div className="p-2.5 bg-[#36110e] border-2 border-[#e5b642] flex items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-bold text-[#ffea7a] text-sm">名将寻访（消耗 1 招贤令）</div>
                  <div className="text-[11px] text-[#f5dccc]">
                    有机会直接寻得 <span className="text-[#ffbe47] font-bold">吕布 / 关羽 / 貂蝉 / 赵云</span>
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
                          🏆 三国主线八章全通 · 威震华夏！
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
                            {currentMain.status === 'active' && (
                              <div className="text-[11px] text-[#e8cde9]">
                                请先点主界面「移动」前往【{currentMain.targetMapName}】完成目标
                              </div>
                            )}
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
                            环数越高经验银两越丰厚 · 累计大满贯 {paohuan.completedRounds} 轮
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
                          {paohuan.targetMapName && (
                            <div className="text-[11px] text-[#a9d6ff]">
                              目标地点：【{paohuan.targetMapName}】
                              {paohuan.taskType === 'visit_map'
                                ? '（移动到该地图即自动达成）'
                                : '（击败对应怪物即可计数）'}
                            </div>
                          )}
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
