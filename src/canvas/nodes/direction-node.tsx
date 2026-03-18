import { memo, useRef, useEffect } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, ChevronDown, Check, Circle, ArrowRight, X } from 'lucide-react'
import { useCanvasStore } from '../store/canvas-store'
import type { DirectionCanvasNode } from '../types'

export const DirectionNode = memo(({ id, data }: NodeProps<DirectionCanvasNode>) => {
  const { status, title, summary, isExpanding, opinionDraft } = data
  const startExpanding = useCanvasStore(s => s.startExpanding)
  const cancelExpanding = useCanvasStore(s => s.cancelExpanding)
  const updateOpinionDraft = useCanvasStore(s => s.updateOpinionDraft)
  const submitOpinion = useCanvasStore(s => s.submitOpinion)
  const confirmDirection = useCanvasStore(s => s.confirmDirection)
  const pendingDirection = useCanvasStore(s => s.pendingDirection)

  const nodeRef = useRef<HTMLDivElement>(null)

  // 点击节点外部自动收缩（仅在输入框为空时）
  useEffect(() => {
    if (!isExpanding) return

    const handlePointerDown = (e: PointerEvent) => {
      if (nodeRef.current && !nodeRef.current.contains(e.target as Node)) {
        // 有内容时保护用户输入，不收缩
        if (!opinionDraft.trim()) {
          cancelExpanding(id)
        }
      }
    }

    // 延迟注册避免与打开点击冲突
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown, true)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerdown', handlePointerDown, true)
    }
  }, [isExpanding, opinionDraft, id, cancelExpanding])

  // 状态样式：只用颜色，不用文字
  const borderColor =
    status === 'confirmed' ? 'border-emerald-400' :
    status === 'pending' ? 'border-amber-400' :
    status === 'loading' ? 'border-blue-400' :
    'border-slate-200'

  const bgColor =
    status === 'confirmed' ? 'bg-emerald-50' :
    status === 'pending' ? 'bg-amber-50' :
    'bg-white'

  const leftAccent =
    status === 'confirmed' ? 'bg-emerald-500' :
    status === 'pending' ? 'bg-amber-500' :
    'bg-transparent'

  return (
    <div ref={nodeRef} className={`w-fit max-w-[520px] rounded-lg border ${borderColor} ${bgColor} shadow-sm flex overflow-hidden`}>
      {/* 左侧色条 - 状态指示 */}
      <div className={`w-1 flex-shrink-0 ${leftAccent}`} />

      <Handle type="target" position={Position.Left} className="!bg-slate-400" />

      <div className="flex-1 min-w-0 px-3 py-2.5">
        {/* 主行：标题 + 关键词 + 操作按钮 */}
        <div className="flex items-center gap-2">
          {/* 状态加载指示 */}
          {status === 'loading' && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 flex-shrink-0" />
          )}

          {/* 标题 + 摘要描述 */}
          <span className="font-medium text-sm text-slate-900 flex-shrink-0">{title}</span>
          {summary && (
            <span className="text-xs text-slate-400 flex-shrink min-w-0 truncate">
              {summary.slice(0, 30)}
            </span>
          )}

          {/* 操作按钮 - ghost 无边框 */}
          {status === 'idle' && !isExpanding && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 hover:bg-slate-100"
                onClick={() => startExpanding(id)}
                title="展开子方向"
              >
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 hover:bg-emerald-100"
                onClick={() => confirmDirection(id)}
                title="确认选型"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 hover:bg-amber-100"
                onClick={() => pendingDirection(id)}
                title="标记待定"
              >
                <Circle className="w-3.5 h-3.5 text-amber-600" />
              </Button>
            </div>
          )}
        </div>

        {/* 展开输入框 - 第二行 */}
        {isExpanding && (
          <div className="flex items-center gap-1 mt-2">
            <Input
              placeholder="补充你的想法..."
              value={opinionDraft}
              onChange={(e) => updateOpinionDraft(id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && opinionDraft.trim()) {
                  submitOpinion(id)
                }
                if (e.key === 'Escape') {
                  cancelExpanding(id)
                }
              }}
              className="nodrag nokey h-7 text-xs flex-1"
              autoFocus
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => submitOpinion(id)}
              disabled={!opinionDraft.trim()}
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 hover:bg-slate-100"
              onClick={() => cancelExpanding(id)}
              title="收起"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </Button>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-slate-400" />
    </div>
  )
})

DirectionNode.displayName = 'DirectionNode'
