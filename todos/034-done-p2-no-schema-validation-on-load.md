---
status: pending
priority: p2
issue_id: "034"
tags: [code-review, data-integrity, security]
dependencies: []
---

# loadConnections 反序列化 Connection 对象时无 schema 校验

## Problem Statement

`loadConnections()` 从 localStorage 读取 JSON 后直接 `as Connection[]` 类型断言，没有运行时 schema 校验。如果 localStorage 中的数据被篡改（XSS、手动修改）或格式不兼容（旧版本数据），会导致：1）`format` 字段为非法值，`buildModel()` 传入错误参数；2）`baseURL` 为恶意 URL，绕过 `isAllowedBaseURL` 检查（因为检查在 server 端，client 端无校验）；3）`apiKey` 为 undefined，导致 API 调用失败但错误信息不明确。

## Findings

- `src/canvas/lib/ai-config-store.ts`：`loadConnections()` 中 `JSON.parse(raw) as Connection[]` 无校验
- `Connection.format` 只允许 `'openai' | 'anthropic'`，但反序列化后无验证
- `Connection.baseURL` 在 client 端无 SSRF 校验（只在 server 端校验）
- 旧版本数据可能缺少 `format` 字段（迁移前的数据）
- Data Integrity Guardian 发现此问题

## Proposed Solutions

### Option 1: 添加轻量级 schema 校验函数（推荐）

**Approach:**

```typescript
function isValidConnection(obj: unknown): obj is Omit<Connection, 'status'> {
  if (!obj || typeof obj !== 'object') return false
  const c = obj as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    typeof c.name === 'string' &&
    typeof c.baseURL === 'string' &&
    typeof c.apiKey === 'string' &&
    typeof c.model === 'string' &&
    (c.format === 'openai' || c.format === 'anthropic')
  )
}

// 在 loadConnections 中：
const parsed = JSON.parse(raw)
if (!Array.isArray(parsed)) return []
return parsed
  .filter(isValidConnection)
  .map(c => ({ ...c, status: 'idle' as const }))
```

**Pros:** 防御性编程，过滤无效数据而非崩溃
**Cons:** 需要维护校验函数
**Effort:** 20 分钟
**Risk:** Low

---

### Option 2: 使用 zod 进行 schema 校验

**Approach:** 引入 zod，定义 `ConnectionSchema`，用 `z.array(ConnectionSchema).safeParse()` 校验。

**Pros:** 类型安全，自动生成 TypeScript 类型
**Cons:** 引入新依赖
**Effort:** 30 分钟
**Risk:** Low

## Recommended Action

Option 1，不引入新依赖，手写轻量校验。

## Technical Details

**Affected files:**
- `src/canvas/lib/ai-config-store.ts` — `loadConnections` 函数

## Acceptance Criteria

- [ ] `loadConnections` 过滤掉 `format` 不合法的条目
- [ ] `loadConnections` 过滤掉缺少必填字段的条目
- [ ] 手动测试：在 localStorage 中写入格式错误的数据，刷新后不崩溃

## Work Log

### 2026-03-19 - Code Review Discovery

**By:** Claude Code (review agents: Data Integrity Guardian, Security Sentinel)
