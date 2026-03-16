# ARCHITECTURE

## 1. 核心判断

这个项目不是普通聊天页，也不是通用白板。

它是一个：

**以无限画布为交互载体、以真实 AI 为核心引擎的需求探索工具。**

## 2. 产品分层

### Layer A：壳层

已有并锁死：

- TopBar
- LeftNavPane
- SessionListPane
- DecisionDrawer

这些组件不改。

### Layer B：画布工作台

新建：

- BrainstormCanvas
- TextNode
- ChatNode
- ReferenceEdge
- CanvasToolbar
- CanvasZoomIndicator

### Layer C：AI 能力层

需要从第一天就设计接口：

- prompt 构建
- 引用上下文拼接
- 流式输出
- mock / real adapter 切换

### Layer D：建议系统

第二阶段实现：

- 技术选型建议
- 平台支持建议
- 自动更新建议
- 数据库与迁移建议
- 数据安全建议
- 权限与部署建议

## 3. 推荐技术选型

### 主方案

- React
- TypeScript
- Tailwind
- Zustand
- `@xyflow/react`

### AI 接口

抽象统一接口：

```ts
export interface AIClient {
  streamChat(input: ChatRequest): AsyncGenerator<ChatChunk>
}
```

第一版允许：

- `MockAIClient`

正式应接：

- OpenAI
- Ollama
- OpenAI-compatible local endpoint

## 4. 推荐目录结构

```text
src/
  components/
    top-bar.tsx
    left-nav-pane.tsx
    session-list-pane.tsx
    decision-drawer.tsx
    ui/
  store/
    ui-store.ts
    session-store.ts
  canvas/
    brainstorm-canvas.tsx
    canvas-toolbar.tsx
    canvas-zoom-indicator.tsx
    types.ts
    hooks/
      use-create-chat-from-edge.ts
      use-expand-note.ts
      use-jump-to-reference.ts
      use-quoted-selection.ts
    nodes/
      text-node.tsx
      chat-node.tsx
    edges/
      reference-edge.tsx
    store/
      canvas-store.ts
    lib/
      mock-ai.ts
      ai-client.ts
      prompt-builder.ts
      markdown.ts
      node-factory.ts
```

## 5. 数据模型

### Node

```ts
type CanvasNode = TextCanvasNode | ChatCanvasNode
```

```ts
type TextCanvasNode = {
  id: string
  type: 'text'
  position: { x: number; y: number }
  width: number
  height: number
  data: {
    title: string
    content: string
    format: 'plain' | 'markdown'
    source?: {
      kind: 'manual' | 'upload' | 'expanded-chat'
      fromNodeId?: string
      fromMessageId?: string
    }
  }
}
```

```ts
type ChatCanvasNode = {
  id: string
  type: 'chat'
  position: { x: number; y: number }
  width: number
  height: number
  data: {
    title: string
    draft: string
    status: 'idle' | 'streaming' | 'error'
    sourceRefs: SourceRef[]
    messages: ChatMessage[]
  }
}
```

### Message

```ts
type ChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  createdAt: number
}
```

### Reference

```ts
type SourceRef = {
  nodeId: string
  messageId?: string
  quotedText?: string
  range?: {
    start: number
    end: number
  }
}
```

### Edge

```ts
type CanvasEdge = {
  id: string
  source: string
  target: string
  data: {
    relation: 'quote' | 'branch' | 'derived'
    sourceRef?: SourceRef
  }
}
```

## 6. 核心交互链路

### A. 文本 -> 对话

1. 用户从 TextNode 拖线
2. 落点为空白
3. 自动创建 ChatNode
4. ChatNode 自动记录来源引用
5. 自动创建 `quote` edge

### B. 对话 -> 笔记

1. 用户点击“展开笔记”
2. 取最后一条 assistant 消息
3. 创建 TextNode
4. 自动创建 `derived` edge

### C. 文本局部 -> 分支对话

1. 用户选中文本
2. 点击“引用创建对话”
3. 新 ChatNode 只引用该片段
4. 自动创建 `branch` edge

### D. Edge 跳转

1. 点击 edge
2. 聚焦来源节点
3. 若有 quotedText，则尽量高亮

## 7. 真实 AI 的接入原则

真实 AI 不是可选项，而是产品核心。

但开发上要遵守：

- 接口先抽象
- UI 先跑通
- mock 可用于首轮验证
- 紧接着替换成真实 AI

不要把“现在先 mock”误解成“产品不需要真实 AI”。

## 8. 为什么不推荐 tldraw

- 当前不做自由绘画
- 当前需求是业务节点图
- 自定义节点、引用语义、拖线建节点更适合 React Flow
- 与现有项目依赖更一致

## 9. 第二阶段建议系统

在画布基础稳定后，新增：

- 项目类型识别
- 待确认问题清单
- 技术选型建议
- 平台与终端建议
- 数据与迁移建议
- 权限、安全、部署建议

这些内容可以先以：

- 新 Chat 分支
- 新 Note 总结
- DecisionDrawer 沉淀项

三种形式呈现。
