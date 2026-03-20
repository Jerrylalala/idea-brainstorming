import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCanvasStore } from './store/canvas-store'
import { useSessionStore } from '@/store/session-store'

export function SearchBar() {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  // 标记搜索失败，防止 useEffect 在 isEmpty 变为 true 时清除错误提示
  const justFailedRef = useRef(false)
  const searchIdea = useCanvasStore((s) => s.searchIdea)
  // 从 canvas 状态派生可见性，而非本地 isSubmitted 状态
  const isEmpty = useCanvasStore((s) => s.nodes.length === 0)
  const activeSessionId = useSessionStore((s) => s.activeSessionId)
  const updateSessionTitle = useSessionStore((s) => s.updateSessionTitle)

  // 切换到空画布 session 时自动重置表单（避免残留上一个 session 的输入）
  // justFailedRef 阻止搜索失败后清除错误提示（搜索失败也会触发 isEmpty → true）
  useEffect(() => {
    if (isEmpty) {
      if (justFailedRef.current) {
        justFailedRef.current = false
        return
      }
      setValue('')
      setError(null)
    }
  }, [isEmpty])

  const handleSubmit = useCallback(async () => {
    if (!value.trim()) return
    setError(null)
    // 在 await 前快照 activeSessionId，防止 async 期间 session 切换导致标题写入错误 session
    const sessionIdSnapshot = activeSessionId
    try {
      await searchIdea(value.trim())
      // 搜索成功后同步 session 标题（SearchBar 作为跨 store 桥接层，避免循环依赖）
      if (sessionIdSnapshot) {
        const raw = value.trim()
        // 使用 Array.from 截断，正确处理 Emoji 等 surrogate pair 字符
        const chars = Array.from(raw)
        const title = chars.length > 20 ? chars.slice(0, 20).join('') + '...' : raw
        updateSessionTitle(sessionIdSnapshot, title)
      }
    } catch {
      // 搜索失败：canvas-store 移除 ideaNode，isEmpty 变为 true
      // justFailedRef 阻止 useEffect 清除刚设置的错误提示
      justFailedRef.current = true
      setError('探索失败，请重试')
    }
  }, [value, searchIdea, activeSessionId, updateSessionTitle])

  return (
    <AnimatePresence>
      {isEmpty && (
        <motion.div
          // 改为 absolute 定位，相对于画布容器（brainstorm-canvas.tsx 外层已是 relative）
          className="absolute left-1/2 z-50 flex flex-col items-center pointer-events-none"
          style={{ top: '18%', transform: 'translateX(-50%)' }}
          exit={{
            opacity: 0,
            scale: 0.9,
            y: 20,
            transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }
          }}
        >
          {/* 标题文字 */}
          <motion.h1
            className="text-2xl font-semibold text-slate-800 mb-6 pointer-events-auto"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
            transition={{ duration: 0.5 }}
          >
            输入你的想法，开始探索
          </motion.h1>

          <motion.div
            className="flex items-center gap-2 rounded-full border-2 border-slate-200 bg-white px-4 py-2 shadow-lg pointer-events-auto"
            initial={{ width: 560, opacity: 0, scale: 0.95 }}
            animate={{ width: 560, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <Input
              placeholder="比如：我想开发一款营销软件..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
              }}
              className="nodrag nokey border-0 bg-transparent px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button
              size="sm"
              className="h-7 rounded-full"
              onClick={handleSubmit}
              disabled={!value.trim()}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              探索
            </Button>
          </motion.div>
          {error && (
            <motion.p
              className="mt-2 text-sm text-red-500 pointer-events-auto"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
