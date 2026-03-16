import { TopBar } from '@/components/top-bar';
import { LeftNavPane } from '@/components/left-nav-pane';
import { SessionListPane } from '@/components/session-list-pane';
import { DecisionDrawer } from '@/components/decision-drawer';
import { BrainstormCanvas } from '@/canvas/brainstorm-canvas';

export default function App() {
  return (
    <div className="h-screen bg-white text-slate-800">
      <TopBar />
      <div className="grid h-[calc(100vh-44px)] grid-cols-[auto_auto_1fr_auto]">
        <LeftNavPane />
        <SessionListPane />
        <BrainstormCanvas />
        <DecisionDrawer />
      </div>
    </div>
  );
}
