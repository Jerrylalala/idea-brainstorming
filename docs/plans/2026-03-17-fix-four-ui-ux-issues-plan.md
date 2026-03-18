---
title: "修复 4 个 UI/UX 问题"
type: fix
date: 2026-03-17
risk_score: 2
risk_level: low
risk_note: "主要是前端视觉优化，完全可逆，无数据变更"
---

# 修复 4 个 UI/UX 问题

## Overview

**Goal**: 修复搜索动画、决策面板拖拽、连线混乱、下一步计划功能四个 UI 问题
**Tech Stack**: ReactFlow, Framer Motion, @dnd-kit, Zustand
**Architecture**: 基于现有 canvas-store 和组件结构，优化交互体验

## 问题来源

派对模式讨论（2026-03-17）确定的四个问题：
1. 搜索节点到画布的过渡动画突兀（两个独立 DOM 元素淡入淡出）
2. 决策面板不能跨区域拖拽（已确定 → 待定）
3. "下一步计划"功能无实际作用
4. 连线混乱（使用了 `getBezierPath` 导致交叉重叠）

## 技术分析

### 问题 1：搜索动画突兀
**根本原因**: `search-bar.tsx` 中搜索结果和画布节点是两个独立 DOM 元素，没有真正的共享元素动画。

**当前实现**:
```tsx
// search-bar.tsx 中只有简单的淡入淡出
<motion.div layoutId="search-bar">
  {/* 搜索框 */}
</motion.div>
```

**解决方案**: 使用 Framer Motion 的 `layoutId` 实现真正的共享元素动画，确保搜索结果和画布节点在同一 React 树中。

### 问题 2：决策面板不能跨区域拖拽
**根本原因**: `decision-drawer.tsx:187-235` 中每个区域（已确定/待定）是独立的 `SortableContext`，@dnd-kit 默认不支持跨 context 拖拽。

**当前实现**:
```tsx
// 每个区域独立的 SortableContext
<SortableContext items={confirmedIds}>
  {/* 已确定列表 */}
</SortableContext>

<SortableContext items={pendingIds}>
  {/* 待定列表 */}
</SortableContext>
```

**解决方案**: 用一个统一的 `SortableContext` 包裹所有区域，在 `handleDragEnd` 中判断拖拽目标区域。

### 问题 3："下一步计划"无实际作用
**根本原因**: 只是一个静态文本框，不触发任何行动，不影响决策面板。

**解决方案**: 改为轻量级"快速笔记"，放在折叠区域，埋点验证使用率。

### 问题 4：连线混乱
**根本原因**: `reference-edge.tsx:20` 使用 `getBezierPath` 生成贝塞尔曲线，在节点密集时产生大量交叉。

**当前实现**:
```tsx
const [edgePath, labelX, labelY] = getBezierPath({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
})
```

**解决方案**: 改用 `getSmoothStepPath` 走直角路径，自动避开节点。

## 实施计划

### Phase 1: 连线路径修复（P0 - 最快见效）

#### Task 1.1: 修改 reference-edge.tsx 使用 smoothstep 路径

**文件**: `src/canvas/edges/reference-edge.tsx:1-23`

**操作**:
- [x] 导入 `getSmoothStepPath` 替换 `getBezierPath`
- [x] 添加 `borderRadius: 8` 参数
- [x] 调整线条粗细和透明度

**代码**:
```tsx
import { useCallback } from 'react'
import {
  BaseEdge, getSmoothStepPath, EdgeLabelRenderer,
  type EdgeProps,
  useReactFlow,
} from '@xyflow/react'
import type { ReferenceEdgeData } from '../types'
import { cn } from '@/lib/utils'

const RELATION_STYLES = {
  quote: { stroke: '#8b5cf6', label: '引用', dash: '' },
  branch: { stroke: '#06b6d4', label: '分支', dash: '5,5' },
  derived: { stroke: '#10b981', label: '', dash: '' },
}

export function ReferenceEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 8,
  })

  const { fitView } = useReactFlow()
  const relation = (data as ReferenceEdgeData)?.relation ?? 'quote'
  const style = RELATION_STYLES[relation]

  const handleClick = useCallback(() => {
    const sourceRef = (data as ReferenceEdgeData)?.sourceRef
    if (sourceRef?.nodeId) {
      fitView({ nodes: [{ id: sourceRef.nodeId }], duration: 600, padding: 0.5 })
    }
  }, [data, fitView])

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: style.dash || undefined,
          opacity: selected ? 1 : 0.6,
          cursor: 'pointer',
        }}
        interactionWidth={20}
      />
      {style.label && (
        <EdgeLabelRenderer>
          <div
            className={cn(
              'absolute cursor-pointer rounded-full border px-2 py-0.5 text-[10px] font-medium',
              'bg-white shadow-sm transition-all hover:shadow-md hover:scale-110',
            )}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              borderColor: style.stroke,
              color: style.stroke,
              pointerEvents: 'all',
            }}
            onClick={handleClick}
          >
            {style.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
```

**验证**:
- [x] 运行 `npm run dev` 查看连线是否变为直角路径
- [x] 检查连线是否不再交叉重叠
- [x] 测试选中连线时粗细和透明度变化

#### Task 1.2: 添加 connectionLineType 配置

**文件**: `src/canvas/brainstorm-canvas.tsx:58-76`

**操作**:
- [x] 在 `<ReactFlow>` 组件上添加 `connectionLineType="smoothstep"`

**代码**:
```tsx
<ReactFlow
  nodes={nodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnectStart={onConnectStart}
  onConnectEnd={onConnectEnd}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  connectionLineType="smoothstep"
  fitView
  fitViewOptions={{ padding: 0.3 }}
  defaultEdgeOptions={{ type: 'reference' }}
  minZoom={0.1}
  maxZoom={2}
  panOnScroll
  zoomOnScroll={false}
  deleteKeyCode="Delete"
  proOptions={{ hideAttribution: true }}
>
```

**验证**:
- [x] 拖拽创建新连线时，预览线也是 smoothstep 样式

### Phase 2: 决策面板跨区域拖拽（P1）

#### Task 2.1: 重构 DndContext 为统一上下文

**文件**: `src/components/decision-drawer.tsx:187-235`

**操作**:
- [x] 将三个独立的 `SortableContext` 合并为一个
- [x] 修改 `handleDragEnd` 逻辑，根据 `over` 的位置判断目标区域
- [x] 添加 `moveToCategory` action 到 canvas-store

**代码**:
```tsx
// decision-drawer.tsx 中的拖拽部分
const allDecisionIds = [
  ...confirmedDirections.map(d => d.id),
  ...pendingDirections.map(d => d.id),
]

const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  })
)

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return

  // 判断目标区域
  const targetStatus = getTargetStatus(over.id, confirmedDirections, pendingDirections)

  // 更新节点状态
  moveToCategory(active.id as string, targetStatus)

  // 更新排序
  const sourceList = getListByStatus(active.id as string)
  const targetList = getListByStatus(over.id as string)

  if (sourceList === targetList) {
    // 同区域排序
    const oldIndex = sourceList.findIndex(d => d.id === active.id)
    const newIndex = sourceList.findIndex(d => d.id === over.id)
    const newOrder = arrayMove(sourceList, oldIndex, newIndex)
    updateOrder(newOrder)
  }
}

return (
  <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
    <SortableContext items={allDecisionIds} strategy={verticalListSortingStrategy}>
      {/* 已确定区域 */}
      <div data-status="confirmed">
        {confirmedDirections.map(d => (
          <SortableDecisionItem key={d.id} direction={d} />
        ))}
      </div>

      {/* 待定区域 */}
      <div data-status="pending">
        {pendingDirections.map(d => (
          <SortableDecisionItem key={d.id} direction={d} />
        ))}
      </div>
    </SortableContext>
  </DndContext>
)
```

**验证**:
- [ ] 拖拽"已确定"项到"待定"区域，节点状态改变
- [ ] 拖拽"待定"项到"已确定"区域，节点状态改变
- [ ] 画布上节点颜色随状态变化

#### Task 2.2: 添加 canvas-store 的 moveToCategory action

**文件**: `src/canvas/store/canvas-store.ts`

**操作**:
- [x] 添加 `moveToCategory(nodeId: string, newStatus: DirectionStatus)` action
- [x] 更新节点的 `status` 字段
- [x] 触发 ReactFlow 的 `onNodesChange`

**代码**:
```tsx
// canvas-store.ts 中添加
moveToCategory: (nodeId: string, newStatus: DirectionStatus) => {
  set((state) => {
    const node = state.nodes.find(n => n.id === nodeId)
    if (!node || node.type !== 'direction') return state

    const updatedNodes = state.nodes.map(n =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, status: newStatus } }
        : n
    )

    return { nodes: updatedNodes }
  })
},
```

**验证**:
- [ ] 调用 `moveToCategory` 后，节点的 `data.status` 更新
- [ ] 画布上节点颜色联动变化

### Phase 3: "下一步计划"改造（P2）

#### Task 3.1: 将"下一步计划"改为折叠式"快速笔记"

**文件**: `src/components/decision-drawer.tsx`

**操作**:
- [x] 将"下一步计划"区域改为默认折叠
- [x] 标题改为"快速笔记"
- [x] 添加折叠/展开动画
- [x] 保留原有的文本输入功能

**代码**:
```tsx
// decision-drawer.tsx 中的快速笔记部分
const [isNotesExpanded, setIsNotesExpanded] = useState(false)

<motion.div
  initial={false}
  animate={{ height: isNotesExpanded ? 'auto' : 48 }}
  className="border-t border-slate-200"
>
  <button
    onClick={() => setIsNotesExpanded(!isNotesExpanded)}
    className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50"
  >
    <div className="flex items-center gap-2">
      <FileText className="h-4 w-4 text-slate-400" />
      <span className="text-sm font-medium text-slate-700">快速笔记</span>
    </div>
    <ChevronDown
      className={cn(
        'h-4 w-4 text-slate-400 transition-transform',
        isNotesExpanded && 'rotate-180'
      )}
    />
  </button>

  {isNotesExpanded && (
    <div className="px-4 pb-4">
      <textarea
        value={nextStepPlan}
        onChange={(e) => setNextStepPlan(e.target.value)}
        placeholder="记录想法、待办事项..."
        className="w-full rounded border border-slate-200 p-2 text-sm"
        rows={3}
      />
    </div>
  )}
</motion.div>
```

**验证**:
- [ ] 默认状态下"快速笔记"是折叠的
- [ ] 点击标题可展开/折叠
- [ ] 输入内容后刷新页面，内容保留（localStorage）

#### Task 3.2: 添加使用率埋点

**文件**: `src/components/decision-drawer.tsx`

**操作**:
- [x] 在 `onChange` 中记录输入事件
- [x] 在 localStorage 中记录使用次数和最后使用时间
- [x] 添加 `console.log` 输出使用统计（临时方案）

**代码**:
```tsx
// decision-drawer.tsx 中添加埋点
function trackNotesUsage() {
  const stats = JSON.parse(localStorage.getItem('notes-usage') || '{"count":0,"lastUsed":null}')
  stats.count += 1
  stats.lastUsed = new Date().toISOString()
  localStorage.setItem('notes-usage', JSON.stringify(stats))
  console.log('[埋点] 快速笔记使用统计:', stats)
}

<textarea
  value={nextStepPlan}
  onChange={(e) => {
    setNextStepPlan(e.target.value)
    trackNotesUsage()
  }}
  // ...
/>
```

**验证**:
- [ ] 输入内容后，控制台输出使用统计
- [ ] localStorage 中有 `notes-usage` 记录

### Phase 4: 搜索动画优化（P1 - 技术难度最高）

#### Task 4.1: 确保搜索结果和画布节点在同一 React 树

**文件**: `src/canvas/search-bar.tsx`

**操作**:
- [x] 检查搜索结果是否使用 Portal 渲染
- [x] 如果是 Portal，改为在 ReactFlow 内部渲染
- [x] 确保搜索结果和画布节点共享同一个 `layoutId`

**代码**:
```tsx
// search-bar.tsx 中的搜索结果渲染
{searchResults.map(result => (
  <motion.div
    key={result.id}
    layoutId={`node-${result.id}`}
    className="p-3 hover:bg-slate-50 cursor-pointer"
    onClick={() => handleSelectResult(result)}
  >
    {result.title}
  </motion.div>
))}
```

**验证**:
- [ ] 检查 React DevTools，确认搜索结果和画布节点在同一树中
- [ ] 点击搜索结果时，元素是否从搜索框"飞"到画布位置

#### Task 4.2: 为画布节点添加对应的 layoutId

**文件**: `src/canvas/nodes/idea-node.tsx`, `src/canvas/nodes/direction-node.tsx`

**操作**:
- [x] 在节点根元素上添加 `layoutId={node-${id}}`
- [x] 确保 layoutId 与搜索结果一致

**代码**:
```tsx
// idea-node.tsx 和 direction-node.tsx 中
export function IdeaNode({ id, data }: NodeProps<IdeaNodeData>) {
  return (
    <motion.div
      layoutId={`node-${id}`}
      className="..."
    >
      {/* 节点内容 */}
    </motion.div>
  )
}
```

**验证**:
- [ ] 点击搜索结果后，节点从搜索框平滑飞到画布位置
- [ ] 动画时长 200-300ms，不会太快或太慢
- [ ] 动画过程中没有闪烁或跳跃

#### Task 4.3: 优化动画时序

**文件**: `src/canvas/search-bar.tsx`

**操作**:
- [x] 在 `handleSelectResult` 中添加动画延迟
- [x] 先触发 layoutId 动画，再更新 canvas-store

**代码**:
```tsx
async function handleSelectResult(result: SearchResult) {
  // 1. 先触发动画（通过 state 更新）
  setSelectedResult(result)

  // 2. 等待动画完成（300ms）
  await new Promise(resolve => setTimeout(resolve, 300))

  // 3. 更新 canvas-store，创建画布节点
  searchIdea(result.title)

  // 4. 清空搜索状态
  setSearchResults([])
  setSelectedResult(null)
}
```

**验证**:
- [ ] 点击搜索结果后，动画流畅无卡顿
- [ ] 动画完成后，搜索框消失，画布节点出现

## 成功标准

### 功能验证
- [ ] 连线使用 smoothstep 路径，不再交叉重叠
- [ ] 决策面板可以跨区域拖拽（已确定 ↔ 待定）
- [ ] "快速笔记"默认折叠，有使用率埋点
- [ ] 搜索结果到画布的动画流畅（如果技术可行）

### 性能验证
- [ ] 连线渲染性能无明显下降
- [ ] 拖拽操作流畅，无卡顿
- [ ] 动画帧率 ≥ 60fps

### 用户体验验证
- [ ] 连线视觉清晰，易于追踪
- [ ] 拖拽操作符合直觉
- [ ] 动画不会让用户感到不适

## 风险与依赖

### 技术风险
- **搜索动画**: Framer Motion 的 layoutId 在复杂场景下可能失效，需要降级方案（简单的画布平移 + 高亮）
- **跨区域拖拽**: @dnd-kit 的跨容器拖拽需要仔细处理边界情况

### 依赖项
- 无新增依赖（所有库已安装）

## 参考资料

### 内部参考
- 派对模式讨论记录（2026-03-17）
- `src/canvas/edges/reference-edge.tsx` - 当前连线实现
- `src/components/decision-drawer.tsx` - 决策面板实现
- `src/canvas/search-bar.tsx` - 搜索功能实现

### 外部参考
- [ReactFlow - Edge Types](https://reactflow.dev/api-reference/types/edge-types)
- [Framer Motion - Shared Layout Animations](https://www.framer.com/motion/layout-animations/)
- [@dnd-kit - Multiple Containers](https://docs.dndkit.com/presets/sortable/multiple-containers)

## 实施顺序建议

1. **Phase 1** (连线修复) - 最快见效，5 分钟完成
2. **Phase 2** (决策面板拖拽) - 中等难度，30 分钟完成
3. **Phase 3** ("快速笔记"改造) - 简单，15 分钟完成
4. **Phase 4** (搜索动画) - 最复杂，可能需要 1-2 小时，如果遇到技术障碍可以降级为简单方案

总预计时间：2-3 小时
