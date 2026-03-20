# Brainstorm: 真实 AI 接入 + 功能缺口分析

**日期：** 2026-03-18
**参与：** 派对模式（李明远/陈思琪/张晓峰）

---

## 一、功能缺口全景

### 左栏（LeftNavPane）
- `All Sessions` / `Labels` / `Settings` 点击无响应
- Labels 分类（Work、Personal 等）是静态 mock，无实际功能
- Settings 入口无对应页面

### Session 列表（SessionListPane）
- `createSession` 只往列表加记录，**不清空/创建新画布**
- `setActiveSessionId` 切换 session **不切换画布内容**
- 根本原因：`canvasStore` 是全局单例，多 session 共享同一画布

### 决策面板（DecisionDrawer）
- 功能本身完整（拖拽排序、跨区、快速笔记）
- 缺少**导出功能**（确认方向无法导出为 Markdown/文档）
- 缺少"开始执行"出口

---

## 二、优先级分层

| 优先级 | 功能 | 理由 |
|--------|------|------|
| P0 | 真实 AI 接入 | 没有这个，产品没有灵魂 |
| P0 | Session 切换联动画布 | 用户点了别的 session 会困惑 |
| P1 | 左栏导航点击响应 | 功能不完整但不阻塞核心流程 |
| P1 | 决策面板导出 Markdown | 用户完成头脑风暴后需要输出 |
| P2 | Labels 功能 | 锦上添花 |
| P2 | Settings 页面 | 锦上添花 |

---

## 三、真实 AI 接入方案决策

### 方案对比

| 方案 | 描述 | 优点 | 缺点 |
|------|------|------|------|
| A（选定）| `AnthropicAIClient` + `dangerouslyAllowBrowser` | 零后端改动，最小侵入 | key 暴露在前端（开发阶段可接受） |
| B | Vercel AI SDK + API route | 生产级安全 | 需要引入后端 |
| C | 自建 Node 代理 | 完全控制 | 工程量大 |

### 选定方案：方案 A

**理由：**
- `AIClient` 接口已设计好，只需新增一个实现类
- 改动范围极小：新增 `real-ai-client.ts` + 改 `ai-client.ts` 一行
- key 存 `.env.local`，不提交 git
- 开发/demo 阶段 `dangerouslyAllowBrowser: true` 完全可接受
- 生产环境需要时再加后端代理（不影响接口设计）

---

## 四、分阶段计划

### Phase 1：真实 AI 接入（当前）
- 新增 `src/canvas/lib/real-ai-client.ts`，实现 `AIClient` 接口
- 支持 `streamChat`（流式对话）和 `generateDirections`（方向生成）
- `ai-client.ts` 改为读取环境变量决定用 Mock 还是真实 AI
- `.env.local` 存 `VITE_ANTHROPIC_API_KEY`

### Phase 2：Session 多画布支持
- `canvasStore` 改为按 `sessionId` 分片存储
- Session 切换时序列化当前画布 / 反序列化目标画布
- `createSession` 创建新的空画布状态

### Phase 3：左栏导航 + 决策面板导出
- 左栏 All Sessions / Labels / Settings 点击响应
- 决策面板"导出为 Markdown"按钮

---

## 五、开放问题

1. `generateDirections` 的 prompt 设计：如何让 AI 输出结构化 JSON（title/summary/keywords）？
2. 流式输出的错误处理：网络中断时如何优雅降级？
3. Phase 2 的 Session 持久化：存 localStorage 还是后端？

---

## 六、续篇讨论（2026-03-18 派对模式第二轮）

**参与：** 李明远（架构师）/ 张晓峰（开发者）/ 陈思琪（分析师）/ 钱效能（性能专家）

---

### 6.1 P0 Bug：AI 供应商 API Key 覆盖问题

**根因分析：**

`ai_config` 以单个扁平对象存入 localStorage。切换供应商时整个对象被替换，之前供应商的 `apiKey` 丢失。这直接导致：
- 用户测试 DeepSeek → 填 KIMI → 切回 DeepSeek → 测试失败（apiKey 已被覆盖）
- KIMI「不能用」很可能是误判，真正原因是 apiKey 被清空

**确定方案（李明远 + 张晓峰共识）：**

```
// 旧结构（有问题）
localStorage['ai_config'] = { provider, baseURL, apiKey, model }

// 新结构（按供应商隔离）
localStorage['ai_configs'] = {
  deepseek:  { apiKey, model },
  kimi:      { apiKey, model },
  qwen:      { apiKey, model },
  anthropic: { apiKey, model },
  custom:    { apiKey, model, baseURL },
}
localStorage['ai_active_provider'] = 'deepseek'
```

**改动范围：** 仅 `src/canvas/lib/ai-config-store.ts`，`AIClient` Proxy 层不需要改。需要写迁移逻辑兼容旧格式。

---

### 6.2 模型选择功能设计

**原则：** 仅使用官方文档中明确存在的模型 ID，不猜测。

**预设模型列表（按官方文档）：**

| 供应商 | 模型 ID | 说明 |
|--------|---------|------|
| DeepSeek | `deepseek-chat` | DeepSeek-V3（推荐） |
| DeepSeek | `deepseek-reasoner` | DeepSeek-R1（推理） |
| Kimi（月之暗面） | `kimi-latest` | 最新版（推荐） |
| Kimi | `moonshot-v1-128k` | 128K 上下文 |
| Kimi | `moonshot-v1-32k` | 32K 上下文 |
| Kimi | `moonshot-v1-8k` | 8K 上下文 |
| 阿里云百炼 | `qwen-max` | 最强 |
| 阿里云百炼 | `qwen-plus` | 推荐 |
| 阿里云百炼 | `qwen-turbo` | 快速 |
| Anthropic | `claude-opus-4-6` | 最强 |
| Anthropic | `claude-sonnet-4-6` | 推荐 |
| Anthropic | `claude-haiku-4-5-20251001` | 快速 |
| Custom | （自由输入） | 任意 OpenAI 兼容端点 |

**UI 方案：** 选供应商后，model 字段自动变为下拉选择；custom 供应商保留文本输入。

---

### 6.3 Session ↔ Canvas 双向绑定（深化 Phase 2 方案）

**根因：** `canvasStore` 是全局单例，`activeSessionId` 变化不触发画布内容切换。

**方案（在 Phase 2 基础上具体化）：**

```
SessionItem 新增字段：
  canvasSnapshot?: { nodes: CanvasNode[], edges: Edge[] }

setActiveSessionId 的新行为：
  1. 将当前画布序列化 → 保存到当前 session 的 snapshot
  2. 加载目标 session 的 snapshot → 恢复到 canvasStore
  3. 若目标 session 无 snapshot → 加载空画布

createSession 的新行为：
  1. 保存当前画布 snapshot
  2. 创建新 session，初始化空画布
  3. 激活新 session
```

**持久化：** 优先 `localStorage`（快速实现），key 格式 `canvas_snapshot_{sessionId}`。

---

### 6.4 AI 头脑风暴引导者模式

**问题：** 当前 system prompt 没有定义 AI 的角色，导致 AI 直接输出答案而不是引导用户思考。

**确定方案（陈思琪主导）：**

`buildSystemPrompt` 增加两种模式：

**头脑风暴模式（新增）：**
```
你是一位专业的头脑风暴引导者。
当用户提出一个想法或意图时，你的任务不是给出答案，而是通过 3-5 个精准的开放式问题帮助用户深入思考。

引导问题应覆盖：
- 目标用户是谁？（越具体越好）
- 核心痛点是什么？现有方案有什么不足？
- 竞品如何做的？你的差异化在哪里？
- 商业模式：自用还是出售？订阅还是买断？
- 技术偏好：Web 端、App 还是两者？

每次回复只问问题，不要提供建议或解决方案。用友好、简洁的语气。
```

**普通聊天模式（现有）：** 保持不变。

**可选扩展：** `brainstorm` 节点类型（区别于 `chat` 节点）默认使用引导模式，节点右上角显示「🧠 引导模式」标识。

---

### 6.5 拖拽性能优化

**现象：** 拖动节点时，边（Edge/线条）先更新位置，节点框体跟随稍慢，视觉上有分离感。

**根因推断（钱效能）：**
- SVG 元素（edges）渲染优先级高于 DOM 元素（节点）
- ChatNode 内含大量消息内容，拖拽时触发整个节点重渲染

**确定方案：**
1. `ChatNode` 增加 `React.memo`，防止不必要的重渲染
2. 拖拽时（`dragging` prop 为 true），ChatNode 渲染轻量骨架版本，隐藏消息列表
3. 松手后恢复完整内容

**优先级：** P2，先完成功能修复再优化体验。

---

### 6.6 更新后的优先级排序

| 优先级 | 功能 | 文件 |
|--------|------|------|
| **P0** | API Key 按供应商隔离存储 | `ai-config-store.ts` |
| **P0** | 模型选择下拉（官方文档预设） | `ai-config-store.ts` + `ai-settings-modal.tsx` |
| **P0** | Session 切换联动画布 | `session-store.ts` + `canvas-store.ts` |
| **P1** | AI 头脑风暴引导者 System Prompt | `canvas-store.ts` (`buildSystemPrompt`) |
| **P1** | 左栏导航点击响应 | `left-nav-pane.tsx` |
| **P2** | 拖拽性能（节点骨架 + React.memo） | `chat-node.tsx` |
