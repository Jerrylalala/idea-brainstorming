# 需求探索链路完整性分析

**日期**：2026-03-22
**参与者**：郑创意（头脑风暴教练）、陈思琪（分析师）、王建国（产品经理）
**触发问题**：用户告诉系统「我想开发一个东西」时，系统的引导方向是否完整？链路是否闭合？

---

## 一、产品定位回顾

这个产品的核心价值是：

> **让 AI 不只是回答问题，而是主动帮助用户发现「还没想到但应该考虑」的事项。**

目标用户是「不知道技术选型的非专业用户」，他们真正想解决的 5 件事：

1. 我有一个想法，但表述不完整
2. 我不知道还需要考虑哪些维度
3. 我不会专业术语，不知道该怎么问
4. 我希望 AI 主动提醒我哪些问题没想清楚
5. 我希望这些建议有结构，不要丢在一长串聊天记录里

---

## 二、现有架构：两套独立的 AI 系统

读代码后发现，产品实际上有**两套完全独立的 AI 系统**在运行：

### 系统 A：Direction Tree（方向树）

```
searchIdea → idea-node → 5-7 direction-node
submitOpinion → 子方向（有祖先链上下文）
confirmDirection / pendingDirection → 用户标记选型
→ decision-drawer 收集已确认/待定项
```

**优点**：已有 `parentContext`，传入 `parentTitle`、`parentSummary`、`userOpinion`、`ancestorTitles` 完整链路。
**缺点**：与 Chat 系统完全孤立。

### 系统 B：Chat（对话）

```
text-node → 拖线 → chat-node
sendMessage → AI 问 3-5 个问题
expandNote → 展开为 text-node
addChatFromQuote → 引用分支
```

**优点**：支持局部引用、分支对话、展开笔记。
**缺点**：每个 chat-node 是孤岛，只有 `sourceRefs`（当前节点引用），不知道画布上其他任何内容。

---

## 三、完整链路图（现状）

```
用户打开产品
     │
     ▼
🚨 盲点4：引导缺失，用户面对空画布不知道怎么开始
     │
     ├──────────────────────────────────────────┐
     │                                          │
路径 A：搜索框 → Direction Tree          路径 B：text-node → Chat
     │                                          │
idea-node → direction-node               chat-node 对话
✅ 有祖先链上下文                         🚨 断点1：AI 问题静态化
🚨 盲点5：两个入口用户不知道配合关系      🚨 断点2：节点孤岛
     │                                          │
用户标记 confirmed / pending             用户回答问题 → 展开笔记
🚨 盲点2：方向与 Chat 无关联                    │
     │                                    可引用提问创建分支
     ▼
decision-drawer 被动收集
🚨 盲点3：quickNotes 只存 localStorage，不在快照里
     │
     ▼
🚨 断点3：收束缺失，发散探索完成后没有终点，没有结构化输出
     │
     ▼
用户迷失在节点海里，不知道下一步做什么
```

---

## 四、断点与盲点清单（完整版）

### 核心断点（链路不通）

| 断点 | 描述 | 影响 |
|------|------|------|
| **断点1** | `BRAINSTORM_ROLE` 固定 6 个维度，不自适应用户上下文 | 用户说「个人脚本」，AI 还问「商业模式？订阅制还是买断？」 |
| **断点2** | 每个 chat-node 是孤岛，不知道画布上其他节点的内容 | 用户在 A 节点说了「个人用」，B 节点 AI 又重新问一遍 |
| **断点3** | 探索完成后没有收束机制，没有结构化产出 | 用户发散了很多，但拿不到任何可行动的输出 |

### 隐藏盲点（流程缺失）

| 盲点 | 描述 | 影响 |
|------|------|------|
| **盲点1** | AI 对话策略过死：「只问问题，不给建议」 | 用户问「你觉得这个方向靠谱吗？」AI 还是继续提问，体验差 |
| **盲点2** | Direction 确认后，信息不流入 Chat 系统 | 两个系统各走各的，知识无法聚合 |
| **盲点3** | `quickNotes` 只存 localStorage，不在 canvas 快照里 | 切换 session 或清缓存后笔记消失 |
| **盲点4** | 空画布无引导，用户不知道怎么开始 | 新用户流失 |
| **盲点5** | Direction Tree 和 Chat 两个入口没有统一引导 | 用户需要理解两套操作范式才能完整使用 |
| **盲点6** | Session 切换时运行时状态不清理 | `streaming`/`isExpanding` 状态残留，可能导致 UI 卡死 |

### `AIClient` 接口缺口

```ts
// 现有接口
export interface AIClient {
  streamChat(input: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatChunk>
  generateDirections(input: DirectionRequest, signal?: AbortSignal): Promise<Direction[]>
  // ← 缺少 generateSummary，收束功能无法实现
}
```

---

## 五、解决方案（严谨对照版）

### 本次迭代：构成「完整链路」的最小集合

**P0 — 重写 `BRAINSTORM_ROLE` 提示词**

- 问题：固定 6 维度，不自适应
- 方案：
  1. 先分析用户描述里已知信息
  2. 推断项目类型（个人工具 / 面向大众 / 内部工具）
  3. 只问用户还没说清楚的 1-2 个最关键维度
  4. 信息足够时，主动说「你可能还没考虑到 X、Y、Z」
  5. 阶段性策略：前 3 轮以提问为主，之后允许提供判断性建议
- 改动文件：`src/canvas/lib/prompt-builder.ts`
- 成本：极低（只改字符串）

**P1 — Chat 注入画布级上下文**

- 问题：`sendMessage` 只传 `sourceRefs`，节点孤岛
- 方案：`buildSystemPrompt` 新增可选参数 `canvasContext`，包含：
  - `confirmedDirections`：已确认的方向标题列表
  - `textNodeSummaries`：画布上所有 text-node 内容摘要（前 100 字）
- 改动文件：`src/canvas/lib/prompt-builder.ts` + `src/canvas/store/canvas-store.ts`
- 成本：低（各改 10-15 行）

**P2b — 收束功能（decision-drawer 加「AI 综合分析」）**

- 问题：探索无终点，无结构化产出
- 方案：
  1. 扩展 `AIClient` 接口，新增 `generateSummary` 方法
  2. `canvas-store` 新增 `generateSummary` action，收集全画布信息
  3. `decision-drawer` 顶部加「AI 综合分析」按钮
  4. 输出结构：已确认决策 / 待决策问题 / 可能遗漏的考量 / 建议下一步
  5. 第一版只读，Phase 3 再改为可编辑
- 改动文件：`src/canvas/types.ts` + `src/canvas/lib/ai-client.ts` + `src/canvas/store/canvas-store.ts` + `src/components/decision-drawer.tsx`
- 成本：中（约 2 人天）

### 下次迭代：增强体验

**P2a — Direction 确认后自动注入 Chat 上下文**

- 方案：direction 状态变为 `confirmed` 时，触发更新所有 chat-node 的 system prompt
- 改动文件：`src/canvas/store/canvas-store.ts`

**P3 — quickNotes 纳入 canvas 快照**

- 方案：`quickNotes` 从 localStorage 迁移到 canvas-store，纳入 `loadSnapshot` / `clearCanvas`
- 改动文件：`src/canvas/store/canvas-store.ts` + `src/components/decision-drawer.tsx`

**P5 — Session 切换时清理运行时状态**

- 方案：`loadSnapshot` 时将所有 chat-node 的 `status` 重置为 `idle`，所有 direction-node 的 `isExpanding` 重置为 `false`
- 改动文件：`src/canvas/store/canvas-store.ts`

### Phase 2 再做

**P4 — 新用户引导**

- 方案：空画布时显示引导卡片，说明两个入口的使用方式和配合关系

---

## 六、链路完整性定义

> **最小完整链路**：用户输入想法 → AI 动态引导探索 → 知识在画布上积累 → 有一个终点把积累转化为结构化产出

P0 + P1 + P2b 是这条路上三块缺失的石头，缺任何一块链路都不闭合。

---

## 七、关键决策

1. **收束功能的触发方式**：选方案 1（工具栏按钮主动触发），符合目标用户（非专业用户）的操作习惯，不打扰探索流程
2. **收束输出格式**：第一版只读，Phase 3 改为可编辑需求文档
3. **上下文注入粒度**：text-node 取前 100 字摘要，避免 token 过多；confirmed direction 全量传入
4. **提示词改造策略**：不是「改几行字」，而是重新设计 AI 的对话策略（动态感知 + 阶段性角色切换）

---

## 八、遗留问题

- `AIClient` 接口扩展后，mock 客户端（`mock-ai.ts`）也需要同步实现 `generateSummary`
- 收束摘要的 prompt 设计需要单独讨论（输入结构、输出格式、token 预算）
- 两个系统入口的统一引导方案（P4）需要 UX 设计后再规划
