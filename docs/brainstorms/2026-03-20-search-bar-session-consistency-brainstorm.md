# Brainstorm: 搜索框与 Session 一致性修复

**日期：** 2026-03-20
**状态：** 已完成，可进入规划

---

## 我们要解决什么

当前搜索框（`SearchBar` 组件）在 Session 之间切换时行为不一致：
- 新建 Session → 中间有搜索框（因为组件刚挂载，`isSubmitted` 默认 `false`）
- 切换到已有 Session（哪怕画布为空）→ 搜索框消失

**根本原因：** `isSubmitted` 是组件本地状态，不随 Session 切换而重置。`BrainstormCanvas` 组件始终挂载，不重载。

---

## 派对模式讨论记录

**参与专家：** 姚晓明 (UX)、陈建国 (Arch)、李思远 (PM)

### 陈建国：根本原因分析

`search-bar.tsx:10` 的 `const [isSubmitted, setIsSubmitted] = useState(false)` 是组件本地状态。`isSubmitted` 一旦为 `true`，切换任何 session 都不会重置。

**正确信号已存在**：canvas store 的 `nodes.length === 0` 就是「是否该显示搜索框」的真实派生状态。

### 姚晓明：定位问题

`search-bar.tsx:31` 使用 `fixed` 定位（相对视口），而不是 `absolute`（相对画布容器）。侧边栏宽度变化会导致搜索框位置偏移。`brainstorm-canvas.tsx:59` 的外层容器已经是 `relative`，天然支持 `absolute` 子定位。

### 李思远：扩展需求识别

1. **删光所有节点后**：画布变空，搜索框应自动重新出现（派生方案天然支持）
2. **Session 标题**：`session-store.ts:55` 硬编码 `'New chat'`，`searchIdea` 完全没有更新 session 标题的逻辑——左边列表里全是「New chat」
3. **已有画布的 session 如何重新搜索**：无入口，用户被「锁住」

---

## 识别出的问题清单

| # | 问题 | 根本原因 |
|---|------|----------|
| 1 | 切换 session 后搜索框不出现 | `isSubmitted` 是本地状态，不随 session 重置 |
| 2 | 搜索框在侧边栏改变时偏移 | `fixed` 定位不跟随画布容器 |
| 3 | 删光节点后搜索框行为未定义 | 无状态驱动逻辑 |
| 4 | 有内容的 session 无法重新搜索 | 没有「重新探索」入口 |
| 5 | Session 标题一直是「New chat」 | `searchIdea` 没有更新 session 标题 |

---

## 选定方案

### 方案 A：核心修复 — 可见性派生自 canvas 状态

**目标：** 去掉 `SearchBar` 的 `isSubmitted` 本地状态，改为从 canvas store 派生。

```tsx
// search-bar.tsx
const nodes = useCanvasStore((s) => s.nodes)
const isEmpty = nodes.length === 0
// 用 isEmpty 替换 !isSubmitted 的条件渲染
```

**效果：**
- 切换到空画布 session → 搜索框自动出现
- 切换到有节点 session → 搜索框自动隐藏
- 删光所有节点 → 搜索框自动重新出现（免费）

---

### 方案 B：定位修复 — fixed → absolute

**目标：** 搜索框相对于画布容器定位，而非视口。

```tsx
// 把 className="fixed left-1/2 ..." 改为
className="absolute left-1/2 ..."
// style 里的 top: '18%' 保持不变，相对于画布容器
```

**前提：** `brainstorm-canvas.tsx` 外层 `<div className="relative h-full w-full">` 已是 `relative`，直接支持。

---

### 方案 C：重新探索入口 — 工具栏加按钮

**目标：** 在 `CanvasToolbar` 加「重新探索」按钮，允许用户在有内容的 session 中清空并重新搜索。

操作路径：
1. 工具栏点击「重新探索」→ 弹确认（防误触）→ 调 `clearCanvas()` → 搜索框自动出现（方案 A 天然支持）

**注意：** 清空前需保存快照或提示用户，避免误操作丢失画布。

---

### 方案 D：Session 标题自动更新

**目标：** 搜索成功后，自动把当前 session 标题更新为搜索词（前 20 字符）。

**实现：** `canvas-store.ts` 的 `searchIdea` 成功后，调用 `useSessionStore.getState()` 更新 title。现有代码有先例（`session-store.ts:26` 反向读 canvas store）。

```ts
// canvas-store.ts searchIdea 成功回调中：
const { activeSessionId } = useSessionStore.getState()
useSessionStore.setState((s) => ({
  sessions: s.sessions.map((sess) =>
    sess.id === activeSessionId
      ? { ...sess, title: idea.slice(0, 20) }
      : sess
  ),
}))
```

---

## 关键决策

1. **可见性信号**：用 `nodes.length === 0` 而非 `isSubmitted`，让 SearchBar 成为纯派生视图
2. **定位**：`absolute` 而非 `fixed`，绑定到画布容器
3. **重置入口**：通过 `clearCanvas()` 间接触发搜索框重现，不增加额外状态
4. **跨 store 通信**：canvas-store → session-store 单向通知，延续现有模式

---

## 开放问题（规划时确认）

- [ ] 「重新探索」按钮是否需要确认对话框？（防止误清空）
- [ ] Session 标题超 20 字符时是否加省略号？
- [ ] 搜索框动画（`framer-motion`）在 `isEmpty` 切换时的 enter 动画如何触发？（`AnimatePresence` 需要 key 或条件更新）

---

## 影响范围

| 文件 | 改动类型 |
|------|----------|
| `src/canvas/search-bar.tsx` | 去 `isSubmitted` 状态，改派生逻辑；`fixed` → `absolute` |
| `src/canvas/canvas-toolbar.tsx` | 加「重新探索」按钮 |
| `src/canvas/store/canvas-store.ts` | `searchIdea` 成功后更新 session 标题 |

---

*此 brainstorm 可直接进入 `/workflows:plan` 规划阶段。*
