import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from './store/canvas-store'

export function CanvasToolbar() {
  const reactFlow = useReactFlow()
  const addTextNode = useCanvasStore((s) => s.addTextNode)

  const handleAddText = useCallback(() => {
    const center = reactFlow.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
    addTextNode(center, '')
  }, [reactFlow, addTextNode])

  const handleFitView = useCallback(() => {
    reactFlow.fitView({ duration: 400, padding: 0.2 })
  }, [reactFlow])

  return (
    <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-slate-200 bg-white/90 px-2 py-1.5 shadow-lg backdrop-blur-sm">
      <button
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        onClick={handleAddText}
      >
        <span className="text-base leading-none">+</span> 文本
      </button>
      <div className="h-4 w-px bg-slate-200" />
      <button
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        onClick={handleFitView}
      >
        适应视口
      </button>
    </div>
  )
}
