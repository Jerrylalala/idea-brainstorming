---
name: project_ai_layer
description: AI 层架构：Hono 后端代理 + ProxyAIClient 前端适配 + Vercel AI SDK 服务端调用
type: project
---

## 当前架构（Connection Manager PR 后）

Browser (ProxyAIClient) → fetch('/api/*') → Hono server → Vercel AI SDK → External AI API

关键文件：
- `server/app.ts` — Hono 路由（/api/chat 流式, /api/directions 非流式, /api/sniff 格式嗅探）
- `server/provider.ts` — buildModel() 工厂，Anthropic 用原生 SDK，其余走 OpenAI 兼容
- `server/prod.ts` — 生产入口，独立 Hono 实例 + app.route() 挂载（已修复 mutation 问题）
- `src/canvas/lib/proxy-ai-client.ts` — 前端 AIClient 实现，纯 fetch
- `src/canvas/lib/ai-config-store.ts` — 双 Store：useAIConfigStore（legacy）+ useAIConnectionStore（新）

AIClient 接口未变，ProxyAIClient 是 drop-in 替换。旧的 RealAIClient / OpenAICompatibleClient 已删除。

**Why:** 解决 Kimi/Qwen 等 API 的 CORS 限制，将 AI 调用从浏览器直连迁移到同源代理。同时引入 Connection[] 模型支持多连接管理和自动格式嗅探。

**How to apply:** 评审时关注 server/ 与 src/ 之间的边界问题（见下方已知债务）。

## 已知架构债

### P1 — 双 Store 共存（useAIConfigStore + useAIConnectionStore）
两个 store 在同一文件中，useAIConfigStore 是 legacy 但仍被 buildClient() 调用。
消费方（canvas-store 等）尚未迁移到 useAIConnectionStore，导致两套 client 构建路径并存。
建议：确认所有消费方已切换到 useAIConnectionStore 后，删除 useAIConfigStore 及相关类型。

### P1 — server 运行时依赖 src/canvas/lib/prompt-builder.ts
server/app.ts 直接 import 前端源码中的 prompt-builder，存在 browser-only 代码渗入风险。
实际检查：prompt-builder.ts 无 DOM 依赖，当前安全，但边界不清晰。
建议：抽取 shared/ 目录放置跨端共享的类型和 prompt 逻辑。

### P1 — extractName() 函数重复定义
ai-config-store.ts:113 和 ai-settings-modal.tsx:10 各有一份实现，逻辑相同但独立维护。

### P2 — 共享 tsconfig 使 server 代码可访问 DOM 类型
tsconfig.json lib 包含 DOM，server/ 代码理论上可访问 window/document。
应为 server 建立独立 tsconfig.server.json（lib: ["ES2021"]，无 DOM）。

### P2 — /api/sniff 双向并发探测的成本问题
每次添加连接都向目标 API 发送两个真实请求（openai + anthropic 各一个），消耗 token。
对于已知格式的 provider（如 Anthropic 官方 URL）可以跳过嗅探直接设置。

### P3 — Connection.status 是运行时状态但被持久化到 localStorage
loadConnections() 在读取时重置为 'idle'，但 status 字段仍存在于序列化结构中，是冗余字段。

### 已修复的历史问题
- prod.ts mutation 问题：已修复，改为独立 Hono 实例 + server.route()
- 两个实现类的结构性重复：已修复，buildModel() 统一处理
