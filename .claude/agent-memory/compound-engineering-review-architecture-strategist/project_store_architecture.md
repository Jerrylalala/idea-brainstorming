---
name: project_store_architecture
description: 多 Store 依赖层级和已知架构债：session-store 对 canvas-store 的 P1 级 cross-store 命令式写入
type: project
---

## Store 依赖层级（由低到高）

```
ai-config-store  →  ai-client (Proxy)
                           ↓
                     canvas-store
                           ↑
                     session-store
                           ↑
                        ui-store
```

约定：高层 Store 不应命令式写入低层 Store，跨 store 协调应通过组件层 useEffect 完成。

## 已知架构债（P1）

**位置**: `src/store/session-store.ts`，`setActiveSessionId` 和 `createSession` 两个方法内

**问题**：session-store 直接调用 `useCanvasStore.getState().loadSnapshot()` 和 `.clearCanvas()`，将画布副作用埋在 store action 内部，违反单向协调约定。

**Why:** `fix/provider-isolation-session-binding` PR（2026-03-18）引入，当时选择最快路径修复 P0 Bug（session 切换不切换画布），接受了这个架构债。

**How to apply:** 下次 session 功能迭代时，将画布协调逻辑迁移到组件层（session-list-pane 或 App.tsx 的 useEffect），让两个 store 彻底解耦。

## canvasSnapshot 内存注意事项

`SessionItem.canvasSnapshot` 包含完整 `CanvasNode[]`（含 chat messages 字符串），随 session 数量线性增长，无淘汰策略。在 session 持久化方案落地前，这是已知的内存增长点。
