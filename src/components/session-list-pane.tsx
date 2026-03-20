import { useState } from 'react';
import { Circle, MoreHorizontal } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/store/session-store';
import { SessionContextMenu } from '@/components/session-context-menu';
import type { SessionItem } from '@/types/session';

// 定义在模块顶层，避免每次渲染时 unmount/remount
const filterLabel: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  'needs-review': 'Needs Review',
  done: 'Done',
  archived: 'Archived',
};

// 会话列表栏：按分组展示所有 Session，支持按 status 过滤
export function SessionListPane() {
  const {
    sessions,
    activeSessionId,
    activeFilter,
    setActiveSessionId,
    updateSessionTitle,
  } = useSessionStore();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // 按 filter 过滤，null 表示显示全部（默认隐藏 archived）
  const filtered = activeFilter
    ? sessions.filter((s) => s.status === activeFilter)
    : sessions.filter((s) => s.status !== 'archived');

  const today = filtered.filter((s) => s.group === 'TODAY');
  const yesterday = filtered.filter((s) => s.group === 'YESTERDAY');

  const listTitle = activeFilter ? filterLabel[activeFilter] : 'All Sessions';

  const handleRenameConfirm = (sessionId: string) => {
    if (renameValue.trim()) {
      updateSessionTitle(sessionId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const renderGroup = (title: string, items: SessionItem[]) => (
    <div key={title} className="pb-2">
      <div className="px-2 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</div>
      <div className="space-y-1">
        {items.map((session) => {
          const isSelected = session.id === activeSessionId;
          const isHovered = session.id === hoveredId;
          const isRenaming = session.id === renamingId;

          return (
            <SessionContextMenu
              key={session.id}
              session={session}
              onRename={() => {
                setRenamingId(session.id);
                setRenameValue(session.title);
              }}
            >
              <button
                onMouseEnter={() => setHoveredId(session.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => !isRenaming && setActiveSessionId(session.id)}
                onDoubleClick={() => {
                  setRenamingId(session.id);
                  setRenameValue(session.title);
                }}
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
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameConfirm(session.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameConfirm(session.id);
                        if (e.key === 'Escape') setRenamingId(null);
                        e.stopPropagation();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="min-w-0 flex-1 bg-transparent outline-none"
                    />
                  ) : (
                    <span className="truncate">{session.title}</span>
                  )}
                </div>
                {isHovered && !isRenaming ? (
                  <MoreHorizontal className="h-4 w-4 shrink-0 text-slate-400" />
                ) : (
                  <span className="text-xs text-slate-400">{session.time}</span>
                )}
              </button>
            </SessionContextMenu>
          );
        })}
      </div>
    </div>
  );

  const renderEmptyState = () => {
    if (sessions.filter((s) => s.status !== 'archived').length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 px-4 pt-12 text-center">
          <div className="text-2xl">💡</div>
          <p className="text-sm font-medium text-slate-700">开始你的第一个想法</p>
          <p className="text-xs text-slate-400">点击上方「New Session」创建</p>
        </div>
      );
    }
    if (activeFilter) {
      return (
        <div className="px-4 pt-8 text-center">
          <p className="text-sm text-slate-400">没有 {filterLabel[activeFilter]} 状态的会话</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-[306px] border-r bg-[#fafafa]">
      <div className="flex h-12 items-center justify-between px-4">
        <div className="text-sm font-semibold text-slate-800">{listTitle}</div>
        <MoreHorizontal className="h-4 w-4 text-slate-400" />
      </div>

      <ScrollArea className="h-[calc(100vh-92px)] px-3 pb-4">
        {filtered.length === 0 ? renderEmptyState() : (
          <>
            {today.length > 0 && renderGroup('TODAY', today)}
            {yesterday.length > 0 && renderGroup('YESTERDAY', yesterday)}
          </>
        )}
      </ScrollArea>
    </div>
  );
}
