# AI 连接管理器 - 多连接 + 自动格式嗅探

**日期：** 2026-03-19
**状态：** 待规划
**参与者：** 派对模式（李明远、张晓峰、陈思琪）

---

## 我们在解决什么

当前 AI 配置以「Provider 类型」为中心（deepseek / kimi / qwen / anthropic / custom），用户必须：
1. 知道自己的 API 是 OpenAI 格式还是 Anthropic 格式
2. 知道正确的 baseURL 格式（必须含 `/v1`，不能带 `/chat/completions`）
3. 每次只能用一个 provider，切换麻烦

**用户真实心智模型**：「我有一个 API 地址 + Key + 模型名，填进去能用就行。」

---

## 核心需求（本次讨论产出）

### R1：URL 合法性校验（三层）

```
Layer 1：语法校验（前端即时）
  - 是合法 URL？
  - 协议是 https 或 http://localhost？
  - 路径以 /v1 结尾？（最常见的坑）
  - 有尾斜杠？（提示去掉）

Layer 2：网络可达性（点「添加」时，3s 超时）
  - fetch 根路径，只看能否建立连接

Layer 3：API 端点校验（格式嗅探时）
  - 实际请求 /chat/completions 或 /messages
```

### R2：模型名正确性保障（两步）

```
Step 1：填完 URL + Key 后，尝试 GET /v1/models
  成功 → 展示可选模型下拉
  失败 → 退化到手动填写（静默降级，不报错）

Step 2：点「添加」时，用用户填/选的模型跑格式嗅探
  model_not_found 类错误 → 提示「模型名不存在，请检查拼写」
```

**关键细节**：格式探针用固定的小模型测格式，不依赖用户填的模型名。

### R3：自动格式嗅探（核心创新）

```
用户填入：baseURL + apiKey + model
        ↓
  并行发起两个测试请求（竞速）
  ┌─────────────────┐   ┌──────────────────┐
  │ OpenAI 格式      │   │ Anthropic 格式    │
  │ /chat/completions│   │ /messages        │
  └────────┬────────┘   └────────┬─────────┘
           └──────────┬──────────┘
                谁先成功谁赢
                      ↓
    保存 format: 'openai' | 'anthropic'
```

**边缘情况处理**：
- 两种格式都通 → 优先 OpenAI，提示用户
- 都不通 → 分别展示两种格式的错误原因
- 超时（10s）→ 提示网络问题

### R4：多连接列表管理

```
我的 AI 连接
──────────────────────────────────
● DeepSeek V3        已连接  [启用中]
  api.deepseek.com/v1 · OpenAI 格式

○ Kimi K2.5          已连接
  api.kimi.com/coding/v1 · Anthropic 格式

○ SiliconFlow Qwen   已连接
  api.siliconflow.cn/v1 · OpenAI 格式

[+ 添加新连接]
──────────────────────────────────
```

### R5：右侧状态栏显示当前模型

```
输入框右上角常驻显示：
🟢 DeepSeek V3   （点击跳到设置）
🟡 连接中...
⚪ 未配置 AI
🔴 kimi-k2-5（Key 可能已过期）
```

---

## 数据结构变更

### 旧结构（以 provider 类型为 key）

```typescript
type ProviderPreset = 'deepseek' | 'kimi' | 'kimi-coding' | 'qwen' | 'anthropic' | 'custom'
configs: Partial<Record<ProviderPreset, ProviderConfig>>
activeProvider: ProviderPreset
```

### 新结构（以连接 id 为 key）

```typescript
interface Connection {
  id: string                          // uuid
  name: string                        // 自动从域名提取，用户可改
  baseURL: string                     // 含 /v1
  apiKey: string
  model: string                       // 用户指定的实际使用模型
  format: 'openai' | 'anthropic'      // 自动嗅探结果
  status: 'connected' | 'idle' | 'error'
}

connections: Connection[]
activeId: string
```

---

## 服务端改动（极小）

```typescript
// 现在：按 provider 字符串路由
if (provider === 'anthropic' || provider === 'kimi-coding') {
  return createAnthropic(...)
}

// 改后：按 format 字段路由
if (format === 'anthropic') {
  return createAnthropic({ apiKey, baseURL })(model)
}
return createOpenAI({ apiKey, baseURL }).chat(model)
```

`provider` 字段完全废弃，用 `format` 替代。

---

## 用户完整旅程

```
[添加连接]
填：https://api.siliconflow.cn/v1
填：sk-xxx（填完即自动拉模型列表）
选：Qwen/Qwen2.5-72B-Instruct（从下拉选）
点「添加」
  → 并行测试两种格式（3-10s）
  → OpenAI 格式成功
  → 保存「SiliconFlow · Qwen2.5-72B」
  → 右侧状态栏：🟢 Qwen2.5-72B

[切换连接]
设置 → 点「启用」另一个连接
  → 右侧状态栏切换：🟢 kimi-k2-5

[连接失败自恢复]
某次请求返回 401
  → 右侧状态栏：🔴 kimi-k2-5（Key 可能已过期）
  → 点击跳到设置重新配置
```

---

## 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 格式嗅探方式 | 并行竞速 | 最快，不需要用户知道格式 |
| 模型列表获取 | GET /v1/models 降级到手填 | 覆盖所有 provider，不强依赖 |
| 数据结构 | Connection[] 替代 Record<ProviderPreset> | 支持多连接，格式无关 |
| 服务端路由 | format 字段替代 provider 字符串 | 更语义化，扩展性好 |
| 旧数据迁移 | localStorage 兼容迁移 | 不丢失用户已配置的 Key |
| 连接名称 | 自动从域名提取 + 用户可改 | 零摩擦，可定制 |

---

## 改动范围评估

| 模块 | 改动 | 工作量 |
|------|------|--------|
| `ai-config-store.ts` | 重构数据结构 + 迁移旧数据 | 中 |
| `ai-settings-modal.tsx` | 新 UI：列表 + 添加表单 + 嗅探流程 | 中 |
| `server/app.ts` + `provider.ts` | format 替代 provider | 小 |
| 自动嗅探逻辑（新增） | 并行双格式测试 | 小 |
| 右侧状态栏（新增） | 读 activeConnection.model | 极小 |
| 数据迁移 | localStorage 旧格式兼容 | 小 |

**总体**：一次 PR 可完成，无需拆分。

---

## 遗留问题

1. 嗅探用的探针 prompt 是什么？（需要足够短，不消耗太多 token）
2. 连接名称自动提取规则：`api.siliconflow.cn` → `SiliconFlow`，如何处理？
3. 旧 `kimi-coding` provider 的数据如何迁移到新 Connection 格式？
4. 状态栏放在哪个组件里？（输入框右上角 vs 顶部导航栏）

---

## 下一步

运行 `/workflows:plan` 将此方案转化为具体实施计划。
