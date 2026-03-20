import { useMemo, useEffect, useRef, useState } from 'react';
import { Circle, MoreHorizontal, Search, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/store/session-store';
import { useUIStore } from '@/store/ui-store';
import { SessionContextMenu } from '@/components/session-context-menu';
import { getSessionGroup, formatSessionTime, SESSION_GROUP } from '@/lib/session-utils';
import { useSessionKeyboard } from '@/hooks/use-session-keyboard';
import type { SessionItem } from '@/types/session';

// 定义在模块顶层，避免每次渲染时 unmount/remount
const filterLabel: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  'needs-review': 'Needs Review',
  done: 'Done',
  archived: 'Archived',
};

// 分组排序：TODAY 最前，其余按时间远近排列
const GROUP_ORDER: string[] = [
  SESSION_GROUP.TODAY,
  SESSION_GROUP.YESTERDAY,
  SESSION_GROUP.THIS_WEEK,
  SESSION_GROUP.LAST_WEEK,
  SESSION_GROUP.THIS_MONTH,
];

// 搜索关键词高亮，必须在模块顶层定义避免 unmount/remount
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  if (!query) return <span className="truncate">{title}</span>;
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  const parts = title.split(regex);
  return (
    <span className="truncate">
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-violet-100 text-violet-700 rounded px-[1px]">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// 会话列表栏：按分组展示所有 Session，支持按 status 过滤 + 搜索 + 键盘导航
export function SessionListPane() {
  const {
    sessions,
    activeSessionId,
    activeFilter,
    setActiveSessionId,
    updateSessionTitle,
  } = useSessionStore();

  const {
    searchQuery,
    isSearchVisible,
    focusedSessionId,
    setSearchQuery,
    openSearch,
    closeSearch,
    setFocusedSessionId,
  } = useUIStore();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // 搜索框打开时自动聚焦
  useEffect(() => {
    if (isSearchVisible) {
      searchInputRef.current?.focus();
    }
  }, [isSearchVisible]);

  // Ctrl+K 全局快捷键打开搜索
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
        listRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openSearch]);

  // 按 filter 过滤，null 表示显示全部（默认隐藏 archived）
  const filtered = useMemo(() => {
    const byStatus = activeFilter
      ? sessions.filter((s) => s.status === activeFilter)
      : sessions.filter((s) => s.status !== 'archived');

    if (!searchQuery.trim()) return byStatus;

    const q = searchQuery.trim().toLowerCase();
    return byStatus.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, activeFilter, searchQuery]);

  // 可见 session 的有序 id 列表（供键盘导航使用）
  const visibleIds = useMemo(() => filtered.map((s) => s.id), [filtered]);

  // 按 createdAt 动态分组
  const groupedSessions = useMemo(() => {
    const groups = new Map<string, SessionItem[]>();
    for (const session of filtered) {
      const group = getSessionGroup(session.createdAt);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(session);
    }
    return groups;
  }, [filtered]);

  // 按预定义顺序排序分组键，未知分组（如 "March 2026"）追加到末尾
  const sortedGroupKeys = useMemo(() => {
    const keys = Array.from(groupedSessions.keys());
    return keys.sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a);
      const bi = GROUP_ORDER.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [groupedSessions]);

  const listTitle = activeFilter ? filterLabel[activeFilter] : 'All Sessions';

  const handleRenameConfirm = (sessionId: string) => {
    if (renameValue.trim()) {
      updateSessionTitle(sessionId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const startRename = (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    setRenamingId(id);
    setRenameValue(session.title);
  };

  const { handleKeyDown } = useSessionKeyboard(visibleIds, startRename);

  const renderGroup = (title: string, items: SessionItem[]) => (
    <div key={title} className="pb-2">
      <div className="px-2 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">{title}</div>
      <div className="space-y-1">
        {items.map((session) => {
          const isSelected = session.id === activeSessionId;
          const isHovered = session.id === hoveredId;
          const isRenaming = session.id === renamingId;
          const isFocused = session.id === focusedSessionId;

          return (
            <SessionContextMenu
              key={session.id}
              session={session}
              onRename={() => startRename(session.id)}
            >
              <button
                onMouseEnter={() => setHoveredId(session.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => {
                  if (!isRenaming) {
                    setActiveSessionId(session.id);
                    setFocusedSessionId(session.id);
                  }
                }}
                onDoubleClick={() => startRename(session.id)}
                className={cn(
                  'relative flex h-[42px] w-full items-center justify-between rounded-xl px-3 text-left text-sm text-slate-700 hover:bg-slate-100',
                  isSelected && 'bg-slate-100',
                  isFocused && !isSelected && 'ring-1 ring-inset ring-violet-300'
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
                    <HighlightedTitle title={session.title} query={searchQuery} />
                  )}
                </div>
                {isHovered && !isRenaming ? (
                  <MoreHorizontal className="h-4 w-4 shrink-0 text-slate-400" />
                ) : (
                  <span className="text-xs text-slate-400">{formatSessionTime(session.createdAt)}</span>
                )}
              </button>
            </SessionContextMenu>
          );
        })}
      </div>
    </div>
  );

  const renderEmptyState = () => {
    // 搜索无结果
    if (isSearchVisible && searchQuery.trim()) {
      return (
        <div className="flex flex-col items-center gap-3 px-4 pt-12 text-center">
          <div className="text-2xl">🔍</div>
          <p className="text-sm font-medium text-slate-700">没有找到「{searchQuery}」</p>
          <p className="text-xs text-slate-400">试试其他关键词</p>
        </div>
      );
    }
    // 没有任何 session
    if (sessions.filter((s) => s.status !== 'archived').length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 px-4 pt-12 text-center">
          <div className="text-2xl">💡</div>
          <p className="text-sm font-medium text-slate-700">开始你的第一个想法</p>
          <p className="text-xs text-slate-400">点击上方「New Session」创建</p>
        </div>
      );
    }
    // 过滤后无结果
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
    <div
      ref={listRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="w-[306px] border-r bg-[#fafafa] outline-none focus-visible:ring-0"
    >
      <div className="flex h-12 items-center justify-between px-4">
        {isSearchVisible ? (
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') closeSearch();
              }}
              placeholder="搜索会话..."
              className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            <button onClick={closeSearch} className="rounded p-0.5 hover:bg-slate-200">
              <X className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
        ) : (
          <>
            <div className="text-sm font-semibold text-slate-800">{listTitle}</div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { openSearch(); listRef.current?.focus(); }}
                title="搜索 (Ctrl+K)"
                className="rounded p-1 hover:bg-slate-200"
              >
                <Search className="h-3.5 w-3.5 text-slate-400" />
              </button>
              <MoreHorizontal className="h-4 w-4 text-slate-400" />
            </div>
          </>
        )}
      </div>

      <ScrollArea className="h-[calc(100vh-92px)] px-3 pb-4">
        {filtered.length === 0 ? renderEmptyState() : (
          <>
            {sortedGroupKeys.map((group) =>
              renderGroup(group, groupedSessions.get(group)!)
            )}
          </>
        )}
      </ScrollArea>
    </div>
  );
}
