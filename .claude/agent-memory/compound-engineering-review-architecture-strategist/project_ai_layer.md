---
name: project_ai_layer
description: AI 客户端抽象层结构：Proxy 模式入口 + Zustand store 存储 class 实例 + AnthropicAIClient / OpenAICompatibleClient 两个实现
type: project
---

AI 层由三层构成：
1. `ai-client.ts` — Proxy 透明转发入口，canvas-store 直接 import `aiClient` 常量
2. `ai-config-store.ts` — Zustand store，持有当前 client 实例 + config，同步写 localStorage
3. `real-ai-client.ts` / `openai-compatible-client.ts` — 两个具体实现，均实现 `AIClient` 接口

**Why:** 这是一次 Phase 1.5 的 AI 配置面板 PR，允许用户在运行时切换 Provider（Anthropic 直连 vs OpenAI 兼容）

**How to apply:** 评审时关注 Proxy 的类型安全问题、两个实现类之间的 prompt 重复、以及 AISettingsModal 直接 new client 实例的耦合
