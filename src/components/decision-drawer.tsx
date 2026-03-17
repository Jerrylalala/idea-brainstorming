import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock3,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/store/ui-store';
import { useCanvasStore } from '@/canvas/store/canvas-store';
import type { DirectionCanvasNode } from '@/canvas/types';

// 右侧可收起决策抽屉
export function DecisionDrawer() {
  const { rightDrawerOpen, toggleRightDrawer } = useUIStore();
  const nodes = useCanvasStore((s) => s.nodes);

  // 折叠状态管理
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    confirmed: true,
    pending: true,
    next: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 直接从 nodes 派生，React 可以追踪 nodes 变化
  const confirmed = useMemo(
    () => nodes.filter(n => n.type === 'direction' && n.data.status === 'confirmed').map(n => (n as DirectionCanvasNode).data),
    [nodes]
  );
  const pending = useMemo(
    () => nodes.filter(n => n.type === 'direction' && n.data.status === 'pending').map(n => (n as DirectionCanvasNode).data),
    [nodes]
  );

  // 根据已确认项生成下一步计划
  const nextSteps = confirmed.map((dir) => `深入探索: ${dir.title}`);

  return (
    <motion.div animate={{ width: rightDrawerOpen ? 320 : 44 }} className="border-l bg-white">
      <div className="flex h-12 items-center justify-between border-b px-2.5">
        {rightDrawerOpen ? (
          <div className="px-1 text-sm font-medium text-slate-700">决策面板</div>
        ) : (
          <div className="mx-auto text-[11px] text-slate-400 [writing-mode:vertical-rl]">决策</div>
        )}

        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={toggleRightDrawer}>
          {rightDrawerOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </Button>
      </div>

      {rightDrawerOpen && (
        <ScrollArea className="h-[calc(100vh-92px)]">
          <div className="p-3 space-y-1">
            {/* 已确认选型 */}
            <div>
              <button onClick={() => toggleSection('confirmed')} className="w-full flex items-center gap-2 py-2 hover:bg-slate-50 rounded-md px-1 transition-colors">
                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expandedSections.confirmed ? 'rotate-90' : ''}`} />
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-semibold text-slate-900 flex-1 text-left">已确认选型</span>
                <span className="text-xs text-slate-400">{confirmed.length}</span>
              </button>
              {expandedSections.confirmed && (
                <div className="mb-2">
                  {confirmed.length === 0 ? (
                    <p className="ml-6 py-1.5 pl-3 text-xs text-slate-400">暂无已确认项</p>
                  ) : (
                    confirmed.map((dir, i) => (
                      <div key={i} className="ml-6 py-1.5 pl-3 border-l-2 border-emerald-300 text-xs text-slate-700">
                        {dir.title}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 待定项 */}
            <div>
              <button onClick={() => toggleSection('pending')} className="w-full flex items-center gap-2 py-2 hover:bg-slate-50 rounded-md px-1 transition-colors">
                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expandedSections.pending ? 'rotate-90' : ''}`} />
                <Clock3 className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-slate-900 flex-1 text-left">待定项</span>
                <span className="text-xs text-slate-400">{pending.length}</span>
              </button>
              {expandedSections.pending && (
                <div className="mb-2">
                  {pending.length === 0 ? (
                    <p className="ml-6 py-1.5 pl-3 text-xs text-slate-400">暂无待定项</p>
                  ) : (
                    pending.map((dir, i) => (
                      <div key={i} className="ml-6 py-1.5 pl-3 border-l-2 border-amber-300 text-xs text-slate-700">
                        {dir.title}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 下一步计划 */}
            <div>
              <button onClick={() => toggleSection('next')} className="w-full flex items-center gap-2 py-2 hover:bg-slate-50 rounded-md px-1 transition-colors">
                <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expandedSections.next ? 'rotate-90' : ''}`} />
                <Rocket className="w-4 h-4 text-violet-500" />
                <span className="text-sm font-semibold text-slate-900 flex-1 text-left">下一步计划</span>
                <span className="text-xs text-slate-400">{nextSteps.length}</span>
              </button>
              {expandedSections.next && (
                <div className="mb-2">
                  {nextSteps.length === 0 ? (
                    <p className="ml-6 py-1.5 pl-3 text-xs text-slate-400">确认方向后自动生成</p>
                  ) : (
                    nextSteps.map((step, i) => (
                      <div key={i} className="ml-6 py-1.5 pl-3 border-l-2 border-violet-300 text-xs text-slate-700">
                        {step}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      )}
    </motion.div>
  );
}
