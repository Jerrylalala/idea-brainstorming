---
name: SearchBar 错误无法恢复
description: AI 请求失败后 isSubmitted=true 永久保持，搜索框消失，用户无法重试
type: bug
status: pending
priority: p1
issue_id: "002"
tags: [code-review, ux, error-handling]
---

## Problem Statement

`SearchBar` 组件在提交后立即设置 `isSubmitted=true` 使搜索框消失。但 `searchIdea` 内部 catch 了所有错误且不重新抛出，导致 `handleSubmit` 的 `await` 永远正常 resolve，`isSubmitted` 永远保持 `true`。AI 请求失败后，用户看到空画布，没有错误提示，无法重新搜索，只能刷新页面。

**Why:** 核心功能的错误路径完全不可用，用户体验极差。

**How to apply:** 所有 async 操作都需要错误状态管理和恢复路径。

## Findings

**位置：** `src/canvas/search-bar.tsx` + `src/canvas/store/canvas-store.ts`

**失败路径：**
```typescript
// search-bar.tsx
const handleSubmit = async () => {
  setIsSubmitted(true)      // ← 搜索框立即消失
  await searchIdea(value.trim())
  // searchIdea 内部 catch 了所有错误，不重新抛出
  // 所以这里永远不会有 catch，isSubmitted 永远是 true
}

// canvas-store.ts - searchIdea catch 块
} catch {
  set((s) => ({ nodes: s.nodes.map(...) }))  // 只恢复节点状态
  // 没有 throw err！
}
```

## Proposed Solutions

### 方案 A：双端修复（推荐）

**Step 1 - store 重新抛出错误：**
```typescript
} catch (err) {
  set((s) => ({
    nodes: s.nodes.map(n =>
      n.id === ideaNode.id ? { ...n, data: { ...n.data, status: 'idle' as const } } : n
    ) as CanvasNode[],
  }))
  throw err  // ← 让调用方感知
}
```

**Step 2 - SearchBar 处理错误：**
```typescript
export function SearchBar() {
  const [value, setValue] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchIdea = useCanvasStore((s) => s.searchIdea)

  const handleSubmit = async () => {
    if (!value.trim()) return
    setIsSubmitted(true)
    setError(null)
    try {
      await searchIdea(value.trim())
    } catch {
      setIsSubmitted(false)  // 恢复搜索框
      setError('探索失败，请重试')
    }
  }
  // 在 UI 中显示 error
}
```

**优点：** 完整的错误恢复，用户体验好
**风险：** 低

### 方案 B：仅在 SearchBar 层处理

不修改 store，在 SearchBar 中订阅 store 的 ideaNode 状态来判断是否失败。

**缺点：** 需要额外的状态订阅，逻辑复杂，不推荐。

## Recommended Action

方案 A。

## Technical Details

- **受影响文件：** `src/canvas/search-bar.tsx`, `src/canvas/store/canvas-store.ts`
- **关联 issue：** 001（searchIdea 竞态条件，同样需要 throw err）

## Acceptance Criteria

- [ ] AI 请求失败后，搜索框重新出现
- [ ] 显示友好的错误提示
- [ ] 用户可以修改输入后重新提交

## Work Log

- 2026-03-18: 代码审查发现，由 review 流程创建
