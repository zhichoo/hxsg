import { useState } from 'react';
import { ROLE_CLASS_META, type CharacterView, type Gender, type RoleClass } from '@hxsg/shared';
import { api } from '../api';
import { PixelSprite } from './PixelSprite';

interface CreateRoleProps {
  realmId: string;
  onCreated: (ch: CharacterView) => void;
  onBack: () => void;
  onNotify: (msg: string) => void;
}

const CLASSES: RoleClass[] = ['wushi', 'wenren', 'yiren'];

export function CreateRole({ realmId, onCreated, onBack, onNotify }: CreateRoleProps) {
  const [name, setName] = useState('');
  const [roleClass, setRoleClass] = useState<RoleClass>('wushi');
  const [gender, setGender] = useState<Gender>('male');
  const [busy, setBusy] = useState(false);

  const meta = ROLE_CLASS_META[roleClass];
  const spriteKey = gender === 'female' ? meta.femaleSprite : meta.maleSprite;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      onNotify('角色名至少 2 个字');
      return;
    }
    setBusy(true);
    try {
      const { character } = await api.createCharacter({
        realmId,
        name: name.trim(),
        roleClass,
        gender,
      });
      onCreated(character);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : '创建失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1b0820] overflow-hidden">
      <div
        className="h-[40px] flex items-center justify-center border-b border-[#5b6a6c]"
        style={{ backgroundImage: 'url(/assets/hxsg/tit_bg.png)', backgroundSize: 'cover' }}
      >
        <span className="text-[17px] font-bold tracking-widest hx-stroke">创建角色</span>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[14px] hx-cloud-pillar shrink-0 border-r border-black" />
        <form
          onSubmit={submit}
          className="flex-1 hx-purple-bg p-3 flex flex-col justify-between overflow-y-auto hx-scroll"
        >
          <div className="space-y-3">
            {/* Class selector */}
            <div>
              <div className="text-xs text-[#ffda73] font-bold mb-1.5">选择职业：</div>
              <div className="grid grid-cols-3 gap-2">
                {CLASSES.map((cls) => {
                  const m = ROLE_CLASS_META[cls];
                  const active = cls === roleClass;
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setRoleClass(cls)}
                      className={`py-2 px-1 border-2 text-center transition ${
                        active
                          ? 'bg-[#8d1f16] border-[#ffe16b] text-[#fff4a3]'
                          : 'bg-[#2a0c30] border-[#78537f] text-[#d9c0df]'
                      }`}
                    >
                      <div className="text-[15px] font-black hx-stroke">{m.label}</div>
                      <div className="text-[10px] opacity-85">{m.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gender & Live Pixel Preview */}
            <div className="p-3 bg-[#1d0524]/85 border border-[#a58038] flex items-center gap-3">
              <div className="flex flex-col items-center shrink-0">
                <div className="w-[92px] h-[92px] bg-[#2a3820] border-2 border-[#d4a946] flex items-center justify-center">
                  <PixelSprite spriteKey={spriteKey} scale={2} />
                </div>
                <div className="flex gap-1 mt-1.5">
                  {(['male', 'female'] as Gender[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`px-2.5 py-0.5 text-xs border ${
                        gender === g
                          ? 'bg-[#d49617] text-black font-bold border-[#fff199]'
                          : 'bg-[#2b1031] text-[#d5badb] border-[#6b4875]'
                      }`}
                    >
                      {g === 'male' ? '男' : '女'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <img
                    src={`/assets/hxsg/portraits/${meta.portrait}`}
                    alt={meta.label}
                    className="w-11 h-11 border border-[#e0b84f] pixelated"
                  />
                  <div>
                    <div className="text-[#ffe36d] font-bold text-sm">{meta.label}</div>
                    <div className="text-[11px] text-[#e8cfff]">{meta.title}</div>
                  </div>
                </div>
                <p className="text-[11.5px] text-[#ebd8f2] leading-snug">{meta.desc}</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-[#ffd48a] pt-1 border-t border-white/10">
                  <span>气血：{meta.baseHp}</span>
                  <span>精力：{meta.baseMp}</span>
                  <span>攻击：{meta.baseAtk}</span>
                  <span>速度：{meta.baseSpd}</span>
                </div>
              </div>
            </div>

            {/* Name input */}
            <div>
              <div className="text-xs text-[#ffda73] font-bold mb-1">主公名号（2~10字）：</div>
              <input
                type="text"
                maxLength={10}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如：常山赵子龙、青龙一号..."
                className="w-full px-3 py-2 bg-[#120416] border-2 border-[#b68934] text-sm text-white placeholder-[#8e6f99] focus:outline-none focus:border-[#ffe678]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3">
            <button type="button" onClick={onBack} className="hx-btn-gold px-4 py-1.5 text-sm">
              返回选区
            </button>
            <button type="submit" disabled={busy} className="hx-btn-gold px-6 py-1.5 text-sm">
              {busy ? '创建中...' : '踏入三国'}
            </button>
          </div>
        </form>
        <div className="w-[14px] hx-cloud-pillar shrink-0 border-l border-black" />
      </div>
    </div>
  );
}
