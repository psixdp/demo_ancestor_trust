import { useEffect } from 'react';
import { useGame, type Tab } from './store/gameStore';
import { BattleView } from './ui/battle/BattleView';
import { Modals } from './ui/Modals';
import { TitleScreen } from './ui/TitleScreen';
import { TopBar } from './ui/TopBar';
import { DebugPage } from './ui/hub/DebugPage';
import { ExpeditionPage } from './ui/hub/ExpeditionPage';
import { FacilitiesPage } from './ui/hub/FacilitiesPage';
import { FamilyPage } from './ui/hub/FamilyPage';
import { MarriagePage } from './ui/hub/MarriagePage';
import { MemoryPage } from './ui/hub/MemoryPage';
import { PossessionPage } from './ui/hub/PossessionPage';
import { ReportsPage } from './ui/hub/ReportsPage';
import { isAdult } from './core/character';

const TABS: { id: Tab; name: string }[] = [
  { id: 'family', name: '家族成员' },
  { id: 'marriage', name: '联姻育种' },
  { id: 'facilities', name: '设施与岗位' },
  { id: 'memory', name: '先祖记忆池' },
  { id: 'possession', name: '夺舍仪式' },
  { id: 'expedition', name: '地下城出征' },
  { id: 'reports', name: '月报与数据' },
];

function Hub() {
  const { game, tab, setTab, nextMonth, debug } = useGame();
  if (!game) return null;
  const idle = game.members.filter((m) => isAdult(m) && !m.job && !m.isPatriarch).length;
  const tabs = debug.enabled ? [...TABS, { id: 'debug' as Tab, name: '调试面板' }] : TABS;
  const onNext = () => {
    if (idle > 0 && !confirm(`有 ${idle} 名成年子嗣未安排岗位，确定推进到下月？`)) return;
    nextMonth();
  };
  return (
    <div className="body">
      <div className="nav">
        {tabs.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.name}
            {t.id === 'family' && game.pendingTraitChoices.length > 0 ? <span className="badge">{game.pendingTraitChoices.length}</span> : null}
          </button>
        ))}
      </div>
      <div className="main">
        {tab === 'family' && <FamilyPage />}
        {tab === 'marriage' && <MarriagePage />}
        {tab === 'facilities' && <FacilitiesPage />}
        {tab === 'memory' && <MemoryPage />}
        {tab === 'possession' && <PossessionPage />}
        {tab === 'expedition' && <ExpeditionPage />}
        {tab === 'reports' && <ReportsPage />}
        {tab === 'debug' && <DebugPage />}
      </div>
      {!game.gameOver && (
        <button className="primary next-month" onClick={onNext}>
          推进至下月 ▶
        </button>
      )}
    </div>
  );
}

export function App() {
  const { screen, toasts, setDebug, debug } = useGame();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Backquote' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setDebug({ enabled: !useGame.getState().debug.enabled });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setDebug]);

  return (
    <div className="app">
      {screen === 'title' && <TitleScreen />}
      {screen !== 'title' && <TopBar />}
      {screen === 'hub' && <Hub />}
      {screen === 'battle' && <BattleView />}
      {screen !== 'title' && <Modals />}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.ok ? '' : 'err'}`}>
            {t.text}
          </div>
        ))}
      </div>
      {debug.enabled && screen !== 'title' && (
        <div style={{ position: 'fixed', left: 8, bottom: 6, fontSize: 11 }} className="warn">
          调试模式（~ 切换）
        </div>
      )}
    </div>
  );
}
