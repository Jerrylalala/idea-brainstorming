import { Circle, MoreHorizontal } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/store/session-store';
import type { SessionItem } from '@/types/session';

// 会话列表栏：按分组展示所有 Session，支持按 status 过滤
export function SessionListPane() {
  const { sessions, activeSessionId, activeFilter, setActiveSessionId } = useSessionStore();

  // 按 filter 过滤，null 表示显示全部
  const filtered = activeFilter
    ? sessions.filter((s) => s.status === activeFilter)
    : sessions;

  const today = filtered.filter((s) => s.group === 'TODAY');
  const yesterday = filtered.filter((s) => s.group === 'YESTERDAY');

  // 过滤后无结果时的标题
  const filterLabel: Record<string, string> = {
    backlog: 'Backlog',
    todo: 'Todo',
    'needs-review': 'Needs Review',
    done: 'Done',
    archived: 'Archived',
  };
  const listTitle = activeFilter ? filterLabel[activeFilter] : 'All Sessions';

  const renderGroup = (title: string, items: SessionItem[]) => (
    <div className="pb-2">
      <div className="px-2 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</div>
      <div className="space-y-1">
        {items.map((session) => {
          const isSelected = session.id === activeSessionId;
          return (
            <button
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={cn(
                'relative flex h-[42px] w-full items-center justify-between rounded-xl px-3 text-left text-sm text-slate-700 hover:bg-slate-100',
                isSelected && 'bg-slate-100'
              )}
            >
              {isSelected && (
                <div className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-violet-500" />
              )}
              <div className="flex min-w-0 items-center gap-3">
                <Circle className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{session.title}</span>
              </div>
              <span className="text-xs text-slate-400">{session.time}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="w-[306px] border-r bg-[#fafafa]">
      <div className="flex h-12 items-center justify-between px-4">
        <div className="text-sm font-semibold text-slate-800">{listTitle}</div>
        <MoreHorizontal className="h-4 w-4 text-slate-400" />
      </div>

      <ScrollArea className="h-[calc(100vh-92px)] px-3 pb-4">
        {filtered.length === 0 ? (
          <div className="px-2 pt-8 text-center text-sm text-slate-400">暂无会话</div>
        ) : (
          <>
            {today.length > 0 && renderGroup('TODAY', today)}
            {yesterday.length > 0 && renderGroup('YESTERDAY', yesterday)}
          </>
        )}
      </ScrollArea>
    </div>
  );
}
