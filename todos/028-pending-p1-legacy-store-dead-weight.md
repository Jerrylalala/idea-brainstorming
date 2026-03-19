---
status: pending
priority: p1
issue_id: "028"
tags: [code-review, simplicity, dead-code]
dependencies: []
---

# useAIConfigStore（legacy store）是死代码，需要确认消费方并清理

## Problem Statement

`ai-config-store.ts` 中存在两个并行的 Zustand store：`useAIConfigStore`（legacy）和 `useAIConnectionStore`（新）。`ai-settings-modal.tsx` 只使用新 store，但 `ai-client.ts` 可能仍在读取旧 store 的 `.client`。如果两条路径都在运行，存在两个独立 AIClient 实例，状态不一致。

## Findings

- `src/canvas/lib/ai-config-store.ts:285-319`：`useAIConfigStore` 完整实现（~35 行）
- `src/components/ai-settings-modal.tsx`：只导入 `useAIConnectionStore`，不再使用旧 store
- Code Simplicity Reviewer 发现 `ai-client.ts` 可能仍读取旧 store
- 旧 store 相关的可删除代码约 126 行（`buildClient`, `toAIConfig`, `loadConfigs`, `loadFromEnv`, `AIConfig`, `ProviderConfig`, `ConfigsMap`, `STORAGE_KEY_CONFIGS`, `STORAGE_KEY_ACTIVE`）
- `PROVIDER_MODELS`（55 行）也无任何消费方，可同时删除

## Proposed Solutions

### Option 1: 确认消费方后删除 legacy store（推荐）

**Approach:**
1. 检查 `ai-client.ts` 和所有其他文件，确认是否还有代码读取 `useAIConfigStore`
2. 如果 `ai-client.ts` 读取旧 store，改为读取 `useAIConnectionStore.getState().client`
3. 删除 `useAIConfigStore` 及其所有依赖代码
4. 同时删除 `PROVIDER_MODELS`（零消费方）

**Pros:** 消除 ~180 行死代码，消除双 store 状态不一致风险
**Cons:** 需要先确认所有消费方
**Effort:** 1-2 小时
**Risk:** Medium（需要确认无遗漏消费方）

---

### Option 2: 保留 legacy store，仅标注为 deprecated

**Approach:** 添加 `@deprecated` 注释，下个 PR 再清理。

**Pros:** 风险最低
**Cons:** 技术债继续累积
**Effort:** 5 分钟
**Risk:** Low

## Recommended Action

Option 1。先用 grep 确认所有 `useAIConfigStore` 的消费方，再统一清理。

## Technical Details

**Affected files:**
- `src/canvas/lib/ai-config-store.ts` — 删除 legacy store 相关代码（约 180 行）
- `src/canvas/lib/ai-client.ts` — 可能需要切换到新 store

**需要 grep 确认的消费方：**
```bash
grep -r "useAIConfigStore\|buildClient\|AIConfig\b" src/ --include="*.ts" --include="*.tsx"
```

## Acceptance Criteria

- [ ] 确认所有 `useAIConfigStore` 消费方已迁移到 `useAIConnectionStore`
- [ ] 删除 legacy store 及其依赖代码
- [ ] 删除 `PROVIDER_MODELS`
- [ ] TypeScript 编译通过，无未使用导入警告

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Code Simplicity Reviewer, Architecture Strategist)
