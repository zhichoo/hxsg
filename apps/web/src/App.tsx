import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  BattleState,
  CharacterView,
  ChatChannel,
  ChatMessage,
  OnlinePlayerSummary,
} from '@hxsg/shared';
import {
  api,
  getSavedRealm,
  getSavedToken,
  loadSavedRealm,
  setSavedRealm,
  setSavedToken,
  type AuthResponse,
} from './api';
import { BattleStage } from './components/BattleStage';
import { CreateRole } from './components/CreateRole';
import { GameShell } from './components/GameShell';
import { MainCity } from './components/MainCity';
import { ServerSelect } from './components/ServerSelect';
import { SubPanels, type SubPanelType } from './components/SubPanels';
import {
  connectPlatformRealtime,
  disposePlatform,
  initPlatform,
  isMappRuntime,
  signalPlatformReady,
  type PlatformTheme,
  type PlatformUser,
  type RealtimeHandle,
} from './platform/host';

type Screen = 'server' | 'create' | 'play';

export default function App() {
  const [isMapp, setIsMapp] = useState<boolean>(() => isMappRuntime());
  const [platformReady, setPlatformReady] = useState<boolean>(() => !isMappRuntime());
  const [mappUser, setMappUser] = useState<PlatformUser | null>(null);
  const [theme, setTheme] = useState<PlatformTheme | null>(null);

  const [screen, setScreen] = useState<Screen>('server');
  const [realmId, setRealmId] = useState<string>(getSavedRealm());
  const [account, setAccount] = useState<{ username: string; isGm: boolean } | null>(null);
  const [character, setCharacter] = useState<CharacterView | null>(null);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [mapPlayers, setMapPlayers] = useState<OnlinePlayerSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [subPanel, setSubPanel] = useState<SubPanelType | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const realtimeRef = useRef<RealtimeHandle | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const enterRealm = useCallback(
    async (targetRealm: string) => {
      setSavedRealm(targetRealm);
      setRealmId(targetRealm);
      try {
        const res = await api.me(targetRealm);
        setAccount(res.account);
        if (!res.character) {
          setCharacter(null);
          setBattle(null);
          setScreen('create');
        } else {
          setCharacter(res.character);
          setBattle(res.activeBattle);
          setMapPlayers(res.mapPlayers);
          setScreen('play');
        }
      } catch (err) {
        if (!isMapp) {
          setSavedToken(null);
          setAccount(null);
        }
        setScreen('server');
        notify(err instanceof Error ? err.message : '请重新登录');
      }
    },
    [isMapp, notify],
  );

  // Initialize Discourse Mini App host (or standalone Web session)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const init = await initPlatform((nextTheme) => {
          if (!cancelled) setTheme(nextTheme);
        });
        if (cancelled) return;
        setIsMapp(init.isMapp);
        setMappUser(init.user);
        if (init.theme) setTheme(init.theme);

        const savedRealm = await loadSavedRealm();
        if (!cancelled) setRealmId(savedRealm);

        if (init.isMapp) {
          if (init.user) {
            // In MAPP mode, verify session eagerly if logged in on community
            api
              .me(savedRealm)
              .then((res) => {
                if (!cancelled) setAccount(res.account);
              })
              .catch(() => {
                // Backend may be unavailable or guest mode; user can retry on click
              });
          }
        } else {
          const token = getSavedToken();
          if (token) {
            api
              .me(savedRealm)
              .then((res) => {
                if (!cancelled) setAccount(res.account);
              })
              .catch(() => {
                setSavedToken(null);
              });
          }
        }
      } catch (err) {
        if (!cancelled) {
          notify(err instanceof Error ? err.message : '初始化运行环境失败');
        }
      } finally {
        if (!cancelled) setPlatformReady(true);
        await signalPlatformReady();
      }
    })();

    return () => {
      cancelled = true;
      disposePlatform();
    };
  }, [notify]);

  // Connect native WebSocket (or MAPP SDK WebSocket) once playing with a character
  useEffect(() => {
    if (screen !== 'play' || !character) {
      realtimeRef.current?.close();
      realtimeRef.current = null;
      return;
    }

    const token = getSavedToken();
    if (!isMapp && !token) return;

    const handle = connectPlatformRealtime(realmId, token, {
      onHistory: (hist) => setMessages(hist),
      onMessage: (msg) => setMessages((prev) => [...prev.slice(-60), msg]),
      onMapPlayers: (players) => setMapPlayers(players),
    });
    realtimeRef.current = handle;

    return () => {
      handle.close();
      if (realtimeRef.current === handle) {
        realtimeRef.current = null;
      }
    };
  }, [screen, character?.id, realmId, isMapp]);

  const handleAuthSuccess = (auth: AuthResponse, targetRealm: string) => {
    setSavedToken(auth.token);
    setAccount({ username: auth.username, isGm: auth.isGm });
    void enterRealm(targetRealm);
  };

  const handleLogout = () => {
    realtimeRef.current?.close();
    if (!isMapp) {
      setSavedToken(null);
      setAccount(null);
    }
    setCharacter(null);
    setBattle(null);
    setSubPanel(null);
    setScreen('server');
    notify(isMapp ? '已返回选区' : '已退出登录');
  };

  const handleSendChat = (channel: ChatChannel, content: string) => {
    realtimeRef.current?.sendChat(channel, content);
  };

  const handleMoveMap = async (targetMapId: string) => {
    try {
      const res = await api.moveMap(realmId, targetMapId);
      setCharacter(res.character);
      setMapPlayers(res.mapPlayers);
    } catch (err) {
      notify(err instanceof Error ? err.message : '移动失败');
    }
  };

  const handleRestInn = async () => {
    try {
      const res = await api.restInn(realmId);
      setCharacter(res.character);
      notify('在客栈美美歇息了一番，主角与副将气血精力已全部回满！');
    } catch (err) {
      notify(err instanceof Error ? err.message : '休息失败');
    }
  };

  const handleStartBattle = async (enemyGroupId: string) => {
    try {
      const res = await api.startBattle(realmId, enemyGroupId);
      setBattle(res.battle);
      setSubPanel(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : '进入战斗失败');
    }
  };

  const handleBattleAction = async (cmd: {
    action: 'attack' | 'skill' | 'defend' | 'item' | 'capture' | 'flee';
    targetUid?: string;
    skillId?: string;
    itemId?: string;
    generalCommands?: Array<{
      unitUid: string;
      action: 'attack' | 'skill' | 'defend' | 'item';
      targetUid?: string;
      skillId?: string;
      itemId?: string;
    }>;
  }) => {
    const res = await api.battleAction({ realmId, ...cmd });
    setBattle(res.battle);
    setCharacter(res.character);
  };

  return (
    <GameShell toast={toast} isMapp={isMapp} theme={theme}>
      {screen === 'server' && (
        <ServerSelect
          selectedRealm={realmId}
          onSelectRealm={(r) => {
            setRealmId(r);
            setSavedRealm(r);
          }}
          isMapp={isMapp}
          platformReady={platformReady}
          mappUser={mappUser}
          account={account}
          onAuthSuccess={handleAuthSuccess}
          onEnterGame={(r) => void enterRealm(r)}
          onLogout={handleLogout}
          onNotify={notify}
        />
      )}

      {screen === 'create' && (
        <CreateRole
          realmId={realmId}
          onCreated={(ch) => {
            setCharacter(ch);
            setScreen('play');
            notify(`欢迎【${ch.name}】来到许昌！`);
          }}
          onBack={() => setScreen('server')}
          onNotify={notify}
        />
      )}

      {screen === 'play' && character && (
        <>
          {battle ? (
            <BattleStage
              battle={battle}
              character={character}
              messages={messages}
              onSendChat={handleSendChat}
              onAction={handleBattleAction}
              onExitBattle={() => setBattle(null)}
              onNotify={notify}
            />
          ) : (
            <MainCity
              character={character}
              mapPlayers={mapPlayers}
              messages={messages}
              onSendChat={handleSendChat}
              onMoveMap={(id) => void handleMoveMap(id)}
              onStartBattle={(id) => void handleStartBattle(id)}
              onRestInn={() => void handleRestInn()}
              onOpenPanel={(p) => setSubPanel(p)}
              onLogout={handleLogout}
              onNotify={notify}
            />
          )}

          {subPanel && (
            <SubPanels
              panel={subPanel}
              realmId={realmId}
              character={character}
              onUpdateCharacter={setCharacter}
              onEnterBattle={(b) => {
                setBattle(b);
                setSubPanel(null);
              }}
              onClose={() => setSubPanel(null)}
              onNotify={notify}
            />
          )}
        </>
      )}
    </GameShell>
  );
}
