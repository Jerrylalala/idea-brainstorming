import { useState } from 'react';
import { TopBar } from '@/components/top-bar';
import { LeftNavPane } from '@/components/left-nav-pane';
import { SessionListPane } from '@/components/session-list-pane';
import { MainPane } from '@/components/main-pane';
import { DecisionDrawer } from '@/components/decision-drawer';
import { ReactFlowDemo } from '@/demos/reactflow-demo';
import { TldrawDemo } from '@/demos/tldraw-demo';

type DemoMode = 'original' | 'reactflow' | 'tldraw';

export default function App() {
  const [mode, setMode] = useState<DemoMode>('original');

  return (
    <div className="h-screen bg-white text-slate-800">
      {/* 顶部 Demo 切换栏 */}
      <div className="flex h-10 items-center justify-center gap-2 border-b bg-slate-900 px-4">
        <span className="mr-3 text-xs text-slate-400">切换 Demo：</span>
        {([
          ['original', '方案 A（当前）'],
          ['reactflow', 'ReactFlow 画布'],
          ['tldraw', 'tldraw 画布'],
        ] as [DemoMode, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`rounded-lg px-3 py-1 text-xs transition-colors ${
              mode === key
                ? 'bg-white text-slate-900 font-medium'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 方案 A 原始布局 */}
      {mode === 'original' && (
        <>
          <TopBar />
          <div className="grid h-[calc(100vh-84px)] grid-cols-[auto_auto_1fr_auto]">
            <LeftNavPane />
            <SessionListPane />
            <MainPane />
            <DecisionDrawer />
          </div>
        </>
      )}

      {/* ReactFlow Demo */}
      {mode === 'reactflow' && (
        <div className="h-[calc(100vh-40px)]">
          <ReactFlowDemo />
        </div>
      )}

      {/* tldraw Demo */}
      {mode === 'tldraw' && (
        <div className="h-[calc(100vh-40px)]">
          <TldrawDemo />
        </div>
      )}
    </div>
  );
}
