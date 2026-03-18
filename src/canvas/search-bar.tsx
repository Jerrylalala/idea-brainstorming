import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCanvasStore } from './store/canvas-store'

export function SearchBar() {
  const [value, setValue] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchIdea = useCanvasStore((s) => s.searchIdea)

  const handleSubmit = async () => {
    if (!value.trim()) return
    setIsSubmitted(true)
    setError(null)
    try {
      await searchIdea(value.trim())
    } catch {
      setIsSubmitted(false)  // 恢复搜索框，允许重试
      setError('探索失败，请重试')
    }
    // fitView 由 useAutoLayout 的 pendingFocusNodes 自动处理
  }

  return (
    <AnimatePresence>
      {!isSubmitted && (
        <motion.div
          className="fixed left-1/2 z-50 flex flex-col items-center pointer-events-none"
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
            disabled={isSubmitted}
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
