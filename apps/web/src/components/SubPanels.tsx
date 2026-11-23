import { useEffect, useState } from 'react';
import {
  GENERAL_TEMPLATES,
  ITEMS,
  ROLE_CLASS_META,
  type CharacterView,
  type RankEntry,
} from '@hxsg/shared';
import { api } from '../api';
import { PixelSprite } from './PixelSprite';

export type SubPanelType =
  | 'status'
  | 'items'
  | 'generals'
  | 'rank'
  | 'shop'
  | 'tavern'
  | 'notice'
  | 'gm';

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
  items: '行囊物品',
  generals: '副将营帐',
  rank: '排行榜',
  shop: '回春药铺',
  tavern: '许昌招贤馆',
  notice: '亲友服公告',
  gm: '亲友服 GM 面板',
};

export function SubPanels({
  panel,
  realmId,
  character,
  onUpdateCharacter,
  onClose,
  onNotify,
}: SubPanelsProps) {
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

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#1b0820]">
      {/* Classic Top Header */}
      <div
        className="h-[38px] flex items-center justify-center border-b border-[#5b6a6c] shrink-0"
        style={{ backgroundImage: 'url(/assets/hxsg/tit_bg.png)', backgroundSize: 'cover' }}
      >
        <span className="text-[17px] font-bold tracking-widest hx-stroke">{TITLES[panel]}</span>
      </div>

      {/* Classic Deep-Purple Body with Silver Cloud Pillars (classic_5.jpg) */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-[14px] hx-cloud-pillar shrink-0 border-r border-black" />
        <div className="flex-1 hx-purple-bg p-3 overflow-y-auto hx-scroll text-[13px] relative">
          {/* STATUS */}
          {panel === 'status' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-2.5 bg-[#26072c]/90 border border-[#b78f3c]">
                <div className="w-[74px] h-[82px] bg-[#2a3820] border border-[#e0b84f] flex items-center justify-center shrink-0">
                  <PixelSprite spriteKey={mySprite} scale={1.7} />
                </div>
                <div className="space-y-0.5 text-xs">
                  <div className="text-base font-bold text-[#ffe678]">{character.name}</div>
                  <div>
                    职业：{character.level}级 {classMeta.label}（{character.gender === 'female' ? '女' : '男'}）
                  </div>
                  <div>
                    经验：{character.exp} / {character.expToNext}
                  </div>
                  <div className="text-[#ffe04b]">
                    金砖：{character.gold} · 银两：{character.silver}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-[#25072b]/80 border border-[#7c4d87]">
                  气血：{character.hp} / {character.maxHp}
                </div>
                <div className="p-2 bg-[#25072b]/80 border border-[#7c4d87]">
                  精力：{character.mp} / {character.maxMp}
                </div>
                <div className="p-2 bg-[#25072b]/80 border border-[#7c4d87]">
                  攻击：{character.atk}
                </div>
                <div className="p-2 bg-[#25072b]/80 border border-[#7c4d87]">
                  防御：{character.def}
                </div>
                <div className="p-2 bg-[#25072b]/80 border border-[#7c4d87]">
                  速度：{character.spd}
                </div>
                <div className="p-2 bg-[#25072b]/80 border border-[#7c4d87]">
                  副将数：{character.generals.length} / 12
                </div>
              </div>
            </div>
          )}

          {/* ITEMS / BAG */}
          {panel === 'items' && (
            <div className="space-y-2">
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
                  {it.type === 'consumable' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => run(() => api.useItem(realmId, it.itemId), `已使用【${it.name}】`)}
                      className="hx-btn-gold px-3 py-1 text-xs shrink-0"
                    >
                      使用
                    </button>
                  )}
                </div>
              ))}
              {character.inventory.length === 0 && (
                <div className="text-center text-[#d8bedf] py-8">行囊空空如也，去回春药铺买点药吧</div>
              )}
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
                    <img
                      src={`/assets/hxsg/${g.spriteKey}_h.png`}
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
                    <img
                      src={
                        tpl.avatarKey.startsWith('f')
                          ? `/assets/hxsg/${tpl.avatarKey}`
                          : `/assets/hxsg/portraits/${tpl.avatarKey}`
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
            <div className="space-y-2 text-xs leading-relaxed text-[#f2def7]">
              <div className="text-[#ffe473] font-bold text-sm">幻想三国 · 经典版 亲友怀旧服 v0.1</div>
              <p>· 本服 1:1 复刻汉风经典版（A版）美术切图与像素回合制战斗舞台。</p>
              <p>· 支持手机浏览器触控与电脑键盘快捷键（战斗中按 1~7 快速出招）。</p>
              <p>· 第一阶段已开放：许昌/郊外/长社/洛阳/城外/涿郡、三大职业技能、副将招募/招降/出战、药铺/客栈、实时区/派/商/世聊天、全服排行榜与亲友 GM 面板。</p>
            </div>
          )}

          {/* GM PANEL */}
          {panel === 'gm' && (
            <div className="space-y-2.5 text-xs">
              <div className="p-2 bg-[#2a082f] border border-[#d9aa42] text-[#ffea88]">
                {character.isGm
                  ? '当前账号为【服主GM】，可直接免口令操作。'
                  : '普通账号需输入亲友服 GM 口令（默认 hxsg888）方可使用。'}
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
