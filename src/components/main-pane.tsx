import { Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CurvedSuggestionCanvas } from '@/components/curved-suggestion-canvas';
import { useSessionStore } from '@/store/session-store';

// 主内容区：session 标题 + 探索画布 + 底部输入区
export function MainPane() {
  const { sessions, activeSessionId } = useSessionStore();
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const sessionTitle = activeSession?.title ?? 'New chat';

  return (
    <div className="grid min-w-0 grid-rows-[1fr_130px] bg-white">
      <div className="relative">
        {/* 顶部标题栏 */}
        <div className="flex h-12 items-center justify-center border-b px-5 text-sm font-medium text-slate-800">
          {sessionTitle}
        </div>

        {/* 右上角按钮 */}
        <div className="absolute right-4 top-3 flex items-center gap-2 text-slate-400">
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl bg-white">
            <Circle className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-xl bg-white">
            <Circle className="h-4 w-4" />
          </Button>
        </div>

        {/* 探索画布 */}
        <CurvedSuggestionCanvas />
      </div>

      {/* 底部输入区 */}
      <div className="border-t bg-white px-5 py-4">
        <div className="mx-auto flex max-w-[820px] flex-col gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Badge variant="outline" className="rounded-xl bg-slate-50">Explore</Badge>
            <Badge variant="outline" className="rounded-xl bg-slate-50">Todo</Badge>
            <div className="ml-auto rounded-xl border px-3 py-1 text-xs text-slate-500">Info</div>
          </div>

          <div className="rounded-[22px] border bg-white px-4 py-4 shadow-sm">
            <div className="text-sm text-slate-400">Press Ctrl + . for focus mode</div>
            <div className="mt-6 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-4">
                <span>Attach Files</span>
                <span>Choose Sources</span>
                <span>Work in Folder</span>
              </div>
              <div className="flex items-center gap-3">
                <span>claude-opus-4-6</span>
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-500 text-white">
                  ↑
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
