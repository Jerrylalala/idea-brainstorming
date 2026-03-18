# AI Provider 配置重构 - 胶水编程方案

**日期：** 2026-03-18
**状态：** 待规划
**参与者：** 派对模式（李明远、张晓峰、陈思琪）

---

## 我们在解决什么

现有的 AI provider 配置层（`openai-compatible-client.ts` + `real-ai-client.ts`）是手工维护的多 provider 路由层，存在以下具体问题：

1. **Kimi baseURL 硬编码** — 写死为 `https://api.moonshot.cn/v1`，用户无法修改，与官网实际 URL 不符时只能绕道 custom provider
2. **测试无超时** — `handleTest` 无限等待，provider 无响应时用户不知道是卡住还是在处理
3. **重复造轮子** — 手写了 HTTP 请求、流式解析、错误处理，这些 Vercel AI SDK 已经做好了

---

## 为什么选 Vercel AI SDK

**[vercel/ai](https://github.com/vercel/ai)** — 50k+ Stars，MIT 许可证，Next.js 团队维护

- 统一接口覆盖 20+ provider（OpenAI、Anthropic、DeepSeek、Kimi/Moonshot、Qwen 等）
- 原生支持浏览器环境（项目现有 `dangerouslyAllowBrowser: true` 的取舍不变）
- 流式输出、错误处理、重试逻辑全部内置
- DeepSeek/Kimi/Qwen 都是 OpenAI 兼容格式，统一走 `@ai-sdk/openai` + 自定义 baseURL

---

## 胶水编程的做法

**不是**把 GitHub 库拉到本地项目。

```bash
npm install ai @ai-sdk/openai @ai-sdk/anthropic
```

库在 `node_modules`，我们不碰它。我们只写调用它的胶水层：

```typescript
// 胶水层核心逻辑（~30 行，替换现有 ~200 行）
function buildModel(provider: ProviderType, config: ProviderConfig) {
  if (provider === 'anthropic' || provider === 'deepseek-anthropic') {
    return createAnthropic({ baseURL: config.baseURL, apiKey: config.apiKey })(config.model)
  }
  // DeepSeek / Kimi / Qwen / custom 全走 OpenAI 兼容
  return createOpenAI({ baseURL: config.baseURL, apiKey: config.apiKey })(config.model)
}
```

---

## 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 底层 SDK | Vercel AI SDK | 50k Stars，行业标准，长期维护 |
| provider 路由 | 胶水层按 provider 选 model | 不改 Proxy 透明转发架构 |
| Kimi baseURL | 改为用户可编辑 | 不同用户官网 URL 可能不同 |
| 测试超时 | 5 秒超时 + 明确错误提示 | 无响应时用户需要反馈 |
| 迁移范围 | 只改 client 层，不动 store/UI | 最小改动，降低风险 |

---

## 要改的文件

| 文件 | 改动 |
|------|------|
| `src/canvas/lib/openai-compatible-client.ts` | 用 `@ai-sdk/openai` 替换，删除手写 HTTP 逻辑 |
| `src/canvas/lib/real-ai-client.ts` | 用 `@ai-sdk/anthropic` 替换 |
| `src/canvas/lib/ai-client.ts` | 更新 `buildClient` 工厂函数 |
| `src/canvas/lib/ai-config-store.ts` | Kimi preset baseURL 改为可编辑默认值 |
| `src/components/ai-settings-modal.tsx` | 测试函数加 5 秒超时 + 错误提示优化 |

**不动的文件：** `canvas-store.ts`、`prompt-builder.ts`、`mock-ai.ts`

---

## 遗留问题

- Kimi 官网有几个不同的 baseURL？需要用户自己填还是提供下拉选项？
- `max_tokens` 是否需要暴露给用户配置？（当前 Anthropic 硬编码 2048）
- Mock 降级时是否需要 toast 提示用户？

---

## 下一步

运行 `/workflows:plan` 将此方案转化为具体实施计划。
