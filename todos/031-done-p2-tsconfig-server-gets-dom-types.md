---
status: pending
priority: p2
issue_id: "031"
tags: [code-review, architecture, typescript]
dependencies: []
---

# tsconfig.json 共享导致 server 代码获得 DOM 类型

## Problem Statement

`tsconfig.json` 将 `include` 扩展为 `["src", "server"]`，但 `lib` 仍包含 `"DOM"`。这意味着服务端代码（Hono/Node.js）可以使用 `window`、`document`、`localStorage` 等浏览器 API 而不报错，掩盖了潜在的运行时错误。正确做法是为 server 提供独立的 tsconfig，只包含 Node.js 类型。

## Findings

- `tsconfig.json:4`：`"lib": ["ES2021", "DOM", "DOM.Iterable"]`
- `tsconfig.json:20`：`"include": ["src", "server"]`
- 服务端代码在 TypeScript 层面可以调用 `localStorage.getItem()` 而不报错
- 如果 server 代码意外引入了浏览器依赖，编译器不会警告
- Architecture Strategist 发现此问题

## Proposed Solutions

### Option 1: 为 server 创建独立 tsconfig（推荐）

**Approach:**

```json
// tsconfig.server.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2021"],
    "types": ["node"]
  },
  "include": ["server"]
}

// tsconfig.json（恢复原始）
{
  "compilerOptions": {
    "lib": ["ES2021", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

同时更新 `vite.config.ts` 和 `package.json` 中的 server 构建命令使用 `tsconfig.server.json`。

**Pros:** 类型隔离，服务端代码不能意外使用浏览器 API
**Cons:** 需要维护两个 tsconfig
**Effort:** 30 分钟
**Risk:** Low

---

### Option 2: 使用 `skipLibCheck` + 注释说明

**Approach:** 保持现状，在 tsconfig 中添加注释说明这是已知的权衡。

**Pros:** 零改动
**Cons:** 未解决问题，类型安全性降低
**Effort:** 5 分钟
**Risk:** Low（短期）

## Recommended Action

Option 1，为 server 创建独立 tsconfig。

## Technical Details

**Affected files:**
- `tsconfig.json` — 恢复 `include: ["src"]`
- `tsconfig.server.json` — 新建，server 专用
- `vite.config.ts` — 更新 server 构建使用新 tsconfig
- `package.json` — 更新 tsc 命令

## Acceptance Criteria

- [ ] `server/` 代码使用独立 tsconfig，不包含 DOM 类型
- [ ] `src/` 代码仍有 DOM 类型
- [ ] 两个 tsconfig 均编译通过

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Architecture Strategist)
