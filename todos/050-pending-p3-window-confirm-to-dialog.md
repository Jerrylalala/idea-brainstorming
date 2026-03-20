---
status: pending
priority: p3
issue_id: "050"
tags: [code-review, ux, canvas-toolbar]
dependencies: []
---

# canvas-toolbar：window.confirm 替换为自定义 Dialog

## Problem Statement

`CanvasToolbar` 中的「重新探索」按钮使用 `window.confirm()` 进行确认，这会弹出浏览器原生对话框。原生对话框样式与应用整体风格不一致，且在某些浏览器中无法自定义文案，用户体验不佳。

## Findings

- `src/canvas/canvas-toolbar.tsx:284`：
  ```tsx
  const handleRestart = useCallback(() => {
    if (window.confirm('清空画布并重新探索？此操作无法撤销。')) {
      clearCanvas()
    }
  }, [clearCanvas])
  ```
- `window.confirm` 会阻塞 JS 主线程
- 在部分移动端浏览器中被拦截
- 样式完全由浏览器决定，无法与 shadcn/ui 主题统一

## Proposed Solutions

### Option 1: 使用 shadcn/ui AlertDialog（推荐）

**Approach:** 用 shadcn/ui 的 `AlertDialog` 替换 `window.confirm`。

```tsx
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// 在 return JSX 中：
{hasNodes && (
  <>
    <div className="h-4 w-px bg-slate-200" />
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="...">
          <RotateCcw className="w-3 h-3" />
          重新探索
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>清空画布？</AlertDialogTitle>
          <AlertDialogDescription>
            此操作将清空当前画布所有内容，无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction onClick={clearCanvas}>确认清空</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
)}
```

**Pros:**
- 与应用风格一致
- 不阻塞主线程
- 移动端友好

**Cons:**
- 需要 shadcn/ui AlertDialog 组件（需确认是否已安装）
- 代码量增加

**Effort:** 30 分钟

**Risk:** Low

---

### Option 2: 保持 window.confirm，暂时接受

**Approach:** 不修改，当前 MVP 阶段可接受。

**Pros:**
- 零开发成本

**Cons:**
- 风格不一致，长期体验差

**Effort:** 0

**Risk:** Low

## Recommended Action

P3 级别，待 P1/P2 修复后再处理。如项目中已有 AlertDialog 使用案例，优先用 Option 1。

## Technical Details

**Affected files:**
- `src/canvas/canvas-toolbar.tsx:283-287` — handleRestart

## Resources

- **PR Branch:** `fix/search-bar-session-consistency`
- **shadcn/ui AlertDialog:** https://ui.shadcn.com/docs/components/alert-dialog

## Acceptance Criteria

- [ ] 点击「重新探索」弹出自定义 Dialog，而非浏览器原生弹窗
- [ ] Dialog 样式与应用整体风格一致
- [ ] 确认后画布清空，取消后画布不变

## Work Log

### 2026-03-20 - Code Review 发现

**By:** Claude Code（code-simplicity-reviewer）

**Actions:**
- 识别 window.confirm 的 UX 问题
- 评级为 P3（功能正常，体验优化）
