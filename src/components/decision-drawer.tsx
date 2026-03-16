import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock3,
  AlertTriangle,
  Pin,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/store/ui-store';
import { mockDecisions } from '@/data/mock-decisions';
import type { DecisionCategory } from '@/types/decision';

// 每个分类对应的图标
const categoryIcon: Record<DecisionCategory, React.ComponentType<{ className?: string }>> = {
  confirmed: CheckCircle2,
  pending: Clock3,
  preference: Pin,
  risk: AlertTriangle,
  next: ChevronRight,
};

// 每个分类对应的图标颜色
const categoryColor: Record<DecisionCategory, string> = {
  confirmed: 'text-emerald-500',
  pending: 'text-amber-500',
  preference: 'text-violet-500',
  risk: 'text-rose-500',
  next: 'text-sky-500',
};

// Tab 标签文案
const categoryLabel: Record<DecisionCategory, string> = {
  confirmed: '已确认',
  pending: '待定',
  preference: '偏好',
  risk: '风险',
  next: '下一步',
};

const categories: DecisionCategory[] = ['confirmed', 'pending', 'preference', 'risk', 'next'];

// 右侧可收起决策抽屉
export function DecisionDrawer() {
  const { rightDrawerOpen, toggleRightDrawer } = useUIStore();

  return (
    <motion.div animate={{ width: rightDrawerOpen ? 320 : 44 }} className="border-l bg-white">
      <div className="flex h-12 items-center justify-between border-b px-2.5">
        {rightDrawerOpen ? (
          <div className="px-1 text-sm font-medium text-slate-700">决策抽屉</div>
        ) : (
          <div className="mx-auto text-[11px] text-slate-400 [writing-mode:vertical-rl]">决策</div>
        )}

        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={toggleRightDrawer}>
          {rightDrawerOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </Button>
      </div>

      {rightDrawerOpen && (
        <Tabs defaultValue="confirmed" className="flex h-[calc(100vh-92px)] flex-col">
          <TabsList className="mx-3 mt-3 grid grid-cols-5 rounded-xl bg-slate-100 p-1">
            {categories.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="text-[11px]">
                {categoryLabel[cat]}
              </TabsTrigger>
            ))}
          </TabsList>

          {categories.map((cat) => {
            const items = mockDecisions.filter((d) => d.category === cat);
            const Icon = categoryIcon[cat];
            const color = categoryColor[cat];

            return (
              <TabsContent key={cat} value={cat} className="min-h-0 flex-1 px-3 pb-3 pt-3">
                <ScrollArea className="h-full pr-1">
                  <div className="space-y-3">
                    {items.map((item) => (
                      <Card key={item.id} className="rounded-2xl shadow-none">
                        <CardContent className="flex items-start gap-3 p-3 text-xs leading-6 text-slate-700">
                          <Icon className={`mt-1 h-3.5 w-3.5 ${color}`} />
                          <div>{item.content}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </motion.div>
  );
}
