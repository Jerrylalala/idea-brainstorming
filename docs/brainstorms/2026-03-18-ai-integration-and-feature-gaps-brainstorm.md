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
