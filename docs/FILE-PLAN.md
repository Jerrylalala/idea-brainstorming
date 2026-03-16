# FILE PLAN

## 1. 当前应保留的文件

### 壳层组件

- `src/components/top-bar.tsx`
- `src/components/left-nav-pane.tsx`
- `src/components/session-list-pane.tsx`
- `src/components/decision-drawer.tsx`

### 通用 UI

- `src/components/ui/*`

### 现有 store

- `src/store/ui-store.ts`
- `src/store/session-store.ts`

### 现有 mock / types

- `src/data/mock-decisions.ts`
- `src/data/mock-nav-groups.ts`
- `src/data/mock-sessions.ts`
- `src/types/decision.ts`
- `src/types/navigation.ts`
- `src/types/session.ts`

### 工程文件

- `src/main.tsx`
- `src/index.css`
- `src/lib/utils.ts`
- `package.json`
- `vite.config.ts`
- `tailwind.config.js`
- `tsconfig.json`

## 2. 当前应废弃的文件

这些文件属于旧 suggestion canvas 或 demo 方向，不应继续作为正式实现基础。

- `src/components/main-pane.tsx`
- `src/components/search-seed-node.tsx`
- `src/components/curved-suggestion-canvas.tsx`
- `src/data/mock-suggestion-nodes.ts`
- `src/demos/reactflow-demo.tsx`
- `src/demos/tldraw-demo.tsx`

注意：

在正式 `BrainstormCanvas` 接入前，不要先删导致项目无法运行。

正确顺序是：

1. 先创建新画布
2. 改 `App.tsx`
3. 确认替换完成
4. 再删除这些旧文件

## 3. 需要新建的文件

### 核心画布

- `src/canvas/brainstorm-canvas.tsx`
- `src/canvas/canvas-toolbar.tsx`
- `src/canvas/canvas-zoom-indicator.tsx`
- `src/canvas/types.ts`

### 节点与边

- `src/canvas/nodes/text-node.tsx`
- `src/canvas/nodes/chat-node.tsx`
- `src/canvas/edges/reference-edge.tsx`

### 状态

- `src/canvas/store/canvas-store.ts`

### AI 与业务逻辑

- `src/canvas/lib/ai-client.ts`
- `src/canvas/lib/mock-ai.ts`
- `src/canvas/lib/prompt-builder.ts`
- `src/canvas/lib/node-factory.ts`
- `src/canvas/lib/markdown.ts`

### Hooks

- `src/canvas/hooks/use-create-chat-from-edge.ts`
- `src/canvas/hooks/use-expand-note.ts`
- `src/canvas/hooks/use-jump-to-reference.ts`
- `src/canvas/hooks/use-quoted-selection.ts`

## 4. 需要修改的文件

- `src/App.tsx`

修改目标：

- 删除 demo 切换栏
- 直接渲染正式布局
- 用 `BrainstormCanvas` 替换 `MainPane`

## 5. Claude Code 的删除顺序

只有在以下条件成立后，Claude Code 才应删除废弃文件：

1. `BrainstormCanvas` 已可渲染
2. `App.tsx` 已切到正式布局
3. build 可以通过

之后再删除：

- `src/components/main-pane.tsx`
- `src/components/search-seed-node.tsx`
- `src/components/curved-suggestion-canvas.tsx`
- `src/data/mock-suggestion-nodes.ts`
- `src/demos/reactflow-demo.tsx`
- `src/demos/tldraw-demo.tsx`

## 6. 不建议现在删除的内容

- 壳层组件
- 现有 store
- 现有 session / decision mock data

这些仍是正式布局的一部分。
