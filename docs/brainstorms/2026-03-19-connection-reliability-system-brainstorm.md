---
title: AI 连接可靠性系统
date: 2026-03-19
type: brainstorm
status: concluded
---

# AI 连接可靠性系统 — Brainstorm

## 背景

用户反馈：自定义中转 URL（如 `https://www.fucheers.top`）填入后无法使用，但在其他工具中可以正常工作。
根因：Vercel AI SDK 的 `createOpenAI` 会在 `baseURL` 后追加 `/chat/completions`，若用户输入的 URL 没有 `/v1` 路径，实际请求会打到错误的 endpoint。

## 核心问题

1. URL 路径不完整时系统无法自动修正
2. 已有连接没有主动验证机制（测试按钮）
3. 连接失效后用户无感知（错误不持久化）
4. 模型名需手动输入，容易拼错

## 功能图谱（5 个功能，分两个 PR）

### PR 1 — P0：连接可靠性基础

#### 功能 1：智能 URL 探测（添加连接时）

**问题**：用户输入 `https://www.fucheers.top`，系统直接存储，实际请求打到 `https://www.fucheers.top/chat/completions`（错误）。

**方案**：
- 前端生成候选 URL 列表（仅当原始 URL 无路径时）：
  ```
  [input + '/v1', input, input + '/api/v1']
  ```
- 顺序调用现有 `/api/sniff`，第一个成功的 `{url, format}` 存入连接
- 存储成功的 URL（不是用户原始输入）
- UI 显示当前探测进度：「正在探测 https://xxx/v1...」

**候选列表生成逻辑**：
```typescript
function generateCandidates(input: string): string[] {
  const url = new URL(input)
  if (url.pathname !== '/' && url.pathname !== '') return [input] // 已有路径，不猜
  const base = input.replace(/\/$/, '')
  return [base + '/v1', base, base + '/api/v1']
}
```

**后端**：零改动，复用现有 `/api/sniff`。

#### 功能 2：测试按钮（已有连接）

**问题**：连接添加后 `status` 重置为 `idle`，用户无法主动验证连接是否仍然有效。

**方案**：
- 连接列表每行加「测试」按钮
- 调用 `/api/sniff`，成功则更新 `status + baseURL + format`（静默修正 URL）
- Store 新增 `updateConnection(id, partial)` 方法
- 测试中显示 loading 状态，成功/失败显示对应图标

**静默修正**：测试发现更好的 URL 时，直接更新存储的 `baseURL`，不打扰用户，但 tooltip 显示「实际使用 https://xxx/v1」。

---

### PR 2 — P1+P2：连接生命周期管理

#### 功能 3：懒检查（lastVerifiedAt）

**问题**：连接可能在用户不知情的情况下失效（API Key 过期、服务商改 URL）。

**方案**：
- Connection 新增字段 `lastVerifiedAt?: number`（时间戳，不持久化 status）
- 页面加载时，对超过 24h 未验证的连接，后台静默调用 `/api/sniff`
- 验证成功更新 `lastVerifiedAt`，失败更新 `status: 'error'`
- 不阻塞 UI，不消耗用户注意力

#### 功能 4：错误记忆（lastError）

**问题**：请求失败后 `status` 在页面刷新时重置为 `idle`，用户不知道上次失败原因。

**方案**：
- Connection 新增字段 `lastError?: string`、`lastErrorAt?: number`（持久化）
- 存储脱敏后的错误信息（已有 `sanitizeStreamError` 输出）
- 连接列表显示 `lastError`（小字，灰色），帮助用户诊断问题
- 连接测试成功后清除 `lastError`

#### 功能 5：模型列表拉取（/v1/models）

**问题**：模型名手动输入，容易拼错，且用户不知道服务商支持哪些模型。

**方案**：
- 新增后端路由 `POST /api/models`，转发 `GET /v1/models`
- sniff 成功后立即拉取模型列表
- 模型输入框变为 combobox（可搜索下拉 + 允许手动输入兜底）
- 拉取失败时降级为纯文本输入（不影响主流程）

---

## 技术约束

- 后端：PR 1 零改动；PR 2 新增 `/api/models` 路由
- 前端：改 `ai-settings-modal.tsx` + `ai-config-store.ts`
- 安全：`lastError` 只存脱敏信息；`/api/models` 需通过 `isAllowedBaseURL` 校验
- 存储：`lastVerifiedAt`、`lastError`、`lastErrorAt` 持久化到 localStorage（剥离 status 的现有逻辑已支持）

## 优先级

| 功能 | PR | 优先级 | 影响 |
|------|-----|--------|------|
| 智能 URL 探测 | 1 | P0 | 解决当前用户痛点 |
| 测试按钮 | 1 | P0 | 提供主动验证能力 |
| 懒检查 | 2 | P1 | 提升可靠性感知 |
| 错误记忆 | 2 | P1 | 帮助用户诊断问题 |
| 模型列表 | 2 | P2 | 锦上添花 |

## 决策记录

- **候选 URL 顺序**：`/v1` 优先，因为这是最常见的 OpenAI 兼容路径
- **静默修正 URL**：测试按钮发现更好的 URL 时直接更新，不弹确认框
- **懒检查阈值**：24h，平衡 token 消耗与及时性
- **模型列表降级**：拉取失败不阻塞，降级为文本输入
- **后端改动最小化**：PR 1 复用现有 `/api/sniff`，不新增接口
