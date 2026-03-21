---
title: "fix: 搜索框与 Session 一致性修复"
type: fix
date: 2026-03-20
risk_score: 2
risk_level: low
risk_note: "代码状态管理重构，4个源文件，无外部依赖，可完全通过 git 回滚"
brainstorm: "docs/brainstorms/2026-03-20-search-bar-session-consistency-brainstorm.md"
---

## Overview

**Goal**: 修复搜索框（SearchBar）在 Session 切换时不一致的问题，统一用 `nodes.length === 0` 作为显示信号，并补充「重新探索」入口与 Session 标题自动更新。

**Tech Stack**: React 18, Zustand, framer-motion, ReactFlow

**Architecture**: SearchBar 从持有本地 `isSubmitted` 状态改为从 canvas store 派生可见性；工具栏新增条件渲染的「重新探索」按钮；SearchBar 作为跨 store 的桥接层，在搜索成功后同步更新 session 标题（避免 canvas-store ↔ session-store 循环依赖）。

---

## 问题根因（来自 brainstorm）

1. `search-bar.tsx:10` 的 `isSubmitted` 是组件本地状态，`BrainstormCanvas` 始终挂载不重载，切换 session 时 `isSubmitted` 不重置
2. `search-bar.tsx:31` 使用 `fixed` 定位（相对视口），侧边栏宽度变化会导致搜索框偏移
3. `canvas-store.ts:406` 的错误路径只更新 ideaNode 状态但不移除它，导致错误时 `nodes.length > 0`，搜索框无法重现
4. `session-store.ts:55` 的 `createSession` 硬编码 title 为 `'New chat'`，`searchIdea` 不更新标题

---

## 任务列表

### Task 1: 创建功能分支

**操作**:
```bash
git checkout main && git pull origin main
git checkout -b fix/search-bar-session-consistency
```

**验证**:
- [x] `git branch --show-current` 输出 `fix/search-bar-session-consistency`

---

### Task 2: 为 session-store 添加 `updateSessionTitle` 方法

**文件**: `src/store/session-store.ts`

**操作**:
- [x] 在 `SessionState` interface 添加方法签名
- [x] 在 store 实现中添加方法

**代码**:

在 interface 末尾（`createSession: () => void` 后面）添加：
```typescript
  updateSessionTitle: (id: string, title: string) => void
```

在 store 实现末尾（`createSession` 方法后）添加：
```typescript
  updateSessionTitle: (id, title) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, title } : sess
      ),
    }))
  },
```

**验证**:
- [x] TypeScript 无报错（`pnpm tsc --noEmit`）

---

### Task 3: 重构 SearchBar（核心修复 + 定位 + 标题同步）

**文件**: `src/canvas/search-bar.tsx`

**操作**:
- [x] 移除 `isSubmitted` 本地状态
- [x] 从 canvas store 派生 `isEmpty`（`nodes.length === 0`）
- [x] 添加 `useEffect` 在画布清空时重置表单
- [x] `fixed` → `absolute`（定位修复）
- [x] 移除 Input 的 `disabled={isSubmitted}`
- [x] 搜索成功后更新 session 标题（≤20字符，超出截断加 `...`）

**完整替换文件**:
```tsx
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCanvasStore } from './store/canvas-store'
import { useSessionStore } from '@/store/session-store'

export function SearchBar() {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const searchIdea = useCanvasStore((s) => s.searchIdea)
  // 从 canvas 状态派生可见性，而非本地 isSubmitted 状态
  const isEmpty = useCanvasStore((s) => s.nodes.length === 0)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const updateSessionTitle = useSessionStore((s) => s.updateSessionTitle)

  // 切换到空画布 session 时自动重置表单（避免残留上一个 session 的输入）
  useEffect(() => {
    if (isEmpty) {
      setValue('')
      setError(null)
    }
  }, [isEmpty])

  const handleSubmit = async () => {
    if (!value.trim()) return
    setError(null)
    try {
      await searchIdea(value.trim())
      // 搜索成功后同步 session 标题（SearchBar 作为跨 store 桥接层，避免循环依赖）
      if (activeSessionId) {
        const raw = value.trim()
        const title = raw.length > 20 ? raw.slice(0, 20) + '...' : raw
        updateSessionTitle(activeSessionId, title)
      }
    } catch {
      // 搜索失败：canvas-store 的 searchIdea 会移除 ideaNode，节点清空，
      // isEmpty 变为 true，此处只需显示错误提示
      setError('探索失败，请重试')
    }
  }

  return (
    <AnimatePresence>
      {isEmpty && (
        <motion.div
          // 改为 absolute 定位，相对于画布容器（brainstorm-canvas.tsx 外层已是 relative）
          className="absolute left-1/2 z-50 flex flex-col items-center pointer-events-none"
          style={{ top: '18%', transform: 'translateX(-50%)' }}
          exit={{
            opacity: 0,
            scale: 0.9,
            y: 20,
            transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
          }}
        >
          {/* 标题文字 */}
          <motion.h1
            className="text-2xl font-semibold text-slate-800 mb-6 pointer-events-auto"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
            transition={{ duration: 0.5 }}
          >
            输入你的想法，开始探索
          </motion.h1>

          <motion.div
            className="flex items-center gap-2 rounded-full border-2 border-slate-200 bg-white px-4 py-2 shadow-lg pointer-events-auto"
            initial={{ width: 560, opacity: 0, scale: 0.95 }}
            animate={{ width: 560, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <Input
              placeholder="比如：我想开发一款营销软件..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
              }}
              className="nodrag nokey border-0 bg-transparent px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              size="sm"
              className="h-7 rounded-full"
              onClick={handleSubmit}
              disabled={!value.trim()}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              探索
            </Button>
          </motion.div>
          {error && (
            <motion.p
              className="mt-2 text-sm text-red-500 pointer-events-auto"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

**验证**:
- [x] 新建 session → 搜索框出现
- [x] 搜索后 → 搜索框消失，画布有节点
- [x] 切换到空 session → 搜索框自动出现且输入框已清空
- [x] 切换回有节点的 session → 搜索框不出现
- [x] `pnpm tsc --noEmit` 无报错

---

### Task 4: 修复 canvas-store `searchIdea` 错误路径

**文件**: `src/canvas/store/canvas-store.ts:406`

**问题**: 当前错误路径只更新 ideaNode 状态为 `idle`，但不移除节点，导致 `nodes.length > 0`，SearchBar 无法重现。

**修改位置**（`catch` 块，约第 406 行）：

```typescript
// 修改前：
} catch (err) {
  if (myVersion !== currentSearchVersion) return
  set((s) => ({
    nodes: s.nodes.map(n =>
      n.id === ideaNode.id ? { ...n, data: { ...n.data, status: 'idle' as const } } : n
    ) as CanvasNode[],
  }))
  throw err  // 让 SearchBar 感知错误，恢复搜索框
}

// 修改后：
} catch (err) {
  if (myVersion !== currentSearchVersion) return
  // 移除搜索失败时创建的 ideaNode，让画布回到空状态，SearchBar 自动重现
  set((s) => ({
    nodes: s.nodes.filter(n => n.id !== ideaNode.id) as CanvasNode[],
    edges: s.edges.filter(e => e.source !== ideaNode.id && e.target !== ideaNode.id),
  }))
  throw err
}
```

**验证**:
- [x] 断开网络或使用无效 API key，点击「探索」后报错
- [x] 报错后画布恢复空白，搜索框重新出现
- [x] 错误提示文字显示「探索失败，请重试」

---

### Task 5: 为 CanvasToolbar 添加「重新探索」按钮

**文件**: `src/canvas/canvas-toolbar.tsx`

**操作**:
- [x] 引入 `RotateCcw` 图标（lucide-react，已安装）
- [x] 订阅 `clearCanvas` 和 `hasNodes`（`nodes.length > 0`）
- [x] 按钮仅在有节点时显示，点击前需用户确认

**完整替换文件**:
```tsx
import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { RotateCcw } from 'lucide-react'
import { useCanvasStore } from './store/canvas-store'

export function CanvasToolbar() {
  const reactFlow = useReactFlow()
  const addTextNode = useCanvasStore((s) => s.addTextNode)
  const clearCanvas = useCanvasStore((s) => s.clearCanvas)
  // 仅在画布有节点时显示「重新探索」按钮
  const hasNodes = useCanvasStore((s) => s.nodes.length > 0)

  const handleAddText = useCallback(() => {
    const center = reactFlow.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    addTextNode(center, '')
  }, [reactFlow, addTextNode])

  const handleFitView = useCallback(() => {
    reactFlow.fitView({ duration: 400, padding: 0.2 })
  }, [reactFlow])

  const handleRestart = useCallback(() => {
    if (window.confirm('清空画布并重新探索？此操作无法撤销。')) {
      clearCanvas()
    }
  }, [clearCanvas])

  return (
    <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-2 py-1.5 shadow-lg backdrop-blur-sm">
      <button
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        onClick={handleAddText}
      >
        <span className="text-base leading-none">+</span> 文本
      </button>
      <div className="h-4 w-px bg-slate-200" />
      <button
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        onClick={handleFitView}
      >
        适应视口
      </button>
      {hasNodes && (
        <>
          <div className="h-4 w-px bg-slate-200" />
          <button
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            onClick={handleRestart}
          >
            <RotateCcw className="w-3 h-3" />
            重新探索
          </button>
        </>
      )}
    </div>
  )
}
```

**验证**:
- [x] 空画布时，工具栏只有「文本」和「适应视口」，无「重新探索」
- [x] 搜索后有节点时，工具栏出现「重新探索」按钮
- [x] 点击「重新探索」→ 确认弹窗 → 确认后画布清空，搜索框重现
- [x] 点击「重新探索」→ 取消 → 画布不变

---

### Task 6: 验证 Session 标题更新

**操作（验证，无需额外改代码）**:
- [x] 新建 session，输入「我想开发一款营销软件」点击探索
- [x] 检查左侧 session 列表，标题是否变为「我想开发一款营销软件」（≤20字）
- [x] 输入长文本（>20字），确认标题截断加 `...`

---

### Task 7: 提交并创建 PR

**操作**:
```bash
git add src/canvas/search-bar.tsx \
        src/canvas/canvas-toolbar.tsx \
        src/canvas/store/canvas-store.ts \
        src/store/session-store.ts

git commit -m "$(cat <<'EOF'
fix(search-bar): 搜索框可见性改为从 canvas 状态派生，修复 session 切换后不显示的问题

- SearchBar 用 nodes.length===0 替换 isSubmitted 本地状态
- 定位从 fixed 改为 absolute，跟随画布容器而非视口
- searchIdea 错误路径移除 ideaNode，让画布回到空状态
- CanvasToolbar 新增「重新探索」按钮（有节点时才显示）
- 搜索成功后自动更新 session 标题（前20字符）

🤖 Generated with [Claude Code](https://claude.com/claude-code)
Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"

gh pr create \
  --title "fix: 搜索框与 session 一致性修复" \
  --base main \
  --body "$(cat <<'EOF'
## Summary

- **核心修复**：`SearchBar.isSubmitted` → `nodes.length === 0` 派生，切换 session 时搜索框状态自动正确
- **定位修复**：`fixed` → `absolute`，搜索框跟随画布容器不再偏移
- **错误路径**：`searchIdea` 失败时移除 ideaNode，让画布回到空状态
- **新功能**：工具栏「重新探索」按钮（有节点时显示）
- **新功能**：搜索成功自动同步 session 标题（前20字符）

## Files Changed

- `src/canvas/search-bar.tsx` — 核心重构
- `src/canvas/canvas-toolbar.tsx` — 新增「重新探索」按钮
- `src/canvas/store/canvas-store.ts` — 修复 searchIdea 错误路径
- `src/store/session-store.ts` — 新增 updateSessionTitle 方法

## Test plan

- [x] 新建 session → 搜索框出现
- [x] 搜索后 → 搜索框消失
- [x] 切换空 session → 搜索框重现且输入框已清空
- [x] 切换有内容 session → 搜索框不出现
- [x] 模拟 AI 报错 → 搜索框保持可见，显示错误提示
- [x] 工具栏「重新探索」清空画布后搜索框重现
- [x] session 标题在搜索后自动更新

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Acceptance Criteria

- [x] 切换到任意空画布 session，搜索框自动出现（核心修复）
- [x] 切换到有节点的 session，搜索框不出现
- [x] 删除 session 所有节点后，搜索框自动重现
- [x] 搜索失败后，画布清空，搜索框保持可见，显示错误提示
- [x] 搜索框定位相对于画布容器，侧边栏宽度变化时不偏移
- [x] 工具栏「重新探索」按钮在有节点时出现，无节点时隐藏
- [x] 搜索成功后 session 标题更新为搜索词（≤20字）

## 影响文件

| 文件 | 改动类型 |
|------|----------|
| `src/canvas/search-bar.tsx` | 重构：移除 isSubmitted，改派生逻辑；fixed→absolute；标题同步 |
| `src/canvas/canvas-toolbar.tsx` | 增加：重新探索按钮 |
| `src/canvas/store/canvas-store.ts` | 修复：searchIdea 错误路径移除 ideaNode |
| `src/store/session-store.ts` | 增加：updateSessionTitle 方法 |

## Open Questions（已在 brainstorm 中讨论）

- ✅「重新探索」使用 `window.confirm` 确认，避免误操作
- ✅ session 标题截断策略：`slice(0, 20) + '...'`
- ⬜ 将来可考虑用 AI 自动生成更好的 session 摘要标题（超出本次范围）
