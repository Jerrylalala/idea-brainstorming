# Session 右键菜单 & UX 全面补全 — Brainstorm

**日期**：2026-03-20
**参与**：派对模式（王建国·PM / 张晓峰·Dev / 林悦·UX / 陈思琪·分析师）
**状态**：✅ 已完成讨论，可进入计划阶段

---

## 背景

参考三星 AI 工具（截图）的 session 右键菜单（12 项功能），对比我们的应用：

- 右键菜单：**完全没有**
- Session store actions：仅 4 个（setActiveSessionId / setFilter / createSession / updateSessionTitle）
- 没有 deleteSession / archiveSession / duplicateSession
- `SessionGroup` 是静态存储字段，不是动态计算
- 存在数个静默 bug（见下文）

---

## 一、参考功能对照分析

| 三星截图功能 | 我们的判断 | 理由 |
|---|---|---|
| **Delete** | ✅ P0 必做 | 基本生存线，缺失不可接受 |
| **Rename** | ✅ P0 必做 | store action 已有，缺入口 |
| **Archive** | ✅ P0 必做 | `archived` status 已有，缺 action |
| **Status 子菜单** | ✅ P0 必做 | 工作流核心闭环，左侧筛选已有 |
| **Regenerate Title** | 🔵 P2 以后 | 依赖 AI 接口，基础设施未就绪 |
| **Labels 子菜单** | 🔵 P2 以后 | 先把 Status 做好，YAGNI |
| **Flag** | 🔵 P2 以后 | 需求待验证 |
| **Share** | ❌ 不适合 | 无后端、无用户系统 |
| **Open in New Panel / Window** | ❌ 不适合 | 多窗口布局是架构级大改 |
| **Show in Explorer / Copy Path** | ❌ 不适合 | 纯前端内存存储，无文件系统 |

**补充（截图没有但明显缺失）：**

| 功能 | 优先级 | 理由 |
|---|---|---|
| Duplicate session | 🔵 P1 | 「复用上次画布结构」是常见诉求 |
| 搜索框 | 🔵 P1 | session 积累后的定位刚需 |
| 键盘快捷键 | 🔵 P1 | 效率用户标配 |
| 时间分组细化 | 🔵 P1 | 当前 TODAY/YESTERDAY 不够 |

---

## 二、右键菜单终版结构

```
右键菜单
├── Rename
├── ─────────────
├── Status ▶       (子菜单: Backlog / Todo / Needs Review / Done)
├── Archive
├── ─────────────
└── Delete         (红色危险色)
```

**6 项，有分隔层次，不再增加。** 超过 6 项即设计失败。

**技术实现**：shadcn/ui `ContextMenu`（基于 Radix UI），`npx shadcn-ui@latest add context-menu`，零造轮子。

**两个入口（相同内容）：**
1. 行上右键（`onContextMenu`）
2. hover 时显示的 `...` 按钮（`onClick`）—— 当前 `MoreHorizontal` 图标补充事件即可

---

## 三、已发现的静默 Bug（必须同期修复）

### Bug 1：`isActive` 僵尸字段

```ts
// SessionItem.isActive 永不更新，activeSessionId 是唯一真相
// 新增操作若依赖 session.isActive 会直接出 bug
```

**修复**：删除 `SessionItem.isActive` 字段，初始化逻辑改为 `sessions[0].id`。

### Bug 2：Archived session 混在主列表

```ts
// s5 status: 'archived' 却显示在 All Sessions 里
// 左侧已有 Archived 独立筛选项，设计意图是「归档 = 从主列表隐藏」
```

**修复**：`All Sessions` 视图默认过滤掉 `archived`，仅 `Archived` 筛选激活时显示。

### Bug 3：删除当前激活 Session 无 fallback

```ts
// deleteSession(activeSessionId) 后 activeSessionId 指向不存在的 session
// 画布状态 undefined
```

**修复**：删除 active session 时，自动激活列表中下一个（若无则上一个），空列表则 `activeSessionId: null` + 清空画布。

### Bug 4：`SessionGroup` 静态存储，不随时间更新

```ts
// createSession() 写死 group: 'TODAY'
// 明天这个 session 仍显示在 TODAY 分组
```

**修复**：见下文「时间分组细化」方案。

---

## 四、时间分组细化

### 根本问题

`SessionGroup` 字段存储在数据里（静态），应改为从 `createdAt` 动态计算。

### 数据结构变更

```ts
// src/types/session.ts
export interface SessionItem {
  id: string
  title: string
  createdAt: string     // 新增：ISO 8601，如 "2026-03-20T14:30:00Z"
  time: string          // 保留：展示字符串，由 createdAt 格式化
  // group 字段删除 ← 改为动态计算，不存储
  status?: SessionStatus
  canvasSnapshot?: CanvasSnapshot
  // isActive 字段删除（Bug 1 修复）
}
```

### 分组计算规则

```
getSessionGroup(createdAt: string): string

今天          → 'TODAY'
昨天          → 'YESTERDAY'
2-6 天前      → 'THIS WEEK'
7-13 天前     → 'LAST WEEK'
14天-本月底   → 'THIS MONTH'
更早          → 'MARCH 2026' / 'FEBRUARY 2026'（绝对月份，不用相对时间）
```

### 可折叠分组

`useUIStore` 增加 `collapsedGroups: Set<string>`，点击分组标题 toggle 折叠。

---

## 五、搜索框

### 设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 位置 | 默认隐藏，`Ctrl+K` 或点搜索图标展开 | 界面不大，节省空间优先 |
| 搜索范围 | 仅搜 session 标题 | 够用；搜 canvas 内容是 P2 |
| 与 Status Filter 关系 | AND 逻辑（两个条件同时生效）| 用户直觉 |
| 状态存放 | `useUIStore.searchQuery: string` | 纯 UI 状态，不需要持久化 |
| 结果高亮 | 匹配字符高亮显示 | 标准搜索体验 |

### 交互流程

```
Ctrl+K → 搜索框展开并聚焦
输入关键词 → 实时过滤（AND Status Filter）
无结果 → Empty State: "没有匹配 '{query}' 的会话"
Esc → 清空搜索并收起
```

---

## 六、键盘快捷键

### 核心设计：双焦点系统

引入 `focusedSessionId`（键盘光标位置），与 `activeSessionId`（当前打开的画布）**分离**：

| 字段 | 含义 | 变更触发 |
|---|---|---|
| `activeSessionId` | 当前显示在画布的 session | 点击 / Enter 键 |
| `focusedSessionId` | 键盘操作的目标 session | ↑↓ 键 / 鼠标 hover |

**原因**：若两者合一，用 ↑↓ 导航列表时画布会频繁切换，体验极差。

### 焦点冲突解决方案

键盘事件只在 **SessionListPane 容器的 `onKeyDown`** 上处理，不做全局监听：

- 当焦点在 Session 列表区域 → 列表快捷键生效
- 当焦点在 Canvas 区域 → ReactFlow 处理（Delete 删节点，不删 session）
- 当焦点在 `<input>`（重命名中）→ Esc 取消编辑

### 完整键位表

| 按键 | 前提 | 动作 |
|---|---|---|
| `↑` / `↓` | 焦点在列表 | 移动 `focusedSessionId` |
| `Enter` | 有 focused session | 激活 session（切换画布）|
| `F2` | 有 focused session | 进入 inline rename |
| `Delete` | 有 focused session | 触发删除（Undo Toast）|
| `Esc` | 任何状态 | 取消编辑 / 关闭菜单 / 清空搜索 |
| `Ctrl+K` | 任何状态 | 聚焦搜索框 |

---

## 七、配套 UX 机制

### 删除 Undo Toast（软删除）

```
触发删除
  ↓
视觉上立即从列表移除（软删除）
  ↓
Toast: "已删除「{title}」" + [撤销] 按钮（5秒）
  ↓
5秒内点撤销 → 恢复
5秒后 → 真正从 store 清除
```

**Store 设计**：需要 `pendingDeletion: { session, timer }` 暂存区。

### Status 变更后消失的 Toast

场景：在 `Todo` 过滤视图下，将 session 改为 `Done` → session 从列表消失。

```
Toast: "已移至 Done" + [查看 Done] 链接
```

### Rename 防御性设计

- 空标题 → 恢复原标题 + 输入框轻微抖动动画
- `Enter` 确认 / `Esc` 取消
- 触发方式：右键菜单 Rename / `...` 按钮 / `F2` 键 / **双击 session 标题**

### Empty State

| 场景 | 展示内容 |
|---|---|
| 首次进入（无 session）| "开始你的第一个想法" + 新建按钮 |
| 过滤后无结果 | "没有 {filter} 状态的会话" |
| 搜索无结果 | "没有匹配 '{query}' 的会话" + 清除按钮 |

---

## 八、Store 变更汇总

### `useSessionStore` 新增 actions

```ts
deleteSession(id: string): void          // 软删除 → Undo Toast
confirmDelete(id: string): void          // Toast 超时后真正删除
restoreSession(id: string): void         // 撤销删除
archiveSession(id: string): void         // status → 'archived'
setSessionStatus(id: string, status: SessionStatus): void
duplicateSession(id: string): void       // P1
```

### `useUIStore` 新增字段

```ts
focusedSessionId: string | null          // 键盘光标
searchQuery: string                      // 搜索关键词
isSearchVisible: boolean                 // 搜索框展开状态
collapsedGroups: Set<string>             // 折叠的分组
pendingDeletion: PendingDeletion | null  // 软删除暂存
```

---

## 九、优先级计划

### P0：本次 PR（右键菜单 + Bug 修复）

- [ ] 修复 `isActive` 僵尸字段
- [ ] 修复 archived session 混主列表
- [ ] 修复删除 active session 无 fallback
- [ ] 添加 `deleteSession` + `archiveSession` + `setSessionStatus` actions
- [ ] 实现右键菜单（shadcn ContextMenu，6项结构）
- [ ] 实现 `...` hover 按钮（同菜单）
- [ ] 实现 Rename inline edit（双击 / F2 / 菜单）
- [ ] Undo Toast（软删除机制）
- [ ] Empty State（3种场景）
- [ ] Status 变更后消失 Toast

### P1：下一 PR（分组 + 搜索 + 键盘）

- [ ] 修复 `SessionGroup` 静态存储（加 `createdAt`，改为动态计算）
- [ ] 时间分组细化（6档分组规则）
- [ ] 可折叠分组
- [ ] 搜索框（Ctrl+K，AND 逻辑，标题高亮）
- [ ] 双焦点系统（`focusedSessionId`）
- [ ] 键盘快捷键（↑↓ / Enter / F2 / Delete / Esc / Ctrl+K）
- [ ] `duplicateSession`

### P2：后续迭代

- [ ] Regenerate Title（需 AI 接口）
- [ ] Labels 子菜单
- [ ] 批量操作（多选 + 批量删/归档）
- [ ] 搜索范围扩展到 canvas 内容

---

## 十、关键设计原则（共识）

1. **右键菜单最多 6 项**，超过即设计失败
2. **删除用 Undo Toast**，不用确认弹窗（现代范式）
3. **`focusedSessionId` 与 `activeSessionId` 必须分离**，防止键盘导航切换画布
4. **Archived session 默认从主列表隐藏**
5. **`SessionGroup` 不存储，动态计算**
6. **所有操作立即反馈**（Toast / 动画 / 视觉变化）
