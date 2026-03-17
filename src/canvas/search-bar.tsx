import { useState } from 'react'
import { motion } from 'framer-motion'
import { Search, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCanvasStore } from './store/canvas-store'
import { useReactFlow } from '@xyflow/react'

export function SearchBar() {
  const [value, setValue] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const searchIdea = useCanvasStore((s) => s.searchIdea)
  const reactFlow = useReactFlow()

  const handleSubmit = async () => {
    if (!value.trim()) return

    setIsSubmitted(true)
    await searchIdea(value.trim())

    // 延迟 fitView 确保节点已渲染
    requestAnimationFrame(() => {
      reactFlow.fitView({ padding: 0.2, duration: 800 })
    })
  }

  return (
    <motion.div
      className="absolute top-6 z-10 flex items-center gap-2 rounded-full border-2 border-slate-200 bg-white px-4 py-2 shadow-lg"
      style={{ left: '50%' }}
      initial={{ x: '-50%', width: 480, opacity: 1 }}
      animate={{
        x: '-50%',
        width: isSubmitted ? 0 : 480,
        opacity: isSubmitted ? 0 : 1,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
      <Input
        placeholder="输入你的想法，开始探索..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
        }}
        className="nodrag nokey border-0 bg-transparent px-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
        disabled={isSubmitted}
      />
      {!isSubmitted && (
        <Button
          size="sm"
          className="h-7 rounded-full"
          onClick={handleSubmit}
          disabled={!value.trim()}
        >
          <Sparkles className="w-3 h-3 mr-1" />
          探索
        </Button>
      )}
    </motion.div>
  )
}
