import { useEffect, useState } from 'react';
import { api, type AuthResponse, type RealmWithOnline } from '../api';

interface ServerSelectProps {
  selectedRealm: string;
  onSelectRealm: (realmId: string) => void;
  account: { username: string; isGm: boolean } | null;
  onAuthSuccess: (auth: AuthResponse, realmId: string) => void;
  onEnterGame: (realmId: string) => void;
  onLogout: () => void;
  onNotify: (msg: string) => void;
}

export function ServerSelect({
  selectedRealm,
  onSelectRealm,
  account,
  onAuthSuccess,
  onEnterGame,
  onLogout,
  onNotify,
}: ServerSelectProps) {
  const [realms, setRealms] = useState<RealmWithOnline[]>([]);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getRealms()
      .then(setRealms)
      .catch((e: Error) => onNotify(e.message));
  }, [onNotify]);

  const activeRealmObj = realms.find((r) => r.id === selectedRealm) ?? realms[0];

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      onNotify('请输入账号与密码');
      return;
    }
    setBusy(true);
    try {
      const res =
        mode === 'register'
          ? await api.register(username.trim(), password)
          : await api.login(username.trim(), password);
      onAuthSuccess(res, selectedRealm);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-[#070f4f] via-[#040a36] to-[#020624] text-white overflow-hidden">
      {/* Classic Version A Top Banner */}
      <div className="relative pt-4 pb-2 flex flex-col items-center">
        <div className="relative px-8 py-1.5 rounded-full bg-gradient-to-b from-[#e8f0f2] via-[#b7c4c9] to-[#7a898f] border-2 border-[#354858] shadow-md">
          <span className="text-[22px] font-black tracking-[3px] text-[#ffe14d] hx-stroke">
            选择分区
          </span>
        </div>
        <div className="mt-1 text-[12px] text-[#bfd2ff] tracking-wide font-medium">
          幻想三国 · 经典版 Web
        </div>
      </div>

      {/* Realm List (1:1 classic_4.jpg style) */}
      <div className="px-3 flex-1 overflow-y-auto hx-scroll space-y-2 pb-2">
        {realms.map((realm) => {
          const active = realm.id === selectedRealm;
          return (
            <button
              key={realm.id}
              type="button"
              onClick={() => onSelectRealm(realm.id)}
              className={`w-full h-[46px] flex items-center justify-between pl-3 pr-0.5 text-left transition ${
                active
                  ? 'bg-[#2a302d] border-2 border-white shadow-[0_0_8px_rgba(255,255,255,0.45)]'
                  : 'bg-[#2b2e2f]/90 border-2 border-[#7b838c] opacity-90 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`text-[15px] font-bold truncate ${
                    active ? 'text-[#f8f39a]' : 'text-[#d0d5da]'
                  }`}
                >
                  {realm.name}
                </span>
                <span className="text-[12px] text-[#b4c4d0] shrink-0">
                  [{realm.onlineCount}人在线]
                </span>
              </div>
              <div className="relative w-[108px] h-[38px] overflow-hidden shrink-0 border-l border-black/50">
                <img
                  src={`/assets/hxsg/${realm.bgImg}`}
                  alt=""
                  className="w-full h-full object-cover pixelated"
                />
                {realm.tag && (
                  <span className="absolute right-1 bottom-0.5 px-1 bg-black/75 text-[10px] text-[#ffe46b] border border-[#b4892c]">
                    {realm.tag}
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {activeRealmObj && (
          <div className="px-2 py-1.5 text-[12px] text-[#d6e2ff] border-t border-white/10">
            {activeRealmObj.desc}
          </div>
        )}

        {/* Account Login / Register Panel */}
        <div className="mt-1 p-3 bg-[#09123b]/90 border border-[#4a66a8]">
          {account ? (
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="text-[#9cb6f5]">当前账号：</span>
                <span className="text-[#ffe97d] font-bold">{account.username}</span>
                {account.isGm && (
                  <span className="ml-1.5 px-1 py-0.5 bg-[#8a1414] border border-[#f5c84c] text-[10px] text-[#ffe97d]">
                    服主GM
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="text-[#ffb0b0] underline hover:text-white"
              >
                切换账号
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-2">
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`flex-1 py-1 font-bold border ${
                    mode === 'login'
                      ? 'bg-[#c48d18] text-black border-[#ffe97d]'
                      : 'bg-[#121f56] text-[#a7bcff] border-[#385094]'
                  }`}
                >
                  账户登录
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className={`flex-1 py-1 font-bold border ${
                    mode === 'register'
                      ? 'bg-[#c48d18] text-black border-[#ffe97d]'
                      : 'bg-[#121f56] text-[#a7bcff] border-[#385094]'
                  }`}
                >
                  快速注册
                </button>
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="输入账号（3~20位）"
                className="w-full px-2.5 py-1.5 bg-[#030821] border border-[#516eb3] text-sm text-white placeholder-[#6980ba] focus:outline-none focus:border-[#ffd85c]"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="输入密码（4位以上）"
                className="w-full px-2.5 py-1.5 bg-[#030821] border border-[#516eb3] text-sm text-white placeholder-[#6980ba] focus:outline-none focus:border-[#ffd85c]"
              />
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <span className="text-[11px] text-[#b4c8ff]">
                  {mode === 'register' ? '首个注册账号自动获得 GM 权限' : '没有账号可点上方「快速注册」'}
                </span>
                <button
                  type="submit"
                  disabled={busy}
                  className="hx-btn-gold px-4 py-1 text-xs shrink-0"
                >
                  {busy ? '请稍候...' : mode === 'register' ? '注册并进入' : '登录并进入'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Bottom Cloud Bar with Enter Game Button (classic_4.jpg) */}
      <div
        className="relative h-[62px] flex items-center justify-center px-4 border-t border-[#4b6064]"
        style={{
          backgroundImage: 'url(/assets/hxsg/tit_bg.png)',
          backgroundSize: 'cover',
        }}
      >
        <button
          type="button"
          disabled={!account}
          onClick={() => onEnterGame(selectedRealm)}
          className={`hx-btn-gold px-7 py-1.5 text-[16px] tracking-wider ${
            !account ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          进入游戏
        </button>
      </div>
    </div>
  );
}
