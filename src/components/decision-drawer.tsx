import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock3,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useUIStore } from '@/store/ui-store';
import { useCanvasStore } from '@/canvas/store/canvas-store';

// 右侧可收起决策抽屉
export function DecisionDrawer() {
  const { rightDrawerOpen, toggleRightDrawer } = useUIStore();
  const confirmedDirections = useCanvasStore((s) => s.confirmedDirections());
  const pendingDirections = useCanvasStore((s) => s.pendingDirections());

  // 根据已确认项生成下一步计划
  const nextSteps = confirmedDirections.map((dir) => `深入探索: ${dir.title}`);

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
          <div className="p-4 space-y-6">
            {/* 已确认选型 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-900">已确认选型</h3>
                <Badge variant="secondary" className="ml-auto">{confirmedDirections.length}</Badge>
              </div>
              <div className="space-y-2">
                {confirmedDirections.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">暂无已确认项</p>
                ) : (
                  confirmedDirections.map((dir, i) => (
                    <Card key={i} className="rounded-lg shadow-none border-emerald-200 bg-emerald-50">
                      <CardContent className="p-3">
                        <h4 className="text-xs font-semibold text-slate-900 mb-1">{dir.title}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">{dir.summary}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {dir.keywords.map((kw, j) => (
                            <Badge key={j} variant="secondary" className="text-[10px]">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* 待定项 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock3 className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900">待定项</h3>
                <Badge variant="secondary" className="ml-auto">{pendingDirections.length}</Badge>
              </div>
              <div className="space-y-2">
                {pendingDirections.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">暂无待定项</p>
                ) : (
                  pendingDirections.map((dir, i) => (
                    <Card key={i} className="rounded-lg shadow-none border-amber-200 bg-amber-50">
                      <CardContent className="p-3">
                        <h4 className="text-xs font-semibold text-slate-900 mb-1">{dir.title}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">{dir.summary}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {dir.keywords.map((kw, j) => (
                            <Badge key={j} variant="secondary" className="text-[10px]">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* 下一步计划 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ChevronRight className="w-4 h-4 text-violet-500" />
                <h3 className="text-sm font-semibold text-slate-900">下一步计划</h3>
                <Badge variant="secondary" className="ml-auto">{nextSteps.length}</Badge>
              </div>
              <div className="space-y-2">
                {nextSteps.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">确认方向后自动生成</p>
                ) : (
                  nextSteps.map((step, i) => (
                    <Card key={i} className="rounded-lg shadow-none border-violet-200 bg-violet-50">
                      <CardContent className="flex items-center gap-2 p-3">
                        <ChevronRight className="w-3 h-3 text-violet-600 flex-shrink-0" />
                        <p className="text-xs text-slate-700">{step}</p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      )}
    </motion.div>
  );
}
