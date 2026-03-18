---
name: left-nav-pane 通过魔法字符串匹配 Settings 触发 modal
description: group.title === 'Settings' 字符串硬耦合，mock-nav-groups.ts 改名即静默失效
type: quality
status: pending
priority: p3
issue_id: "024"
tags: [code-review, architecture, nav, coupling]
---

## Problem Statement

```typescript
// left-nav-pane.tsx
onClick={group.title === 'Settings' ? () => setSettingsOpen(true) : undefined}
```

`LeftNavPane` 组件通过比较 `group.title === 'Settings'` 字符串来决定点击行为。`Settings` 这个字符串定义在 `mock-nav-groups.ts` 中，两处没有共享常量，任何改名都会静默失效。

## Proposed Solutions

### 方案 A（推荐）：给 NavGroup 添加 action 字段

```typescript
// 在 NavGroup 类型中添加
interface NavGroup {
  title: string
  items: NavItem[]
  action?: () => void  // 可选的点击回调
}

// mock-nav-groups.ts 中
// Settings 组不再在这里定义，或者定义时不带 action

// left-nav-pane.tsx - 通过闭包注入 action
const navGroups = [
  ...mockNavGroups,
  {
    title: 'Settings',
    items: [],
    action: () => setSettingsOpen(true),
  }
]
```

### 方案 B（最小改动）：使用常量

```typescript
// constants.ts
export const SETTINGS_NAV_TITLE = 'Settings'

// 两处引用同一常量
```

## Acceptance Criteria

- [ ] 修改 Settings 的导航标题不会破坏 modal 触发
- [ ] 不存在字符串硬编码耦合

## Work Log

- 2026-03-18: 代码审查发现，由 architecture-strategist agent 标记为 P3-A
