---
status: pending
priority: p3
issue_id: "053"
tags: [code-review, unicode, i18n, search-bar]
dependencies: [047]
---

# session 标题截断可能切断 Unicode surrogate pair

## Problem Statement

`search-bar.tsx` 中使用 `String.slice(0, 20)` 截断 session 标题，但 JavaScript 的 `String.slice` 以 UTF-16 code unit 为单位操作，可能在 Emoji 或某些 CJK 扩展字符的 surrogate pair 中间截断，产生乱码字符。

## Findings

- `src/canvas/search-bar.tsx:122-123`：
  ```tsx
  const raw = value.trim()
  const title = raw.length > 20 ? raw.slice(0, 20) + '...' : raw
  ```
- JavaScript `String.length` 和 `String.slice` 以 UTF-16 code unit 为单位
- Emoji（如 🎯）占 2 个 code unit（surrogate pair）
- `'🎯abc'.slice(0, 1)` 返回 `'\uD83C'`（半个 surrogate），显示为乱码
- 对于纯中文/英文输入（本应用主要场景），此问题概率极低
- 但用户若在标题中使用 Emoji，可能产生问题

## Proposed Solutions

### Option 1: 使用 Array.from 或 Intl.Segmenter 截断

**Approach:** 将字符串转为字符数组（以 Unicode code point 为单位）后截断：

```tsx
const raw = value.trim()
const chars = Array.from(raw)
const title = chars.length > 20
  ? chars.slice(0, 20).join('') + '...'
  : raw
```

**Pros:**
- 正确处理 surrogate pair
- 零额外依赖

**Cons:**
- 轻微性能开销（创建数组），对短字符串可忽略

**Effort:** 5 分钟

**Risk:** Low

---

### Option 2: 保持 String.slice（当前做法）

**Approach:** 不修改，接受极低概率的 Emoji 截断 bug。

**Pros:**
- 零改动

**Cons:**
- 边缘 case 可能产生乱码

**Effort:** 0

**Risk:** Low

## Recommended Action

P3 级别，可选做。结合 P1 修复（047）一起实现成本最低。

## Technical Details

**Affected files:**
- `src/canvas/search-bar.tsx:122-123` — 标题截断逻辑

## Acceptance Criteria

- [ ] 输入包含 Emoji 的标题（如「🎯我想开发一款营销软件」），截断后不出现乱码
- [ ] 纯中文/英文截断行为不变

## Work Log

### 2026-03-20 - Code Review 发现

**By:** Claude Code（security-sentinel，Unicode 边缘 case）
