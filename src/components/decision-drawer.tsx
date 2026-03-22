import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import type { CanvasNode } from '@/canvas/types';
import {
  CheckCircle2,
  Clock3,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  Rocket,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/store/ui-store';
import { useCanvasStore } from '@/canvas/store/canvas-store';
import type { DirectionCanvasNode, SummaryResult } from '@/canvas/types';
import {
  DndContext,
  DragOverlay,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 区域 droppable 容器 ID
const DROPPABLE_CONFIRMED = 'droppable-confirmed';
const DROPPABLE_PENDING = 'droppable-pending';

// 可放置区域容器：只在列表为空时注册为 droppable，有 item 时不注册
// 这样碰撞检测只会命中具体 item，避免 overId 是容器导致插入位置计算错误
function DroppableZone({ id, children, isEmpty }: { id: string; children: React.ReactNode; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !isEmpty });
  return (
    <div ref={setNodeRef} className={`min-h-[8px] rounded transition-colors ${isOver && isEmpty ? 'bg-slate-100 border border-dashed border-slate-300' : ''}`}>
      {children}
    </div>
  );
}

// 可拖拽的面板项（悬浮展开细节 + 拖拽排序）
function DraggableItem({ id, title, summary, borderColor, onRemove }: {
  id: string
  title: string
  summary?: string
  borderColor: string
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    willChange: 'transform' as const,
  };

  // useCallback 包裹，避免每次渲染重建
  const handleEnter = useCallback(() => {
    if (leaveTimer.current) { clearTimeout(leaveTimer.current); leaveTimer.current = null; }
    setHovered(true);
  }, []);
  const handleLeave = useCallback(() => {
    leaveTimer.current = setTimeout(() => setHovered(false), 200);
  }, []);

  useEffect(() => () => { if (leaveTimer.current) clearTimeout(leaveTimer.current); }, []);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group ml-6 my-1 rounded-md border-l-2 ${borderColor} ${isDragging ? 'opacity-50' : ''}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div
        className="flex items-center py-1.5 pl-2 pr-1 cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-colors"
        {...attributes}
        {...listeners}
      >
        {/* 展开指示箭头 */}
        {summary ? (
          <ChevronRight className={`w-3 h-3 mr-1 text-slate-400 transition-transform duration-200 ${hovered ? 'rotate-90' : ''}`} />
        ) : (
          <div className="w-4 mr-1" />
        )}

        <span className="text-xs text-slate-700 flex-1 truncate">{title}</span>

        {/* 删除按钮 */}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-100 rounded transition-opacity"
        >
          <X className="w-3 h-3 text-slate-400" />
        </button>
      </div>

      {/* 悬浮展开细节 - 纯 CSS grid 动画（GPU 友好，无 JS 逐帧计算） */}
      <div
        className="transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ display: 'grid', gridTemplateRows: hovered && summary ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="pl-8 pr-2 pb-2 text-[11px] text-slate-500 leading-relaxed">
            {summary}
          </div>
        </div>
      </div>
    </div>
  );
}

// 跨区拖拽插入位置预览占位符（纯视觉，不影响真实数据）
function InsertionPlaceholder() {
  return (
    <div className="ml-6 my-1 h-7 rounded-md border border-dashed border-slate-300 bg-slate-50" />
  );
}

// 插入预览数据结构
type InsertionPreview = { zone: 'confirmed' | 'pending'; index: number } | null;

// localStorage 键名
const STORAGE_KEY_CONFIRMED = 'decision-drawer-confirmed-order';
const STORAGE_KEY_PENDING = 'decision-drawer-pending-order';

// 带缓存的选择器工厂：每个组件实例独立缓存，确保 getSnapshot 返回稳定引用
// React 18 useSyncExternalStore 要求 getSnapshot 本身必须返回稳定引用，equality 函数不够
type PanelNodeData = { id: string; status: string; title: string; summary?: string };
function makePanelNodesSelector() {
  let cache: PanelNodeData[] | null = null;
  return (s: { nodes: CanvasNode[] }) => {
    const next = (s.nodes as DirectionCanvasNode[])
      .filter((n): n is DirectionCanvasNode => n.type === 'direction' && (n.data.status === 'confirmed' || n.data.status === 'pending'))
      .map(n => ({ id: n.id, status: n.data.status as string, title: n.data.title, summary: n.data.summary }));
    if (
      cache !== null &&
      cache.length === next.length &&
      cache.every((item, i) =>
        item.id === next[i].id &&
        item.status === next[i].status &&
        item.title === next[i].title &&
        item.summary === next[i].summary
      )
    ) {
      return cache; // 返回同一引用，getSnapshot 稳定
    }
    cache = next;
    return next;
  };
}

// 右侧可收起决策抽屉
export function DecisionDrawer() {
  const { rightDrawerOpen, toggleRightDrawer } = useUIStore();
  // 每个组件实例创建独立的缓存选择器，useMemo 保证只创建一次
  const panelSelector = useMemo(() => makePanelNodesSelector(), []);
  const directionNodes = useCanvasStore(panelSelector);
  const removeFromPanel = useCanvasStore((s) => s.removeFromPanel);
  const moveToCategory = useCanvasStore((s) => s.moveToCategory);
  const summaryStatus = useCanvasStore(s => s.summaryStatus);
  const summaryResult = useCanvasStore(s => s.summaryResult);
  const generateSummary = useCanvasStore(s => s.generateSummary);
  const clearSummary = useCanvasStore(s => s.clearSummary);

  // 折叠状态管理
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    confirmed: true,
    pending: true,
    next: false,
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  // 跨区拖拽时的插入位置预览（不修改真实 order state，避免挤压其他 item）
  const [insertionPreview, setInsertionPreview] = useState<InsertionPreview>(null);
  // 追踪拖拽过程中经过的区域
  const dragOverZone = useRef<'confirmed' | 'pending' | null>(null);
  // 记录拖拽开始时的原始区域
  const dragSourceZone = useRef<'confirmed' | 'pending' | null>(null);

  // 组合碰撞检测：先用指针位置（精准），找不到再用矩形面积兜底
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
  }, []);

  // 排序状态（存储 nodeId 数组）
  const [confirmedOrder, setConfirmedOrder] = useState<string[]>([]);
  const [pendingOrder, setPendingOrder] = useState<string[]>([]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 从精确选择器派生数据（不再依赖整个 nodes 数组）
  const confirmedNodesMap = useMemo(
    () => new Map(
      directionNodes
        .filter(n => n.status === 'confirmed')
        .map(n => [n.id, { id: n.id, title: n.title, summary: n.summary }])
    ),
    [directionNodes]
  );

  const pendingNodesMap = useMemo(
    () => new Map(
      directionNodes
        .filter(n => n.status === 'pending')
        .map(n => [n.id, { id: n.id, title: n.title, summary: n.summary }])
    ),
    [directionNodes]
  );

  // 挂载时一次性初始化排序：从 localStorage 读取，或使用默认顺序
  // 空依赖数组确保只在 mount 时执行一次，不会因 Map 引用变化覆盖拖拽排序结果
  useEffect(() => {
    const storedConfirmed = localStorage.getItem(STORAGE_KEY_CONFIRMED);
    const initialConfirmedIds = Array.from(confirmedNodesMap.keys());
    if (storedConfirmed) {
      try {
        const parsed = JSON.parse(storedConfirmed) as string[];
        const validOrder = parsed.filter(id => confirmedNodesMap.has(id));
        const newIds = initialConfirmedIds.filter(id => !validOrder.includes(id));
        setConfirmedOrder([...validOrder, ...newIds]);
      } catch {
        setConfirmedOrder(initialConfirmedIds);
      }
    } else {
      setConfirmedOrder(initialConfirmedIds);
    }

    const storedPending = localStorage.getItem(STORAGE_KEY_PENDING);
    const initialPendingIds = Array.from(pendingNodesMap.keys());
    if (storedPending) {
      try {
        const parsed = JSON.parse(storedPending) as string[];
        const validOrder = parsed.filter(id => pendingNodesMap.has(id));
        const newIds = initialPendingIds.filter(id => !validOrder.includes(id));
        setPendingOrder([...validOrder, ...newIds]);
      } catch {
        setPendingOrder(initialPendingIds);
      }
    } else {
      setPendingOrder(initialPendingIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount only

  // 同步新增/删除的节点，保留已有排序顺序
  useEffect(() => {
    setConfirmedOrder(prev => {
      const currentIds = new Set(confirmedNodesMap.keys());
      const filtered = prev.filter(id => currentIds.has(id));
      const newIds = Array.from(currentIds).filter(id => !prev.includes(id));
      return [...filtered, ...newIds];
    });
  }, [confirmedNodesMap]);

  useEffect(() => {
    setPendingOrder(prev => {
      const currentIds = new Set(pendingNodesMap.keys());
      const filtered = prev.filter(id => currentIds.has(id));
      const newIds = Array.from(currentIds).filter(id => !prev.includes(id));
      return [...filtered, ...newIds];
    });
  }, [pendingNodesMap]);

  // 保存排序到 localStorage
  useEffect(() => {
    if (confirmedOrder.length > 0) {
      localStorage.setItem(STORAGE_KEY_CONFIRMED, JSON.stringify(confirmedOrder));
    }
  }, [confirmedOrder]);

  useEffect(() => {
    if (pendingOrder.length > 0) {
      localStorage.setItem(STORAGE_KEY_PENDING, JSON.stringify(pendingOrder));
    }
  }, [pendingOrder]);

  // 按排序生成最终列表
  const confirmedItems = useMemo(
    () => confirmedOrder.map(id => confirmedNodesMap.get(id)).filter(Boolean) as { id: string; title: string; summary?: string }[],
    [confirmedOrder, confirmedNodesMap]
  );

  const pendingItems = useMemo(
    () => pendingOrder.map(id => pendingNodesMap.get(id)).filter(Boolean) as { id: string; title: string; summary?: string }[],
    [pendingOrder, pendingNodesMap]
  );

  // 快速笔记状态（localStorage 持久化）
  const STORAGE_KEY_NOTES = 'decision-drawer-quick-notes';
  const [quickNotes, setQuickNotes] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_NOTES) || '';
  });

  // 保存笔记到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_NOTES, quickNotes);
  }, [quickNotes]);

  // 使用率埋点
  const trackNotesUsage = () => {
    const stats = JSON.parse(localStorage.getItem('notes-usage') || '{"count":0,"lastUsed":null}');
    stats.count += 1;
    stats.lastUsed = new Date().toISOString();
    localStorage.setItem('notes-usage', JSON.stringify(stats));
  };

  // 找到正在拖拽的项
  const activeItem = activeId
    ? [...confirmedItems, ...pendingItems].find(item => item.id === activeId)
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
    setInsertionPreview(null);
    dragOverZone.current = null;
    dragSourceZone.current = confirmedOrder.includes(id) ? 'confirmed' : 'pending';
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) { setInsertionPreview(null); return; }
    const activeId = active.id as string;
    const overId = over.id as string;
    const sourceZone = dragSourceZone.current;

    // 判断鼠标在 over 元素的上半还是下半，决定插入前还是插入后
    const overRect = over.rect;
    const activeRect = active.rect.current.translated;
    const isBefore = activeRect
      ? activeRect.top + activeRect.height / 2 < overRect.top + overRect.height / 2
      : false;

    if (overId === DROPPABLE_PENDING || pendingOrder.includes(overId)) {
      dragOverZone.current = 'pending';
      if (sourceZone === 'confirmed') {
        // 跨区：只更新预览位置，不修改真实 order state
        const overIndex = pendingOrder.indexOf(overId);
        let insertIndex: number;
        if (overIndex === -1) {
          // overId 是容器（列表为空时），插入 index=0
          insertIndex = 0;
        } else {
          insertIndex = isBefore ? overIndex : overIndex + 1;
        }
        setInsertionPreview({ zone: 'pending', index: insertIndex });
      } else {
        setInsertionPreview(null);
        // 同区内移动：实时更新排序
        if (pendingOrder.includes(overId)) {
          setPendingOrder(items => {
            const oldIndex = items.indexOf(activeId);
            const newIndex = items.indexOf(overId);
            if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return items;
            return arrayMove(items, oldIndex, newIndex);
          });
        }
      }
    } else if (overId === DROPPABLE_CONFIRMED || confirmedOrder.includes(overId)) {
      dragOverZone.current = 'confirmed';
      if (sourceZone === 'pending') {
        // 跨区：只更新预览位置
        const overIndex = confirmedOrder.indexOf(overId);
        let insertIndex: number;
        if (overIndex === -1) {
          // overId 是容器（列表为空时），插入 index=0
          insertIndex = 0;
        } else {
          insertIndex = isBefore ? overIndex : overIndex + 1;
        }
        setInsertionPreview({ zone: 'confirmed', index: insertIndex });
      } else {
        setInsertionPreview(null);
        // 同区内移动：实时更新排序
        if (confirmedOrder.includes(overId)) {
          setConfirmedOrder(items => {
            const oldIndex = items.indexOf(activeId);
            const newIndex = items.indexOf(overId);
            if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return items;
            return arrayMove(items, oldIndex, newIndex);
          });
        }
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const preview = insertionPreview;
    setInsertionPreview(null);
    const sourceZone = dragSourceZone.current;
    const zone = preview?.zone ?? dragOverZone.current;
    dragOverZone.current = null;
    dragSourceZone.current = null;

    const { active, over } = event;
    if (!over && !preview) return;

    const activeId = active.id as string;

    if (sourceZone === 'confirmed' && zone === 'pending') {
      moveToCategory(activeId, 'pending');
      setConfirmedOrder(items => items.filter(id => id !== activeId));
      setPendingOrder(items => {
        const insertAt = preview?.index ?? items.length;
        return [...items.slice(0, insertAt), activeId, ...items.slice(insertAt)];
      });
    } else if (sourceZone === 'pending' && zone === 'confirmed') {
      moveToCategory(activeId, 'confirmed');
      setPendingOrder(items => items.filter(id => id !== activeId));
      setConfirmedOrder(items => {
        const insertAt = preview?.index ?? items.length;
        return [...items.slice(0, insertAt), activeId, ...items.slice(insertAt)];
      });
    }
    // 同区内排序：handleDragOver 的 arrayMove 已实时处理
  };

  return (
    <div
      className="border-l bg-white transition-[width] duration-300 ease-in-out overflow-hidden"
      style={{ width: rightDrawerOpen ? 320 : 44 }}
    >
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
          {/* AI 综合分析区块 */}
          <div className="px-4 pt-3 pb-2 border-b border-neutral-800">
            <button
              onClick={summaryResult ? clearSummary : generateSummary}
              disabled={summaryStatus === 'loading'}
              className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium
                bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed
                text-white transition-colors"
            >
              {summaryStatus === 'loading' ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  正在分析...
                </>
              ) : summaryResult ? (
                '清除分析结果'
              ) : (
                '✦ AI 综合分析'
              )}
            </button>

            {summaryStatus === 'error' && (
              <p className="mt-2 text-xs text-red-400 text-center">分析失败，请重试</p>
            )}

            {summaryResult && (
              <div className="mt-3 space-y-3">
                {(
                  [
                    summaryResult.confirmedDecisions,
                    summaryResult.openQuestions,
                    summaryResult.overlookedConsiderations,
                    summaryResult.suggestedNextSteps,
                  ] as SummaryResult[keyof SummaryResult][]
                ).map((section) => (
                  section.items.length > 0 && (
                    <div key={section.title}>
                      <h4 className="text-xs font-semibold text-neutral-400 mb-1">{section.title}</h4>
                      <ul className="space-y-1">
                        {section.items.map((item, i) => (
                          <li key={i} className="text-xs text-neutral-300 flex gap-1.5">
                            <span className="mt-0.5 shrink-0 text-violet-400">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>

          <DndContext
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="p-3 space-y-1">
              {/* 已确认选型 - 独立 SortableContext 避免跨区域自动排序 */}
              <div>
                <button onClick={() => toggleSection('confirmed')} className="w-full flex items-center gap-2 py-2 hover:bg-slate-50 rounded-md px-1 transition-colors">
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expandedSections.confirmed ? 'rotate-90' : ''}`} />
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-slate-900 flex-1 text-left">已确认选型</span>
                  <span className="text-xs text-slate-400">{confirmedItems.length}</span>
                </button>
                {expandedSections.confirmed && (
                  <SortableContext items={confirmedOrder} strategy={verticalListSortingStrategy}>
                    <DroppableZone id={DROPPABLE_CONFIRMED} isEmpty={confirmedItems.length === 0}>
                      {confirmedItems.length === 0 ? (
                        <>
                          {insertionPreview?.zone === 'confirmed' && <InsertionPlaceholder />}
                          <p className="ml-6 py-1.5 pl-3 text-xs text-slate-400">暂无已确认项，可从待定项拖入</p>
                        </>
                      ) : (
                        <>
                          {confirmedItems.map((item, i) => (
                            <div key={item.id}>
                              {insertionPreview?.zone === 'confirmed' && insertionPreview.index === i && <InsertionPlaceholder />}
                              <DraggableItem
                                id={item.id}
                                title={item.title}
                                summary={item.summary}
                                borderColor="border-emerald-300"
                                onRemove={() => removeFromPanel(item.id)}
                              />
                            </div>
                          ))}
                          {insertionPreview?.zone === 'confirmed' && insertionPreview.index >= confirmedItems.length && <InsertionPlaceholder />}
                        </>
                      )}
                    </DroppableZone>
                  </SortableContext>
                )}
              </div>

              {/* 待定项 - 独立 SortableContext */}
              <div>
                <button onClick={() => toggleSection('pending')} className="w-full flex items-center gap-2 py-2 hover:bg-slate-50 rounded-md px-1 transition-colors">
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expandedSections.pending ? 'rotate-90' : ''}`} />
                  <Clock3 className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-slate-900 flex-1 text-left">待定项</span>
                  <span className="text-xs text-slate-400">{pendingItems.length}</span>
                </button>
                {expandedSections.pending && (
                  <SortableContext items={pendingOrder} strategy={verticalListSortingStrategy}>
                    <DroppableZone id={DROPPABLE_PENDING} isEmpty={pendingItems.length === 0}>
                      {pendingItems.length === 0 ? (
                        <>
                          {insertionPreview?.zone === 'pending' && <InsertionPlaceholder />}
                          <p className="ml-6 py-1.5 pl-3 text-xs text-slate-400">暂无待定项，可从已确认拖入</p>
                        </>
                      ) : (
                        <>
                          {pendingItems.map((item, i) => (
                            <div key={item.id}>
                              {insertionPreview?.zone === 'pending' && insertionPreview.index === i && <InsertionPlaceholder />}
                              <DraggableItem
                                id={item.id}
                                title={item.title}
                                summary={item.summary}
                                borderColor="border-amber-300"
                                onRemove={() => removeFromPanel(item.id)}
                              />
                            </div>
                          ))}
                          {insertionPreview?.zone === 'pending' && insertionPreview.index >= pendingItems.length && <InsertionPlaceholder />}
                        </>
                      )}
                    </DroppableZone>
                  </SortableContext>
                )}
              </div>

              {/* 快速笔记（原"下一步计划"） */}
              <div>
                <button onClick={() => toggleSection('next')} className="w-full flex items-center gap-2 py-2 hover:bg-slate-50 rounded-md px-1 transition-colors">
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expandedSections.next ? 'rotate-90' : ''}`} />
                  <Rocket className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-semibold text-slate-900 flex-1 text-left">快速笔记</span>
                </button>
                {expandedSections.next && (
                  <div className="ml-6 mr-1 mb-2">
                    <textarea
                      value={quickNotes}
                      onChange={(e) => {
                        setQuickNotes(e.target.value);
                        trackNotesUsage();
                      }}
                      placeholder="记录想法、待办事项..."
                      className="w-full rounded-md border border-slate-200 p-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-violet-300 focus:outline-none focus:ring-1 focus:ring-violet-200 resize-none"
                      rows={3}
                    />
                  </div>
                )}
              </div>
            </div>

            <DragOverlay>
              {activeItem ? (
                <div className="py-1.5 pl-3 border-l-2 border-slate-400 text-xs text-slate-700 bg-white shadow-lg rounded px-2">
                  {activeItem.title}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </ScrollArea>
      )}
    </div>
  );
}
