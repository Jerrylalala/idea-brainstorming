---
status: pending
priority: p3
issue_id: "045"
tags: [code-review, security, prompt-injection]
dependencies: []
---

# buildDirectionPrompt 直接插值用户输入，存在提示注入面

## Problem Statement

`src/canvas/lib/prompt-builder.ts` 中，用户控制的字段（`input.idea`、`parentContext.userOpinion`、`parentContext.parentTitle` 等）直接插值到 prompt 字符串中，无任何转义。用户可以注入指令破坏 prompt 结构，操纵 AI 输出。

当前为单用户工具，影响仅限用户自身（self-harm）。若未来变为多租户，升级为 P1。

## Findings

- `src/canvas/lib/prompt-builder.ts:39-62`：用户字段直接 `${input.idea}` 插值
- `parseDirectionsJSON` 的 `.slice(0, 20)` 限制了下游损害
- Security Sentinel 发现此问题

## Proposed Solutions

### Option 1: 添加输入长度限制（推荐，最小改动）

**Approach:**

```typescript
function sanitizeInput(s: string, maxLen = 500): string {
  return s.slice(0, maxLen).replace(/[\x00-\x1f]/g, ' ')
}
```

在 `buildDirectionPrompt` 入口处对所有用户字段调用 `sanitizeInput`。

**Pros:** 限制注入长度，移除控制字符
**Cons:** 不能完全防止语义注入
**Effort:** 15 分钟
**Risk:** Low

---

### Option 2: 使用结构化消息格式（更彻底）

**Approach:** 将用户输入放入独立的 `user` 消息，系统指令放入 `system` 消息，利用 API 的角色分离防止注入。

**Pros:** 结构上隔离用户输入和系统指令
**Cons:** 需要重构 prompt 构建逻辑
**Effort:** 1 小时
**Risk:** Low

## Recommended Action

Option 1 作为快速修复，Option 2 作为后续改进。

## Technical Details

**Affected files:**
- `src/canvas/lib/prompt-builder.ts` — 所有用户字段插值处

## Acceptance Criteria

- [ ] 用户输入有最大长度限制
- [ ] 控制字符被过滤

## Work Log

### 2026-03-19 - Security Audit Discovery

**By:** Claude Code (Security Sentinel background agent)
