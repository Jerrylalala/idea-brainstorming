import { useViewport } from '@xyflow/react'

export function CanvasZoomIndicator() {
  const { zoom } = useViewport()
  return (
    <div className="absolute bottom-4 right-4 z-10 rounded-lg bg-white/80 px-2 py-1 text-xs font-medium text-slate-500 shadow-sm border border-slate-200 backdrop-blur-sm">
      {Math.round(zoom * 100)}%
    </div>
  )
}
