import { AIStatusBadge } from '@/components/ai-status-badge';
import {
  Sparkles,
  ChevronDown,
  Plus,
  Sidebar,
  Circle,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/ui-store';

// 顶部全局栏：toggle sidebar / logo / 前进后退 / workspace
export function TopBar() {
  const { leftCollapsed, toggleLeftCollapsed } = useUIStore();

  return (
    <div className="flex h-11 items-center justify-between border-b bg-[#f7f8fa] px-3">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-md text-slate-600"
          onClick={toggleLeftCollapsed}
        >
          <Sidebar className="h-4 w-4" />
        </Button>

        <div className="flex h-7 w-7 items-center justify-center rounded-md text-violet-600">
          <Sparkles className="h-3.5 w-3.5" />
        </div>

        <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
        <ArrowRight className="h-3.5 w-3.5 text-slate-300" />

        <button className="ml-1 flex h-8 items-center gap-2 rounded-xl border bg-white px-3 text-sm text-slate-700 shadow-sm">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-medium text-slate-700">
            M
          </div>
          <span>My Workspace</span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      <div className="flex items-center gap-3 text-slate-400">
        <AIStatusBadge />
        <Plus className="h-4 w-4" />
        <Circle className="h-4 w-4" />
      </div>
    </div>
  );
}
