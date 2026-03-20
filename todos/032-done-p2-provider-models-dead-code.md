---
status: pending
priority: p2
issue_id: "032"
tags: [code-review, simplicity, dead-code]
dependencies: [028]
---

# PROVIDER_MODELS 常量（55 行）零消费方，是死代码

## Problem Statement

`ai-config-store.ts` 中定义了 `PROVIDER_MODELS` 常量（约 55 行），列出了各 provider 的可用模型列表。经 grep 确认，整个代码库中没有任何文件导入或使用此常量。这是纯死代码，增加维护负担，且与 `useAIConnectionStore` 的设计（用户自填 model 字段）不一致。

## Findings

- `src/canvas/lib/ai-config-store.ts`：`PROVIDER_MODELS` 完整定义（约 55 行）
- 全局 grep `PROVIDER_MODELS` 无任何消费方
- 新的 `Connection` 接口中 `model` 是用户自填字符串，不依赖预设列表
- `ai-settings-modal.tsx` 的 `AddConnectionForm` 中 model 是 `<input>` 自由输入
- Code Simplicity Reviewer 发现此问题

## Proposed Solutions

### Option 1: 直接删除（推荐）

**Approach:** 删除 `PROVIDER_MODELS` 常量定义。

**Pros:** 减少约 55 行死代码，消除维护负担
**Cons:** 无
**Effort:** 5 分钟
**Risk:** Low（需先 grep 确认无消费方）

---

### Option 2: 保留并在 UI 中使用（作为 model 输入的 datalist）

**Approach:** 在 `AddConnectionForm` 中将 `PROVIDER_MODELS` 作为 `<datalist>` 提供自动补全。

**Pros:** 提升 UX，用户不需要记忆 model 名称
**Cons:** 需要额外 UI 工作，且 model 列表会过时
**Effort:** 1-2 小时
**Risk:** Low

## Recommended Action

Option 1，先删除死代码。如果未来需要 model 自动补全，再按需添加。

## Technical Details

**Affected files:**
- `src/canvas/lib/ai-config-store.ts` — 删除 `PROVIDER_MODELS` 定义

**验证命令:**
```bash
grep -r "PROVIDER_MODELS" src/ --include="*.ts" --include="*.tsx"
```

## Acceptance Criteria

- [ ] `PROVIDER_MODELS` 从代码库中删除
- [ ] TypeScript 编译通过，无未使用导出警告

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Code Simplicity Reviewer)
