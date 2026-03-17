import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, ChevronDown, Check, Circle, ArrowRight } from 'lucide-react'
import { useCanvasStore } from '../store/canvas-store'
import type { DirectionCanvasNode } from '../types'

export const DirectionNode = memo(({ id, data }: NodeProps<DirectionCanvasNode>) => {
  const { status, title, keywords, isExpanding, opinionDraft } = data
  const startExpanding = useCanvasStore(s => s.startExpanding)
  const updateOpinionDraft = useCanvasStore(s => s.updateOpinionDraft)
  const submitOpinion = useCanvasStore(s => s.submitOpinion)
  const confirmDirection = useCanvasStore(s => s.confirmDirection)
  const pendingDirection = useCanvasStore(s => s.pendingDirection)

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
    <div className={`w-[420px] rounded-lg border ${borderColor} ${bgColor} shadow-sm flex overflow-hidden`}>
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

          {/* 标题 */}
          <span className="font-medium text-sm text-slate-900 flex-shrink-0">{title}</span>

          {/* 关键词 */}
          <div className="flex gap-1 flex-1 min-w-0 overflow-hidden">
            {keywords.map((kw, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0">
                {kw}
              </Badge>
            ))}
          </div>

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
          <div className="flex items-center gap-2 mt-2">
            <Input
              placeholder="补充你的想法..."
              value={opinionDraft}
              onChange={(e) => updateOpinionDraft(id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && opinionDraft.trim()) {
                  submitOpinion(id)
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
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-slate-400" />
    </div>
  )
})

DirectionNode.displayName = 'DirectionNode'
