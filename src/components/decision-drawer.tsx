import { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock3,
  ChevronRight,
  ChevronDown,
  PanelRightClose,
  PanelRightOpen,
  Rocket,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStore } from '@/store/ui-store';
import { useCanvasStore } from '@/canvas/store/canvas-store';
import type { DirectionCanvasNode } from '@/canvas/types';
import {
  DndContext,
  closestCenter,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 可拖拽的面板项（带展开细节 + 删除）
function DraggableItem({ id, title, summary, borderColor, onRemove }: {
  id: string
  title: string
  summary?: string
  borderColor: string
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [expanded, setExpanded] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group ml-6 my-1 rounded-md border-l-2 ${borderColor} ${isDragging ? 'opacity-50' : ''}`}
    >
      <div
        className="flex items-center py-1.5 pl-2 pr-1 cursor-grab active:cursor-grabbing hover:bg-slate-50 transition-colors"
        {...attributes}
        {...listeners}
      >
        {/* 展开/折叠箭头 */}
        {summary ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="mr-1 p-0.5"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
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

      {/* 展开细节 */}
      {expanded && summary && (
        <div className="pl-8 pr-2 pb-2 text-[11px] text-slate-500 leading-relaxed">
          {summary}
        </div>
      )}
    </div>
  );
}

// localStorage 键名
const STORAGE_KEY_CONFIRMED = 'decision-drawer-confirmed-order';
const STORAGE_KEY_PENDING = 'decision-drawer-pending-order';

// 右侧可收起决策抽屉
export function DecisionDrawer() {
  const { rightDrawerOpen, toggleRightDrawer } = useUIStore();
  const nodes = useCanvasStore((s) => s.nodes);
  const removeFromPanel = useCanvasStore((s) => s.removeFromPanel);

  // 折叠状态管理
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    confirmed: true,
    pending: true,
    next: true,
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  // 排序状态（存储 nodeId 数组）
  const [confirmedOrder, setConfirmedOrder] = useState<string[]>([]);
  const [pendingOrder, setPendingOrder] = useState<string[]>([]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 从 nodes 派生原始数据
  const confirmedNodesMap = useMemo(
    () => new Map(
      nodes
        .filter(n => n.type === 'direction' && n.data.status === 'confirmed')
        .map(n => [n.id, { id: n.id, title: (n as DirectionCanvasNode).data.title, summary: (n as DirectionCanvasNode).data.summary }])
    ),
    [nodes]
  );

  const pendingNodesMap = useMemo(
    () => new Map(
      nodes
        .filter(n => n.type === 'direction' && n.data.status === 'pending')
        .map(n => [n.id, { id: n.id, title: (n as DirectionCanvasNode).data.title, summary: (n as DirectionCanvasNode).data.summary }])
    ),
    [nodes]
  );

  // 初始化排序：从 localStorage 读取，或使用默认顺序
  useEffect(() => {
    const storedConfirmed = localStorage.getItem(STORAGE_KEY_CONFIRMED);
    const storedPending = localStorage.getItem(STORAGE_KEY_PENDING);

    if (storedConfirmed) {
      try {
        const parsed = JSON.parse(storedConfirmed) as string[];
        // 过滤掉已不存在的 nodeId
        const validOrder = parsed.filter(id => confirmedNodesMap.has(id));
        // 添加新出现的 nodeId
        const newIds = Array.from(confirmedNodesMap.keys()).filter(id => !validOrder.includes(id));
        setConfirmedOrder([...validOrder, ...newIds]);
      } catch {
        setConfirmedOrder(Array.from(confirmedNodesMap.keys()));
      }
    } else {
      setConfirmedOrder(Array.from(confirmedNodesMap.keys()));
    }

    if (storedPending) {
      try {
        const parsed = JSON.parse(storedPending) as string[];
        const validOrder = parsed.filter(id => pendingNodesMap.has(id));
        const newIds = Array.from(pendingNodesMap.keys()).filter(id => !validOrder.includes(id));
        setPendingOrder([...validOrder, ...newIds]);
      } catch {
        setPendingOrder(Array.from(pendingNodesMap.keys()));
      }
    } else {
      setPendingOrder(Array.from(pendingNodesMap.keys()));
    }
  }, [confirmedNodesMap, pendingNodesMap]);

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

  // 根据已确认项生成下一步计划
  const nextSteps = confirmedItems.map((item) => ({ id: `next-${item.id}`, title: `深入探索: ${item.title}` }));

  // 找到正在拖拽的项
  const activeItem = activeId
    ? [...confirmedItems, ...pendingItems].find(item => item.id === activeId)
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // 判断是在哪个区域内拖拽
    if (confirmedOrder.includes(activeId) && confirmedOrder.includes(overId)) {
      // 在 confirmed 区内排序
      setConfirmedOrder((items) => {
        const oldIndex = items.indexOf(activeId);
        const newIndex = items.indexOf(overId);
        return arrayMove(items, oldIndex, newIndex);
      });
    } else if (pendingOrder.includes(activeId) && pendingOrder.includes(overId)) {
      // 在 pending 区内排序
      setPendingOrder((items) => {
        const oldIndex = items.indexOf(activeId);
        const newIndex = items.indexOf(overId);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

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
          <DndContext
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="p-3 space-y-1">
              {/* 已确认选型 */}
              <div>
                <button onClick={() => toggleSection('confirmed')} className="w-full flex items-center gap-2 py-2 hover:bg-slate-50 rounded-md px-1 transition-colors">
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expandedSections.confirmed ? 'rotate-90' : ''}`} />
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-semibold text-slate-900 flex-1 text-left">已确认选型</span>
                  <span className="text-xs text-slate-400">{confirmedItems.length}</span>
                </button>
                {expandedSections.confirmed && (
                  <SortableContext items={confirmedOrder} strategy={verticalListSortingStrategy}>
                    {confirmedItems.length === 0 ? (
                      <p className="ml-6 py-1.5 pl-3 text-xs text-slate-400">暂无已确认项</p>
                    ) : (
                      confirmedItems.map((item) => (
                        <DraggableItem
                          key={item.id}
                          id={item.id}
                          title={item.title}
                          summary={item.summary}
                          borderColor="border-emerald-300"
                          onRemove={() => removeFromPanel(item.id)}
                        />
                      ))
                    )}
                  </SortableContext>
                )}
              </div>

              {/* 待定项 */}
              <div>
                <button onClick={() => toggleSection('pending')} className="w-full flex items-center gap-2 py-2 hover:bg-slate-50 rounded-md px-1 transition-colors">
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expandedSections.pending ? 'rotate-90' : ''}`} />
                  <Clock3 className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-slate-900 flex-1 text-left">待定项</span>
                  <span className="text-xs text-slate-400">{pendingItems.length}</span>
                </button>
                {expandedSections.pending && (
                  <SortableContext items={pendingOrder} strategy={verticalListSortingStrategy}>
                    {pendingItems.length === 0 ? (
                      <p className="ml-6 py-1.5 pl-3 text-xs text-slate-400">暂无待定项</p>
                    ) : (
                      pendingItems.map((item) => (
                        <DraggableItem
                          key={item.id}
                          id={item.id}
                          title={item.title}
                          summary={item.summary}
                          borderColor="border-amber-300"
                          onRemove={() => removeFromPanel(item.id)}
                        />
                      ))
                    )}
                  </SortableContext>
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
                      nextSteps.map((step) => (
                        <div key={step.id} className="ml-6 my-1 py-1.5 pl-3 rounded-md border-l-2 border-violet-300 text-xs text-slate-700">
                          {step.title}
                        </div>
                      ))
                    )}
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
    </motion.div>
  );
}
