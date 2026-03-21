---
title: "feat: Session 右键菜单 & UX 全面补全"
type: feat
date: 2026-03-20
risk_score: 3
risk_level: low
risk_note: "新增 sonner + @radix-ui/react-context-menu 两个外部依赖；涉及 store 数据模型变更（删除 isActive 字段、新增 createdAt），需同步更新 mock 数据"
brainstorm: "docs/brainstorms/2026-03-20-session-context-menu-ux-brainstorm.md"
reviewed: true
review_date: 2026-03-20
review_changes: "合并Task3→4-6，合并Task8+9并简化为仅右键触发，删除confirmDelete公开action，_deleteTimer改为store内部字段，HighlightedTitle提取至模块顶层，删除collapsedGroups(YAGNI)，修复getSessionGroup时区bug，键盘handler提取为hook，新增escapeRegExp和空列表fallback处理"
---

# feat: Session 右键菜单 & UX 全面补全

## Overview

**Goal**：补全 Session 右键菜单（Delete/Rename/Archive/Status），修复 3 个静默 Bug，并在下一 PR 添加时间分组细化、搜索框和键盘快捷键
**Tech Stack**：React + Zustand v5 + shadcn/ui（Radix ContextMenu）+ sonner（Toast）
**Architecture**：分两个独立 PR 交付——P0 修 Bug + 右键菜单，P1 重构分组 + 搜索 + 键盘

---

## 背景

（见 brainstorm：`docs/brainstorms/2026-03-20-session-context-menu-ux-brainstorm.md`）

- 参考三星 AI 工具右键菜单（12 项），与我们的应用对比——右键菜单完全为零
- Session store 仅 4 个 action，无 delete / archive / status 操作
- 存在 3 个静默 Bug 需同期修复

---

## 依赖安装（两个 PR 开始前分别执行）

```bash
# P0 开始前
npx shadcn@latest add context-menu
npm install sonner
```

---

## PR 1 (P0)：Bug 修复 + Store 扩展 + 右键菜单

**分支名**：`feat/session-context-menu`

> **审查后变更**：Task 3（接口签名）合并入 Task 3；Task 8+9 合并为 Task 8（`...` 按钮触发砍掉，只保留右键）；`confirmDelete` 不作为公开 action；`_deleteTimer` 改为 store 内部字段。最终 P0 为 **8 个 Task**。

---

### Task 1：删除 `isActive` 僵尸字段

**文件**：`src/types/session.ts`
**操作**：
- [x] 删除 `isActive?: boolean` 这一行

```ts
// 删除前
export interface SessionItem {
  id: string
  title: string
  time: string
  group: SessionGroup
  status?: SessionStatus
  isActive?: boolean         // ← 删除这行
  canvasSnapshot?: CanvasSnapshot
}
```

**文件**：`src/data/mock-sessions.ts`
**操作**：
- [x] 删除 s1 的 `isActive: true`

**文件**：`src/store/session-store.ts`
**操作**：
- [x] 修改 `activeSessionId` 初始化逻辑

```ts
// 修改前
activeSessionId: mockSessions.find((item) => item.isActive)?.id ?? null,

// 修改后
activeSessionId: mockSessions[0]?.id ?? null,
```

**验证**：
- [x] `npm run dev` 无 TS 报错，页面正常加载，s1 仍为激活 session

---

### Task 2：All Sessions 默认过滤 archived

**文件**：`src/components/session-list-pane.tsx:20`
**操作**：
- [x] 修改 `filtered` 计算逻辑

```ts
// 修改前
const filtered = activeFilter
  ? sessions.filter((s) => s.status === activeFilter)
  : sessions

// 修改后
const filtered = activeFilter
  ? sessions.filter((s) => s.status === activeFilter)
  : sessions.filter((s) => s.status !== 'archived')
```

**验证**：
- [x] All Sessions 不再显示 s5（archived），点击左侧 Archived 筛选后 s5 重新出现

---

### Task 3：Store 扩展——软删除基础设施 + 全部新 Actions

> **审查修改**：原 Task 3（先加接口）+ Task 4 + Task 5 + Task 6 合并为一个 Task。`_deleteTimer` 改为 store 内部字段（不暴露给外部），不再使用模块级变量以避免 Vite HMR 重置问题。`confirmDelete` 不作为公开 action（内部 timer 回调自行处理）。

**文件**：`src/store/session-store.ts`
**操作**：
- [x] `SessionState` interface 新增字段和方法签名（同步完成，不分步）
- [x] 实现全部 5 个新 action

```ts
// SessionState interface 新增（与实现一起写，不要先写接口）
interface SessionState {
  // ...existing...
  pendingDeletion: SessionItem | null
  _deleteTimer: ReturnType<typeof setTimeout> | null  // 内部字段，不暴露给 selector

  deleteSession: (id: string) => void
  restoreSession: () => void
  archiveSession: (id: string) => void
  setSessionStatus: (id: string, status: SessionStatus) => void
}

// store 初始值
pendingDeletion: null,
_deleteTimer: null,

// deleteSession（软删除 + active session fallback + 内部 timer）
deleteSession: (id) => {
  const { sessions, activeSessionId, _deleteTimer } = get()
  const target = sessions.find((s) => s.id === id)
  if (!target) return

  const remaining = sessions.filter((s) => s.id !== id)

  // active session fallback
  let newActiveId: string | null = activeSessionId
  if (id === activeSessionId) {
    const idx = sessions.findIndex((s) => s.id === id)
    // 优先切换到同位置的下一个，其次上一个，最后 null（空列表）
    newActiveId = remaining[idx]?.id ?? remaining[idx - 1]?.id ?? null

    if (newActiveId) {
      const { nodes, edges } = useCanvasStore.getState()
      const withSnapshot = remaining.map((s) =>
        s.id === activeSessionId ? { ...s, canvasSnapshot: { nodes, edges } } : s
      )
      const next = withSnapshot.find((s) => s.id === newActiveId)
      if (next?.canvasSnapshot) {
        useCanvasStore.getState().loadSnapshot(next.canvasSnapshot)
      } else {
        useCanvasStore.getState().clearCanvas()
      }
    } else {
      // 空列表：清空画布
      useCanvasStore.getState().clearCanvas()
    }
  }

  // 清除旧 timer（防止并发软删除时 timer 互相覆盖）
  if (_deleteTimer) clearTimeout(_deleteTimer)

  const timer = setTimeout(() => {
    set({ pendingDeletion: null, _deleteTimer: null })
  }, 5000)

  set({ sessions: remaining, activeSessionId: newActiveId, pendingDeletion: target, _deleteTimer: timer })
},

// restoreSession（撤销删除）
restoreSession: () => {
  const { pendingDeletion, sessions, _deleteTimer } = get()
  if (!pendingDeletion) return
  if (_deleteTimer) { clearTimeout(_deleteTimer) }
  set({ sessions: [pendingDeletion, ...sessions], pendingDeletion: null, _deleteTimer: null })
},

// setSessionStatus
setSessionStatus: (id, status) => {
  set((s) => ({
    sessions: s.sessions.map((sess) =>
      sess.id === id ? { ...sess, status } : sess
    ),
  }))
},

// archiveSession（语义糖）
archiveSession: (id) => {
  get().setSessionStatus(id, 'archived')
},
```

**验证**：
- [x] TypeScript 无报错
- [x] 调用 `deleteSession('s2')` → s2 从列表消失，`pendingDeletion` 有值，5 秒后自动变 null
- [x] 调用 `restoreSession()` → s2 恢复，timer 取消
- [x] Vite HMR 热更新后，store 状态正常（不出现 session 卡在 pending 的问题）

---

### Task 4：安装 shadcn ContextMenu + sonner + 创建 SessionContextMenu 组件

**操作**：
- [x] 运行 `npx shadcn@latest add context-menu`（生成 `src/components/ui/context-menu.tsx`）
- [x] 运行 `npm install sonner`
- [x] 在 `src/App.tsx` 或根布局中添加 `<Toaster />` （sonner）

```tsx
// src/App.tsx 顶部添加
import { Toaster } from 'sonner'

// JSX 中添加（根元素内）
<Toaster position="bottom-center" richColors />
```

- [x] 新建 `src/components/session-context-menu.tsx`

```tsx
// src/components/session-context-menu.tsx
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { toast } from 'sonner'
import { useSessionStore } from '@/store/session-store'
import type { SessionItem, SessionStatus } from '@/types/session'

const STATUS_LABELS: Record<SessionStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  'needs-review': 'Needs Review',
  done: 'Done',
  archived: 'Archived',
}

const STATUS_OPTIONS: SessionStatus[] = ['backlog', 'todo', 'needs-review', 'done']

interface SessionContextMenuProps {
  session: SessionItem
  onRename: () => void
  children: React.ReactNode
}

export function SessionContextMenu({ session, onRename, children }: SessionContextMenuProps) {
  const { deleteSession, restoreSession, archiveSession, setSessionStatus, activeFilter } =
    useSessionStore()

  const handleDelete = () => {
    deleteSession(session.id)
    toast(`已删除「${session.title}」`, {
      action: { label: '撤销', onClick: restoreSession },
      duration: 5000,
    })
  }

  const handleArchive = () => {
    archiveSession(session.id)
    toast(`已归档「${session.title}」`)
  }

  const handleStatus = (status: SessionStatus) => {
    setSessionStatus(session.id, status)
    // 若当前在某 filter 视图下，session 会消失，给予提示
    if (activeFilter && activeFilter !== status) {
      toast(`已移至 ${STATUS_LABELS[status]}`)
    }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={onRename}>Rename</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>Status</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {STATUS_OPTIONS.map((s) => (
              <ContextMenuItem
                key={s}
                onSelect={() => handleStatus(s)}
                className={session.status === s ? 'font-medium' : ''}
              >
                {STATUS_LABELS[s]}
                {session.status === s && ' ✓'}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onSelect={handleArchive}>Archive</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={handleDelete}
          className="text-red-600 focus:text-red-600"
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
```

**验证**：
- [x] TypeScript 无报错
- [x] `npm run dev` 正常运行

---

### Task 5：将 SessionContextMenu 接入 SessionListPane + hover `...` 按钮 + inline rename

> **审查修改**：原 Task 8 + Task 9 合并。`...` 按钮点击触发菜单（Task 9）因 Radix 受控/非受控混用坑，MVP 阶段**只保留右键触发**，`...` 按钮仅作视觉提示（hover 显示）。

**文件**：`src/components/session-list-pane.tsx`
**操作**：
- [x] 添加 `renamingId` 和 hover 状态
- [x] 用 `SessionContextMenu` 包裹每个 session button
- [x] `MoreHorizontal` 按钮改为 hover 显示并触发同一菜单

```tsx
import { useState, useRef } from 'react'
import { MoreHorizontal, Circle } from 'lucide-react'
import { SessionContextMenu } from './session-context-menu'
import { useSessionStore } from '@/store/session-store'
import { cn } from '@/lib/utils'

// 在 renderGroup 函数内，每个 session 条目替换为：
const [hoveredId, setHoveredId] = useState<string | null>(null)
const [renamingId, setRenamingId] = useState<string | null>(null)
const [renameValue, setRenameValue] = useState('')

// session 条目渲染
{items.map((session) => {
  const isSelected = session.id === activeSessionId
  const isHovered = session.id === hoveredId
  const isRenaming = session.id === renamingId

  return (
    <SessionContextMenu
      key={session.id}
      session={session}
      onRename={() => {
        setRenamingId(session.id)
        setRenameValue(session.title)
      }}
    >
      <button
        onMouseEnter={() => setHoveredId(session.id)}
        onMouseLeave={() => setHoveredId(null)}
        onClick={() => !isRenaming && setActiveSessionId(session.id)}
        onDoubleClick={() => {
          setRenamingId(session.id)
          setRenameValue(session.title)
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
              onBlur={() => {
                if (renameValue.trim()) updateSessionTitle(session.id, renameValue.trim())
                setRenamingId(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (renameValue.trim()) updateSessionTitle(session.id, renameValue.trim())
                  setRenamingId(null)
                }
                if (e.key === 'Escape') {
                  setRenamingId(null)
                }
                e.stopPropagation()
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
  )
})}
```

**验证**：
- [x] 右键 session 弹出菜单（6 项结构）
- [x] hover 时右侧显示 `...` 按钮（视觉提示，右键即可操作，无需点击 `...`）
- [x] 双击 session 标题进入编辑模式，Enter 保存，Esc 取消
- [x] 空标题按 Enter → 不保存，退出编辑

---

### Task 6：Empty State（3 场景）

**文件**：`src/components/session-list-pane.tsx`
**操作**：
- [x] 替换现有 `filtered.length === 0` 的判断逻辑，细化为 3 个场景

```tsx
const renderEmptyState = () => {
  if (sessions.filter((s) => s.status !== 'archived').length === 0) {
    // 场景 1：真正没有 session
    return (
      <div className="flex flex-col items-center gap-3 px-4 pt-12 text-center">
        <div className="text-2xl">💡</div>
        <p className="text-sm font-medium text-slate-700">开始你的第一个想法</p>
        <p className="text-xs text-slate-400">点击上方「New Session」创建</p>
      </div>
    )
  }
  if (activeFilter) {
    // 场景 2：过滤后无结果
    return (
      <div className="px-4 pt-8 text-center">
        <p className="text-sm text-slate-400">没有 {filterLabel[activeFilter]} 状态的会话</p>
      </div>
    )
  }
  return null
}

// ScrollArea 内容替换为：
{filtered.length === 0 ? renderEmptyState() : (
  <>
    {today.length > 0 && renderGroup('TODAY', today)}
    {yesterday.length > 0 && renderGroup('YESTERDAY', yesterday)}
  </>
)}
```

**验证**：
- [x] 新建项目无 session 时显示引导
- [x] 点击 Done 过滤但无 Done session 时显示提示

---

## PR 2 (P1)：时间分组重构 + 搜索框 + 键盘快捷键

**分支名**：`feat/session-search-keyboard`（从 main 拉，不从 P0 分支）

> **审查后变更**：删除 `collapsedGroups`（YAGNI）；`getSessionGroup` 修复时区 bug（改用本地日历日期比较）；`HighlightedTitle` 提取至模块顶层；新增 `escapeRegExp`；键盘 handler 提取为 `useSessionKeyboard` hook。最终 P1 为 **6 个 Task**。

---

### Task 11：SessionItem 数据模型重构（加 `createdAt`，删 `group`）

**文件**：`src/types/session.ts`
**操作**：
- [x] 删除 `SessionGroup` 类型
- [x] 修改 `SessionItem`：用 `createdAt` 替换 `group`

```ts
// 删除整行：
// export type SessionGroup = 'TODAY' | 'YESTERDAY'

export interface SessionItem {
  id: string
  title: string
  createdAt: string         // 新增：ISO 8601，如 "2026-03-20T14:30:00Z"
  time: string              // 保留：展示字符串（由 createdAt 格式化）
  // group 字段删除
  status?: SessionStatus
  canvasSnapshot?: CanvasSnapshot
}
```

**验证**：
- [x] TypeScript 报出所有用到 `group` 字段的地方（这些是下一个 task 要修的）

---

### Task 8（原 Task 12）：写 `getSessionGroup` 和 `formatSessionTime` 工具函数

> **审查修改**：原版用毫秒差判断"昨天"有时区 bug。改用本地日历日期（`toDateString()`）比较，正确处理跨日情况。

**文件**：`src/lib/session-utils.ts`（新建）

```ts
/** 将分组标签定义为常量，避免拼写错误 */
export const SESSION_GROUP = {
  TODAY: 'TODAY',
  YESTERDAY: 'YESTERDAY',
  THIS_WEEK: 'THIS WEEK',
  LAST_WEEK: 'LAST WEEK',
  THIS_MONTH: 'THIS MONTH',
} as const

/**
 * 根据 createdAt 动态计算 session 所属时间分组标签
 * 使用本地日历日期比较，避免跨时区的毫秒差计算误差
 */
export function getSessionGroup(createdAt: string): string {
  const now = new Date()
  const created = new Date(createdAt)

  // 用本地日期字符串比较，正确处理时区
  const todayStr = now.toDateString()
  const createdStr = created.toDateString()

  if (createdStr === todayStr) return SESSION_GROUP.TODAY

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (createdStr === yesterday.toDateString()) return SESSION_GROUP.YESTERDAY

  // 毫秒差（仅用于 7/14 天分界，时区误差可接受）
  const diffDays = Math.floor((now.getTime() - created.getTime()) / 86400000)
  if (diffDays <= 6) return SESSION_GROUP.THIS_WEEK
  if (diffDays <= 13) return SESSION_GROUP.LAST_WEEK

  if (
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth()
  ) return SESSION_GROUP.THIS_MONTH

  // 更早：绝对月份（'MARCH 2026'）
  return created
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase()
}

/** 展示用相对时间字符串 */
export function formatSessionTime(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
```

**验证**：
- [x] `getSessionGroup(new Date().toISOString())` → `'TODAY'`
- [x] `getSessionGroup` 用昨天 23:58 的时间戳 → `'YESTERDAY'`（而不是 `'TODAY'`）

---

### Task 13：更新 mock 数据 + `createSession()` + 修复所有 `group` 引用

**文件**：`src/data/mock-sessions.ts`
**操作**：
- [x] 替换 `group` 字段为 `createdAt`

```ts
const now = new Date()
const yesterday = new Date(now.getTime() - 86400000)

export const mockSessions: SessionItem[] = [
  {
    id: 's1',
    title: 'New chat',
    createdAt: now.toISOString(),
    time: '7m',
    status: 'todo',
  },
  {
    id: 's2',
    title: '你好，你是当前是什么模型？',
    createdAt: yesterday.toISOString(),
    time: '13h',
    status: 'done',
  },
  // ... 其余 sessions 类似处理
]
```

**文件**：`src/store/session-store.ts`
**操作**：
- [x] 修改 `createSession()`，用 `new Date().toISOString()` 替代 `group: 'TODAY'`

```ts
const newSession: SessionItem = {
  id: `session-${Date.now()}`,
  title: 'New chat',
  createdAt: new Date().toISOString(),     // 修改点
  time: 'now',
  status: 'todo',
}
```

**验证**：
- [x] TypeScript 无 `group` 相关报错

---

### Task 9（原 Task 14）：更新 SessionListPane 使用动态分组（删除 collapsedGroups）

> **审查修改**：`collapsedGroups` 是 YAGNI，从本次 PR 删除。动态分组渲染即可，折叠功能推到 P2 或砍掉。

**文件**：`src/components/session-list-pane.tsx`
**操作**：
- [x] 用 `getSessionGroup` 替代 `session.group` 做分组，不加折叠逻辑

```tsx
import { useMemo } from 'react'
import { getSessionGroup } from '@/lib/session-utils'

const GROUP_ORDER = ['TODAY', 'YESTERDAY', 'THIS WEEK', 'LAST WEEK', 'THIS MONTH']

// 动态计算分组
const grouped = useMemo(() => {
  const map = new Map<string, SessionItem[]>()

  filtered.forEach((s) => {
    const group = getSessionGroup(s.createdAt)
    if (!map.has(group)) map.set(group, [])
    map.get(group)!.push(s)
  })

  return [...map.entries()].sort(([a], [b]) => {
    const ai = GROUP_ORDER.indexOf(a)
    const bi = GROUP_ORDER.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return b.localeCompare(a) // 月份字符串倒序
  })
}, [filtered])

// renderGroup 保持简单，不加折叠
const renderGroup = (title: string, items: SessionItem[]) => (
  <div key={title} className="pb-2">
    <div className="px-2 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
      {title}
    </div>
    <div className="space-y-1">
      {/* session 条目渲染（同 P0）*/}
    </div>
  </div>
)
```

**验证**：
- [x] 分组按 TODAY/YESTERDAY/THIS WEEK 等正确显示
- [x] 新建 session 次日刷新后显示在 YESTERDAY（不再永久 TODAY）

---

### Task 10（原 Task 15-16）：搜索框 + AND 过滤 + 高亮（`HighlightedTitle` 模块顶层）

> **审查修改**：`HighlightedTitle` 提取到模块顶层（避免每次渲染 unmount/remount）；新增 `escapeRegExp` 防止搜索词含特殊字符崩溃。原 Task 15 + 16 合并为一个。

**文件**：`src/store/ui-store.ts`
**操作**：
- [x] 添加搜索状态（无需 `collapsedGroups`）

```ts
searchQuery: '',
isSearchVisible: false,
setSearchQuery: (q) => set({ searchQuery: q }),
setSearchVisible: (v) => set({ isSearchVisible: v, ...(!v && { searchQuery: '' }) }),
```

**文件**：`src/components/session-list-pane.tsx`
**操作**：
- [x] 在**文件顶层**（组件外）定义 `HighlightedTitle` 和 `escapeRegExp`

```tsx
// 文件顶层，组件函数之外定义
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function HighlightedTitle({ title, query }: { title: string; query: string }) {
  if (!query.trim()) return <span className="truncate">{title}</span>

  const escaped = escapeRegExp(query.trim())
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = title.split(regex)

  return (
    <span className="truncate">
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 text-yellow-900">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  )
}
```

- [x] `filtered` 加入 `searchQuery` AND 逻辑
- [x] 搜索框 UI（Ctrl+K 触发，Esc 收起）
- [x] 搜索无结果的 Empty State

**验证**：
- [x] 搜索 `"chat"` → 只显示匹配 session，匹配字符高亮
- [x] 搜索 `"(test)"` → 不崩溃（escapeRegExp 生效）
- [x] Ctrl+K 展开搜索框，Esc 清空并收起

---

### Task 11（原 Task 17）：键盘快捷键（`useSessionKeyboard` hook）

> **审查修改**：键盘 handler 提取为独立 hook `useSessionKeyboard`，避免 SessionListPane 组件承载过多逻辑。

**文件**：`src/hooks/use-session-keyboard.ts`（新建）

```ts
import { useCallback } from 'react'
import { toast } from 'sonner'
import { useSessionStore } from '@/store/session-store'
import { useUIStore } from '@/store/ui-store'
import type { SessionItem } from '@/types/session'

interface UseSessionKeyboardOptions {
  visibleSessions: SessionItem[]
  renamingId: string | null
  setRenamingId: (id: string | null) => void
  setRenameValue: (v: string) => void
}

export function useSessionKeyboard({
  visibleSessions,
  renamingId,
  setRenamingId,
  setRenameValue,
}: UseSessionKeyboardOptions) {
  const { setActiveSessionId, deleteSession, restoreSession } = useSessionStore()
  const { focusedSessionId, setFocusedSessionId, isSearchVisible, setSearchVisible } =
    useUIStore()

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const ids = visibleSessions.map((s) => s.id)
      const currentIdx = ids.indexOf(focusedSessionId ?? '')

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedSessionId(ids[currentIdx + 1] ?? ids[0])
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedSessionId(ids[currentIdx - 1] ?? ids[ids.length - 1])
          break
        case 'Enter':
          if (focusedSessionId) setActiveSessionId(focusedSessionId)
          break
        case 'F2': {
          if (!focusedSessionId) break
          const s = visibleSessions.find((x) => x.id === focusedSessionId)
          if (s) { setRenamingId(s.id); setRenameValue(s.title) }
          break
        }
        case 'Delete':
          if (focusedSessionId && renamingId === null) {
            const s = visibleSessions.find((x) => x.id === focusedSessionId)
            if (s) {
              deleteSession(s.id)
              toast(`已删除「${s.title}」`, {
                action: { label: '撤销', onClick: restoreSession },
              })
            }
          }
          break
        case 'Escape':
          if (renamingId) { setRenamingId(null); break }
          if (isSearchVisible) { setSearchVisible(false); break }
          setFocusedSessionId(null)
          break
        case 'k':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            setSearchVisible(true)
          }
          break
      }
    },
    [
      visibleSessions, focusedSessionId, renamingId, isSearchVisible,
      setActiveSessionId, deleteSession, restoreSession,
      setFocusedSessionId, setSearchVisible, setRenamingId, setRenameValue,
    ]
  )

  return handleKeyDown
}
```

**文件**：`src/store/ui-store.ts`
- [x] 添加 `focusedSessionId: string | null` + `setFocusedSessionId`

**文件**：`src/components/session-list-pane.tsx`
- [x] 调用 `useSessionKeyboard`，绑定到根 div 的 `onKeyDown`
- [x] 根 div 加 `tabIndex={0}`
- [x] session 条目加焦点样式 `focusedSessionId === session.id && 'ring-2 ring-violet-400 ring-inset'`

**验证**：
- [x] ↑↓ 导航不切换 canvas（`focusedSessionId` 变化，canvas 不变）
- [x] Enter 激活，F2 重命名，Delete 触发 Toast，Esc 逐层取消
- [x] Ctrl+K 聚焦搜索框

---

## 验收标准

### P0（右键菜单 PR）—— 8 个 Task

- [x] 右键弹出 6 项菜单：Rename / Status▶ / Archive / Delete
- [x] Status 子菜单显示 4 个选项，当前 status 有 ✓ 标记
- [x] Delete 后 Undo Toast，5 秒内可撤销
- [x] 删除当前激活 session → 自动切换到下一个（空列表则清空画布，`activeSessionId: null`）
- [x] Archive → session 从主列表消失，点击 Archived 筛选可见
- [x] Rename：双击 / 菜单均可触发；空标题不保存；Esc 取消
- [x] Hover 时 `...` 按钮出现（视觉提示），右键触发菜单
- [x] All Sessions 不显示 archived session
- [x] 3 种 Empty State 正常显示
- [x] HMR 热更新后不出现 pendingDeletion 卡死问题

### P1（搜索键盘 PR）—— 6 个 Task

- [x] 时间分组动态计算，TODAY/YESTERDAY/THIS WEEK/LAST WEEK/THIS MONTH/月份
- [x] 新建 session 次日刷新后正确显示在 YESTERDAY（本地日历日期判断）
- [x] Ctrl+K 展开搜索框，Esc 收起
- [x] 搜索实时过滤，AND Status Filter，高亮匹配字符
- [x] 搜索词含特殊字符不崩溃（escapeRegExp）
- [x] 搜索无结果时显示提示 + 清除按钮
- [x] ↑↓ 导航不切换 canvas（focusedSessionId ≠ activeSessionId）
- [x] Enter 激活，F2 重命名，Delete 删除，Esc 逐层取消

---

## 风险评估

```
总分：3/10 — 低风险 🟢

  安全/隐私:  0  （无敏感数据）
  可逆性:     1  （代码重构，git revert 可恢复）
  影响范围:   0  （本地/个人项目）
  变更规模:   1  （约 8-12 个源文件）
  外部依赖:   1  （新增 sonner + @radix-ui/react-context-menu）

主要风险：sonner 与 @radix-ui/react-context-menu 是新依赖，需确认与现有
          Vite + React 18 构建链兼容；SessionItem 数据模型变更需同步
          更新 mock 数据，否则 TypeScript 报错阻塞开发
```

---

## 参考文件

| 文件 | 说明 |
|---|---|
| `src/types/session.ts` | SessionItem 类型定义 |
| `src/store/session-store.ts` | Session 状态管理 |
| `src/store/ui-store.ts` | UI 状态管理 |
| `src/components/session-list-pane.tsx` | Session 列表主组件 |
| `src/data/mock-sessions.ts` | 测试数据 |
| `src/components/ui/context-menu.tsx` | shadcn ContextMenu（待安装）|
| `src/lib/session-utils.ts` | 工具函数（待创建）|
| `src/components/session-context-menu.tsx` | 右键菜单组件（待创建）|
