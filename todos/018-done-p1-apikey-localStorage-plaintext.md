---
name: API Key 明文存储在 localStorage
description: 整个 AIConfig（含 apiKey）被 JSON.stringify 写入 localStorage，可被 XSS 或扩展程序读取
type: security
status: pending
priority: p1
issue_id: "018"
tags: [code-review, security, localStorage, api-key]
---

## Problem Statement

`ai-config-store.ts` 将 `{ provider, baseURL, apiKey, model }` 完整序列化写入 `localStorage`。API Key 以明文存储，同源的任何 JS（包括 XSS 注入、npm 供应链、浏览器扩展）均可读取 `localStorage.getItem('ai_config')` 获取密钥。

**Why:** API Key 一旦泄漏，攻击者可以消耗用户的 AI quota 或访问敏感的 Anthropic 账户权限。

## Findings

**位置：** `src/canvas/lib/ai-config-store.ts` 第 73 行

```typescript
localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
// config = { provider, baseURL, apiKey, model }
// apiKey 明文写入
```

## Proposed Solutions

### 方案 A（推荐，UX 折中）：仅持久化非敏感字段，apiKey 只在内存

```typescript
setConfig: (config) => {
  const { apiKey: _, ...safeConfig } = config
  localStorage.setItem(STORAGE_KEY, JSON.stringify(safeConfig))
  set({ config, client: buildClient(config) })
},

// loadFromStorage 返回的 config 不含 apiKey，需用户在 modal 中重新输入
```

**优点：** 完全消除 localStorage 中的敏感数据，页面刷新后 provider/URL/model 自动填充，用户只需重输密钥。
**缺点：** 每次刷新页面需重新输入 API Key（对频繁使用者有轻微不便）。

### 方案 B（次选）：改用 sessionStorage

```typescript
sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config))
```

**优点：** 标签页关闭即清除，风险窗口缩短。
**缺点：** 仍在 JS 可访问的存储中，只是生命周期更短。

### 方案 C（最低限度）：保持当前行为，在 UI 添加安全提示

在 `AISettingsModal` 保存按钮旁添加：

```tsx
<p className="text-xs text-slate-400 mt-1">
  API Key 存储在本地浏览器，请勿在公共设备使用
</p>
```

同时在 `ai-config-store.ts` 加注释：`// 已知取舍：apiKey 明文存储，此应用为本地个人工具`

## Recommended Action

视部署场景：本地开发工具选方案 C，有公网部署风险选方案 A。

## Acceptance Criteria

- [ ] 要么 localStorage 中不包含 apiKey 字段，要么 UI 有明确安全提示
- [ ] 代码中有注释标记此安全取舍是有意为之

## Work Log

- 2026-03-18: 代码审查发现，由 security-sentinel agent 标记为 P1
