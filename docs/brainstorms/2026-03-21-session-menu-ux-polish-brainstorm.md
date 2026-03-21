---
title: "Session 菜单 UX 打磨 — 触发方式 / 位置 / 状态颜色"
date: 2026-03-21
type: ux-polish
status: ready-for-plan
participants: [李明远（架构师）, 张晓峰（开发者）, 苏雨菲（UI/UX）]
reference: Craft Agents（对标软件截图）
---

# Session 菜单 UX 打磨

## 背景

PR #11 完成了基础右键菜单，用户对比 Craft Agents 发现三处不足，同时在讨论中识别出第四处隐藏问题。

---

## 问题清单

### 问题 1：`...` 按钮无法点击
当前 `MoreHorizontal` 只是图标，无点击事件。用户期望点击 `...` 也能打开同一个菜单。

### 问题 2：菜单位置跟随鼠标，可能飘入画布区
Radix `ContextMenu` 跟随右键位置出现，没有固定锚点，体验不确定。

### 问题 3：Status 选项无颜色标识
当前 Status 子菜单只有文字 + ✓，无彩色圆圈区分语义。

### 问题 4（派对模式识别）：Session 行圆圈永远灰色
每行左侧的 `<Circle>` 图标不反映当前 session 的 status 颜色，与 Craft Agents 有明显差距。

---

## 方案决策

### 触发方式：双轨触发，共享内容

```
右键 Session 行  →  ContextMenu（保留，跟随鼠标）
点击 ... 按钮    →  DropdownMenu（新增，锚定到按钮）
                        ↓
              两者共享 SessionMenuItems 组件
```

**为什么不合并成一个？**
Radix `ContextMenu` 和 `DropdownMenu` 依赖各自独立的 Context，不能混用。双轨触发是官方推荐模式。

**关键细节：**
- `...` 按钮需要 `e.stopPropagation()`，防止触发 Session 行的 `onClick`（切换激活）
- 菜单内容用 `variant: 'context' | 'dropdown'` 区分，分别渲染对应的 Item 组件

### 菜单位置：DropdownMenu `side="bottom" align="end"`

```tsx
<DropdownMenuContent side="bottom" align="end" className="w-52">
```

锚定到 `...` 按钮正下方靠右，始终在侧边栏内，不会飘到画布区。

### Status 颜色：统一 `STATUS_CONFIG` + `StatusDot` 组件

| Status | 图标 | 颜色 |
|--------|------|------|
| Backlog | 空心圆 | 灰 `#94a3b8` |
| Todo | 空心圆 | 灰 `#94a3b8` |
| Needs Review | 实心圆 | 橙 `#f97316` |
| Done | 实心圆 | 紫 `#8b5cf6` |
| Archived | 灰色带横线 | 灰 `#94a3b8` |

`StatusDot` 组件三处复用：
1. Session 列表行左侧圆圈（替换当前灰色 `<Circle>`）
2. 左侧筛选栏（Backlog / Todo / Needs Review / Done / Archived）
3. 右键菜单 / DropdownMenu 中的 Status 子菜单选项

---

## 影响文件

| 文件 | 改动 |
|------|------|
| `src/components/session-context-menu.tsx` | 重构：提取 SessionMenuItems，支持双触发 |
| `src/components/session-list-pane.tsx` | `...` 换成 DropdownMenu；行圆圈换 StatusDot；筛选栏加 StatusDot |
| `src/lib/session-utils.ts` 或新文件 | 新增 STATUS_CONFIG + StatusDot |
| `src/components/ui/dropdown-menu.tsx` | 需要安装（`npx shadcn@latest add dropdown-menu`） |

---

## Open Questions（已关闭）

- ✅ 是否保留右键？→ 保留，双轨触发
- ✅ 菜单内容是否完全一致？→ 是，共享 SessionMenuItems
- ✅ StatusDot 放哪里？→ `src/lib/session-utils.ts` 或新建 `src/components/ui/status-dot.tsx`
