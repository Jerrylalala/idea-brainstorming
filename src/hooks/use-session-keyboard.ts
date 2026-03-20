// src/hooks/use-session-keyboard.ts
import { useCallback } from 'react'
import { useSessionStore } from '@/store/session-store'
import { useUIStore } from '@/store/ui-store'

/**
 * 键盘导航 hook，挂载到 SessionListPane 的 onKeyDown
 *
 * 双光标系统：
 *  - focusedSessionId：键盘游标（仅 SessionListPane 内可见）
 *  - activeSessionId：已激活的画布 session（全局）
 *
 * 快捷键：
 *  ↑ / ↓       移动键盘游标
 *  Enter        激活游标所在 session（切换画布）
 *  F2           重命名游标所在 session
 *  Delete       删除游标所在 session
 *  Escape       收起搜索框 / 清除游标
 */
export function useSessionKeyboard(
  visibleIds: string[],
  onStartRename: (id: string) => void
) {
  const { deleteSession } = useSessionStore()
  const { setActiveSessionId } = useSessionStore()
  const { focusedSessionId, setFocusedSessionId, closeSearch, isSearchVisible } = useUIStore()

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (visibleIds.length === 0) return

      // 如果搜索框内有输入焦点，不拦截字符键
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' && e.key !== 'Escape') return

      const currentIndex = focusedSessionId
        ? visibleIds.indexOf(focusedSessionId)
        : -1

      switch (e.key) {
        case 'ArrowUp': {
          e.preventDefault()
          const prevIndex = currentIndex <= 0 ? visibleIds.length - 1 : currentIndex - 1
          setFocusedSessionId(visibleIds[prevIndex])
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          const nextIndex = currentIndex >= visibleIds.length - 1 ? 0 : currentIndex + 1
          setFocusedSessionId(visibleIds[nextIndex])
          break
        }
        case 'Enter': {
          if (focusedSessionId) {
            e.preventDefault()
            setActiveSessionId(focusedSessionId)
          }
          break
        }
        case 'F2': {
          if (focusedSessionId) {
            e.preventDefault()
            onStartRename(focusedSessionId)
          }
          break
        }
        case 'Delete': {
          if (focusedSessionId) {
            e.preventDefault()
            const idx = visibleIds.indexOf(focusedSessionId)
            deleteSession(focusedSessionId)
            // 游标移到下一个可见 session
            const remaining = visibleIds.filter((id) => id !== focusedSessionId)
            setFocusedSessionId(remaining[idx] ?? remaining[idx - 1] ?? null)
          }
          break
        }
        case 'Escape': {
          if (isSearchVisible) {
            closeSearch()
          } else {
            setFocusedSessionId(null)
          }
          break
        }
      }
    },
    [
      visibleIds,
      focusedSessionId,
      setFocusedSessionId,
      setActiveSessionId,
      deleteSession,
      onStartRename,
      isSearchVisible,
      closeSearch,
    ]
  )

  return { handleKeyDown }
}
