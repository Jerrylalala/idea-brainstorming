---
status: pending
priority: p1
issue_id: "041"
tags: [code-review, security, secrets]
dependencies: []
---

# VITE_ 前缀 API Key 被打包进前端 JS bundle，任何人可提取

## Problem Statement

`.env.local` 中的 `VITE_AI_API_KEY`、`VITE_ANTHROPIC_API_KEY` 等变量以 `VITE_` 为前缀，Vite 在构建时会将其内联到 JS bundle 中。任何能访问 `dist/` 目录或加载应用的人，都可以通过 DevTools 或 `strings` 命令提取这些 API Key。

## Findings

- `src/canvas/lib/ai-config-store.ts`：`loadFromEnv()` 读取 `import.meta.env.VITE_AI_API_KEY` 等变量
- Vite 文档明确说明：`VITE_` 前缀变量会被内联到客户端 bundle
- 任何非 localhost 部署（如 Vercel、Netlify）都会将 Key 暴露给所有访问者
- Security Sentinel 发现此问题

## Proposed Solutions

### Option 1: 移除 VITE_ 前缀，改为服务端注入（推荐）

**Approach:**
1. 将 `.env.local` 中的 Key 改为无 `VITE_` 前缀（如 `AI_API_KEY`）
2. 在 `server/app.ts` 中读取 `process.env.AI_API_KEY`，作为服务端默认连接
3. 删除 `ai-config-store.ts` 中的 `loadFromEnv()` 函数
4. 如需前端展示默认连接，通过 `/api/connections/defaults` 端点返回（不含 Key）

**Pros:** Key 永远不进入 bundle
**Cons:** 需要服务端 API 支持默认连接
**Effort:** 1 小时
**Risk:** Medium

---

### Option 2: 仅用于本地开发，添加警告

**Approach:** 在 `loadFromEnv()` 中添加警告：
```typescript
if (import.meta.env.PROD) {
  console.warn('[security] VITE_ API keys are exposed in production bundle!')
}
```

**Pros:** 零改动
**Cons:** 未解决问题，只是警告
**Effort:** 5 分钟
**Risk:** High（生产环境仍暴露）

## Recommended Action

Option 1（生产部署时必须）。本地开发工具可暂时保留 Option 2 作为过渡。

## Technical Details

**Affected files:**
- `.env.local` — 移除 `VITE_` 前缀
- `src/canvas/lib/ai-config-store.ts` — 删除 `loadFromEnv()`
- `server/app.ts` — 读取 `process.env` 作为服务端默认

## Acceptance Criteria

- [ ] 构建产物中不包含 API Key 字符串
- [ ] `strings dist/assets/*.js | grep -i "sk-"` 无结果
- [ ] 本地开发仍可通过 UI 手动添加连接

## Work Log

### 2026-03-19 - Security Audit Discovery

**By:** Claude Code (Security Sentinel background agent)
