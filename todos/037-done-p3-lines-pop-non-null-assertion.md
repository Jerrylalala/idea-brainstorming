---
status: pending
priority: p3
issue_id: "037"
tags: [code-review, simplicity, safety]
dependencies: []
---

# proxy-ai-client.ts 中 lines.pop()! 非空断言应改为 ?? ''

## Problem Statement

`src/canvas/lib/proxy-ai-client.ts` 中 NDJSON 流解析逻辑使用 `lines.pop()!` 非空断言操作符。虽然在当前逻辑下 `lines` 数组不会为空（因为 `split('\n')` 至少返回一个元素），但非空断言掩盖了潜在的边界情况，且违反了防御性编程原则。更安全的写法是 `lines.pop() ?? ''`。

## Findings

- `src/canvas/lib/proxy-ai-client.ts`：`const remainder = lines.pop()!`
- `String.split()` 在输入为空字符串时返回 `['']`，`pop()` 返回 `''`（非 undefined），所以 `!` 在此处实际上是安全的
- 但 `!` 操作符会在 strict TypeScript 审查中被标记，且降低代码可读性
- Code Simplicity Reviewer 发现此问题

## Proposed Solutions

### Option 1: 改为 ?? ''（推荐）

**Approach:**

```typescript
// 修改前
const remainder = lines.pop()!

// 修改后
const remainder = lines.pop() ?? ''
```

**Pros:** 消除非空断言，意图更明确
**Cons:** 无
**Effort:** 2 分钟
**Risk:** Low

## Recommended Action

Option 1，直接替换。

## Technical Details

**Affected files:**
- `src/canvas/lib/proxy-ai-client.ts` — `lines.pop()!` 所在行

## Acceptance Criteria

- [ ] `lines.pop()!` 替换为 `lines.pop() ?? ''`
- [ ] TypeScript 编译通过，无 `!` 非空断言警告

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Code Simplicity Reviewer)
