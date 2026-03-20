---
status: pending
priority: p3
issue_id: "051"
tags: [code-review, performance, react, search-bar]
dependencies: [047]
---

# search-bar：handleSubmit 应包裹 useCallback

## Problem Statement

`SearchBar` 组件中的 `handleSubmit` 函数在每次 render 时都会重新创建，传递给 `<Button onClick={handleSubmit}>` 和 `<Input onKeyDown>` 会导致不必要的子组件重渲染。虽然当前影响较小，但加上 `useCallback` 是 React 最佳实践。

## Findings

- `src/canvas/search-bar.tsx:115`：
  ```tsx
  const handleSubmit = async () => {  // ← 每次 render 新引用
    if (!value.trim()) return
    // ...
  }
  ```
- `handleSubmit` 依赖：`value`, `searchIdea`, `activeSessionId`, `updateSessionTitle`, `setError`（setState 稳定）
- 在实现 P1 修复（justFailedRef）后，依赖列表为：`[value, searchIdea, activeSessionId, updateSessionTitle]`

## Proposed Solutions

### Option 1: 包裹 useCallback（推荐）

```tsx
const handleSubmit = useCallback(async () => {
  if (!value.trim()) return
  setError(null)
  const sessionIdSnapshot = activeSessionId
  try {
    await searchIdea(value.trim())
    if (sessionIdSnapshot) {
      const raw = value.trim()
      const title = raw.length > 20 ? raw.slice(0, 20) + '...' : raw
      updateSessionTitle(sessionIdSnapshot, title)
    }
  } catch {
    justFailedRef.current = true
    setError('探索失败，请重试')
  }
}, [value, searchIdea, activeSessionId, updateSessionTitle])
```

**Pros:**
- 标准 React 最佳实践
- 防止 Button/Input 不必要重渲染

**Cons:**
- 增加少量代码

**Effort:** 5 分钟

**Risk:** Low

## Recommended Action

结合 P1 fix（047）一起实现，顺便加上 useCallback。

## Technical Details

**Affected files:**
- `src/canvas/search-bar.tsx:115` — handleSubmit

## Acceptance Criteria

- [ ] handleSubmit 使用 useCallback 包裹，依赖数组正确
- [ ] `pnpm tsc --noEmit` 无报错

## Work Log

### 2026-03-20 - Code Review 发现

**By:** Claude Code（TypeScript quality reviewer）
