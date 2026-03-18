---
name: 代码结构与技术栈分析
description: idea-brainstorming 项目的完整技术栈、架构模式和实现细节分析
type: reference
---

# 代码结构与技术栈分析报告

**分析日期**: 2026-03-17
**项目**: idea-brainstorming (AI 头脑风暴无限画布工具)

---

## 1. 技术栈总览

### 核心依赖

| 库名 | 版本 | 用途 | 使用位置 |
|------|------|------|----------|
| `@xyflow/react` | ^12.10.1 | 画布引擎（ReactFlow） | `src/canvas/brainstorm-canvas.tsx` |
| `framer-motion` | ^11.15.0 | 动画库 | 4 个文件（见下文） |
| `@dnd-kit/core` | ^6.3.1 | 拖拽核心 | `src/components/decision-drawer.tsx` |
| `@dnd-kit/sortable` | ^10.0.0 | 可排序列表 | `src/components/decision-drawer.tsx` |
| `zustand` | ^5.0.0 | 状态管理 | `canvas-store.ts`, `ui-store.ts`, `session-store.ts` |
| `dagre` | ^0.8.5 | 图布局算法 | `src/canvas/store/canvas-store.ts` (自动布局) |
| `tldraw` | ^4.4.1 | **未使用**（已安装但未引用） | - |

### UI 组件库

- **Radix UI**: `@radix-ui/react-scroll-area`, `react-tabs`, `react-slot`
- **Tailwind CSS**: v3.4.16 + `tailwind-merge`, `class-variance-authority`
- **图标**: `lucide-react` (^0.468.0)

---

## 2. 项目架构分层

### Layer A: 壳层（已锁定，不可修改）

```
src/components/
├── top-bar.tsx           # 顶部导航栏
├── left-nav-pane.tsx     # 左侧导航面板（使用 framer-motion）
├── session-list-pane.tsx # 会话列表面板
└── decision-drawer.tsx   # 右侧决策抽屉（使用 framer-motion + @dnd-kit）
```

**布局结构** (`App.tsx`):
```tsx
<TopBar />
<div className="grid grid-cols-[auto_auto_1fr_auto]">
  <LeftNavPane />
  <SessionListPane />
  <BrainstormCanvas />  {/* 主画布区域 */}
  <DecisionDrawer />
</div>
```

### Layer B: 画布工作台（核心功能区）

```
src/canvas/
├── brainstorm-canvas.tsx        # 画布主容器（ReactFlow Provider）
├── canvas-toolbar.tsx           # 画布工具栏
├── canvas-zoom-indicator.tsx    # 缩放指示器
├── search-bar.tsx               # 搜索栏（使用 framer-motion）
├── types.ts                     # 类型定义
├── nodes/
│   ├── text-node.tsx            # 文本节点
│   ├── chat-node.tsx            # 对话节点
│   ├── direction-node.tsx       # 方向节点（技术选型）
│   └── idea-node.tsx            # 想法节点（根节点，使用 framer-motion）
├── edges/
│   └── reference-edge.tsx       # 引用边
├── hooks/
│   └── use-create-chat-from-edge.ts  # 拖线创建对话节点
├── store/
│   └── canvas-store.ts          # 画布状态管理（Zustand）
└── lib/
    ├── ai-client.ts             # AI 客户端统一入口
    ├── mock-ai.ts               # Mock AI 实现
    ├── node-factory.ts          # 节点工厂函数
    ├── prompt-builder.ts        # Prompt 构建器
    └── tree-layout.ts           # 树形布局算法
```

### Layer C: 状态管理

```
src/store/
├── canvas-store.ts    # 画布节点/边状态（Zustand）
├── ui-store.ts        # UI 状态（侧边栏展开/收起）
└── session-store.ts   # 会话管理
```

---

## 3. ReactFlow 使用模式

### 节点类型注册

```tsx
// src/canvas/brainstorm-canvas.tsx
const nodeTypes = {
  text: TextNode,
  chat: ChatNode,
  direction: DirectionNode,
  idea: IdeaNode,
}

const edgeTypes = {
  reference: ReferenceEdge,
}
```

### 配置特点

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
  <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
  <CanvasToolbar />
  <CanvasZoomIndicator />
</ReactFlow>
```

**关键特性**:
- 使用点阵背景 (`BackgroundVariant.Dots`)
- 滚轮平移，禁用滚轮缩放
- 支持 Delete 键删除节点
- 自定义节点类型：4 种（text, chat, direction, idea）
- 自定义边类型：1 种（reference）

---

## 4. Framer Motion 集成情况

### 使用位置（4 个文件）

| 文件 | 动画类型 | 用途 |
|------|----------|------|
| `decision-drawer.tsx` | 宽度动画 | 右侧抽屉展开/收起 (320px ↔ 44px) |
| `left-nav-pane.tsx` | 宽度+透明度 | 左侧导航展开/收起 (220px ↔ 0px) |
| `search-bar.tsx` | 布局动画 + 淡入淡出 | 搜索栏提交后消失，使用 `layoutId="idea-input"` |
| `idea-node.tsx` | 节点动画 | 想法节点的入场动画 |

### 典型实现模式

```tsx
// decision-drawer.tsx
<motion.div animate={{ width: rightDrawerOpen ? 320 : 44 }}>
  {/* 内容 */}
</motion.div>

// search-bar.tsx
<motion.div
  layoutId="idea-input"
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
  {/* 搜索输入框 */}
</motion.div>
```

---

## 5. @dnd-kit 使用情况

### 使用位置

**仅在 `decision-drawer.tsx` 中使用**，用于实现决策面板内的拖拽排序。

### 实现细节

```tsx
import {
  DndContext,
  closestCenter,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

**功能**:
- 已确认选型列表可拖拽排序
- 待定项列表可拖拽排序
- 使用 `localStorage` 持久化排序状态
- 拖拽时显示 `DragOverlay` 预览

**排序状态管理**:
```tsx
const [confirmedOrder, setConfirmedOrder] = useState<string[]>([])
const [pendingOrder, setPendingOrder] = useState<string[]>([])

// 保存到 localStorage
localStorage.setItem('decision-drawer-confirmed-order', JSON.stringify(confirmedOrder))
localStorage.setItem('decision-drawer-pending-order', JSON.stringify(pendingOrder))
```

---

## 6. 决策面板实现位置

### 文件路径
`src/components/decision-drawer.tsx`

### 核心功能

1. **三个折叠区域**:
   - 已确认选型 (confirmed)
   - 待定项 (pending)
   - 下一步计划 (next)

2. **数据来源**:
   - 从 `canvas-store` 读取 `direction` 类型节点
   - 根据 `status` 字段过滤：`confirmed` / `pending` / `idle`

3. **交互特性**:
   - 可拖拽排序（使用 @dnd-kit）
   - 可展开/折叠查看详情
   - 可删除（调用 `removeFromPanel(nodeId)`）
   - 排序状态持久化到 localStorage

4. **动画**:
   - 使用 `framer-motion` 实现宽度动画
   - 展开时宽度 320px，收起时 44px

### 与画布的数据同步

```tsx
// 从画布节点派生数据
const confirmedNodesMap = useMemo(
  () => new Map(
    nodes
      .filter(n => n.type === 'direction' && n.data.status === 'confirmed')
      .map(n => [n.id, { id: n.id, title: n.data.title, summary: n.data.summary }])
  ),
  [nodes]
)
```

---

## 7. 搜索功能实现位置

### 文件路径
`src/canvas/search-bar.tsx`

### 实现细节

```tsx
export function SearchBar() {
  const [value, setValue] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const searchIdea = useCanvasStore((s) => s.searchIdea)
  const reactFlow = useReactFlow()

  const handleSubmit = async () => {
    if (!value.trim()) return
    setIsSubmitted(true)
    await searchIdea(value.trim())

    // 延迟 fitView 确保节点已渲染
    requestAnimationFrame(() => {
      reactFlow.fitView({ padding: 0.2, duration: 800 })
    })
  }

  if (isSubmitted) return null  // 提交后隐藏

  return (
    <motion.div layoutId="idea-input">
      {/* 搜索输入框 */}
    </motion.div>
  )
}
```

### 搜索流程

1. 用户输入想法 → 点击"探索"按钮
2. 调用 `canvas-store.searchIdea(idea)`
3. 清除现有 direction/idea 节点
4. 创建 `IdeaNode` 作为根节点
5. 调用 AI 生成 3-5 个方向节点 (`DirectionNode`)
6. 使用 dagre 算法自动布局
7. 搜索栏消失（`isSubmitted = true`）

---

## 8. 节点类型详解

### DirectionNode（方向节点）

**文件**: `src/canvas/nodes/direction-node.tsx`

**数据结构**:
```ts
type DirectionNodeData = {
  title: string           // 方向标题
  summary: string         // 摘要描述
  keywords: string[]      // 关键词
  status: 'idle' | 'loading' | 'confirmed' | 'pending'
  depth: number           // 层级深度
  parentNodeId: string | null
  opinionDraft: string    // 内联输入框的值
  isExpanding: boolean    // 是否显示输入框
}
```

**交互特性**:
- 点击展开按钮 → 显示输入框，输入补充想法
- 点击确认按钮 → 标记为 `confirmed`，同步到决策面板
- 点击待定按钮 → 标记为 `pending`，同步到决策面板
- 输入想法后提交 → 生成子方向节点

**状态样式**:
```tsx
const borderColor =
  status === 'confirmed' ? 'border-emerald-400' :
  status === 'pending' ? 'border-amber-400' :
  status === 'loading' ? 'border-blue-400' :
  'border-slate-200'
```

### IdeaNode（想法节点）

**文件**: `src/canvas/nodes/idea-node.tsx`

**用途**: 作为方向树的根节点，显示用户输入的原始想法。

### ChatNode（对话节点）

**文件**: `src/canvas/nodes/chat-node.tsx`

**特性**:
- 支持流式 AI 回复
- 支持引用来源（显示 `sourceRefs`）
- 支持选中文字后"引用提问"（创建分支对话）
- 支持"展开为笔记"（创建 TextNode）

### TextNode（文本节点）

**文件**: `src/canvas/nodes/text-node.tsx`

**用途**: 承载用户手写内容、markdown 文档、AI 生成的笔记。

---

## 9. 自动布局算法

### 使用库
`dagre` (^0.8.5)

### 实现位置
`src/canvas/store/canvas-store.ts` 中的 `getLayoutedElements()` 函数

### 配置参数

```ts
dagreGraph.setGraph({
  rankdir: 'LR',      // 从左到右布局
  nodesep: 80,        // 节点水平间距
  ranksep: 60,        // 层级垂直间距
  edgesep: 100,       // 边最小长度
})
```

### 触发时机

- 用户搜索想法后生成方向树
- 用户提交意见后生成子方向节点
- 调用 `canvas-store.layoutNodes()` 手动触发

---

## 10. AI 接口设计

### 抽象接口

```ts
// src/canvas/types.ts
export interface AIClient {
  streamChat(input: ChatRequest): AsyncGenerator<ChatChunk>
  generateDirections(input: DirectionRequest): Promise<Direction[]>
}
```

### 当前实现

```ts
// src/canvas/lib/ai-client.ts
import { MockAIClient } from './mock-ai'

export const aiClient: AIClient = new MockAIClient()
```

**设计原则**:
- 接口先抽象，UI 先跑通
- 当前使用 `MockAIClient`
- 未来可替换为 OpenAI / Ollama / 本地模型

---

## 11. 状态管理模式

### Zustand Store 结构

#### canvas-store.ts（核心状态）

```ts
interface CanvasState {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  lastDeleted: { nodes: CanvasNode[]; edges: CanvasEdge[] } | null

  // ReactFlow 回调
  onNodesChange: (changes: NodeChange<CanvasNode>[]) => void
  onEdgesChange: (changes: EdgeChange<CanvasEdge>[]) => void

  // 节点操作
  addTextNode: (position, content?) => string
  addChatFromEdge: (sourceNodeId, position) => string
  expandNote: (chatNodeId, messageId) => string | null

  // 对话操作
  updateDraft: (nodeId, draft) => void
  sendMessage: (nodeId) => void

  // 方向树操作
  searchIdea: (idea: string) => Promise<void>
  startExpanding: (nodeId: string) => void
  submitOpinion: (nodeId: string) => Promise<void>
  confirmDirection: (nodeId: string) => void
  pendingDirection: (nodeId: string) => void

  // 面板操作
  removeFromPanel: (nodeId: string) => void
  moveToCategory: (nodeId, newStatus) => void

  // 布局操作
  layoutNodes: () => void
}
```

#### ui-store.ts（UI 状态）

```ts
interface UIState {
  leftCollapsed: boolean
  rightDrawerOpen: boolean
  toggleLeftNav: () => void
  toggleRightDrawer: () => void
}
```

---

## 12. 关键设计模式

### 1. 节点工厂模式

**文件**: `src/canvas/lib/node-factory.ts`

```ts
export function createTextNode(position, content, options?) { ... }
export function createChatNode(position, sourceRefs) { ... }
export function createDirectionNode(position, title, summary, keywords, depth, parentNodeId) { ... }
export function createIdeaNode(position, idea) { ... }
export function createEdge(source, target, relation, sourceRef?) { ... }
```

### 2. Prompt 构建器

**文件**: `src/canvas/lib/prompt-builder.ts`

用于构建 AI 对话的系统提示词和消息历史。

### 3. 树形布局算法

**文件**: `src/canvas/lib/tree-layout.ts`

用于计算子节点的位置，避免重叠。

---

## 13. 数据流总结

```
用户输入想法
  ↓
SearchBar.handleSubmit()
  ↓
canvas-store.searchIdea()
  ↓
创建 IdeaNode + 调用 AI
  ↓
生成 DirectionNode 数组
  ↓
dagre 自动布局
  ↓
用户点击 DirectionNode 操作按钮
  ↓
更新 status (confirmed/pending)
  ↓
DecisionDrawer 自动同步显示
  ↓
用户拖拽排序
  ↓
localStorage 持久化
```

---

## 14. 未使用的依赖

- **tldraw** (^4.4.1): 已安装但未在代码中引用，可能是早期技术选型遗留。

---

## 15. 推荐的代码导航路径

### 理解画布核心流程

1. `src/App.tsx` - 整体布局
2. `src/canvas/brainstorm-canvas.tsx` - 画布容器
3. `src/canvas/store/canvas-store.ts` - 状态管理核心
4. `src/canvas/nodes/direction-node.tsx` - 方向节点实现

### 理解决策面板

1. `src/components/decision-drawer.tsx` - 面板实现
2. `src/canvas/store/canvas-store.ts` - 数据来源

### 理解搜索功能

1. `src/canvas/search-bar.tsx` - 搜索 UI
2. `src/canvas/store/canvas-store.ts` - `searchIdea()` 方法
3. `src/canvas/lib/ai-client.ts` - AI 调用

---

## 16. 技术债务与改进建议

### 当前技术债务

1. **tldraw 依赖未使用**: 可以移除以减小包体积
2. **Mock AI 实现**: 需要尽快替换为真实 AI 接口
3. **持久化缺失**: 画布数据未保存到数据库

### 改进建议

1. **性能优化**:
   - 大量节点时考虑虚拟化渲染
   - 使用 `React.memo` 优化节点组件

2. **类型安全**:
   - 加强 Zustand store 的类型推导
   - 使用 `zod` 验证 AI 返回数据

3. **测试覆盖**:
   - 为 `canvas-store` 添加单元测试
   - 为节点组件添加快照测试

---

**报告生成时间**: 2026-03-17
**分析工具**: Claude Code (repo-research-analyst agent)
