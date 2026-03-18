import { useState, useRef, useCallback, useEffect } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import type { TextCanvasNode } from '../types'
import { useCanvasStore } from '../store/canvas-store'
import { cn } from '@/lib/utils'

export function TextNode({ id, data, selected }: NodeProps<TextCanvasNode>) {
  const [editing, setEditing] = useState(false)
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect } | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const updateTextContent = useCanvasStore((s) => s.updateTextContent)
  const addChatFromQuote = useCanvasStore((s) => s.addChatFromQuote)
  const reactFlow = useReactFlow()

  const handleDoubleClick = useCallback(() => {
    setEditing(true)
    setTimeout(() => textRef.current?.focus(), 0)
  }, [])

  const handleBlur = useCallback(() => {
    setEditing(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditing(false)
    }
    // 阻止事件冒泡，避免 ReactFlow 拦截
    e.stopPropagation()
  }, [])

  // 监听文字选择
  const handleMouseUp = useCallback(() => {
    if (editing) return
    const sel = window.getSelection()
    if (sel && sel.toString().trim()) {
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelection({ text: sel.toString(), rect })
    } else {
      setSelection(null)
    }
  }, [editing])

  // 局部引用：选中文字 → 创建分支 Chat
  const handleQuoteChat = useCallback(() => {
    if (!selection || !containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const flowPosition = reactFlow.screenToFlowPosition({
      x: containerRect.right + 80,
      y: containerRect.top,
    })
    addChatFromQuote(id, selection.text, flowPosition)
    setSelection(null)
    window.getSelection()?.removeAllRanges()
  }, [id, selection, addChatFromQuote, reactFlow])

  // 点击画布其他地方时清除选择
  useEffect(() => {
    const handleClickOutside = () => setSelection(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-w-[200px] max-w-[480px] rounded-xl border bg-white shadow-sm',
        'transition-shadow duration-150',
        selected ? 'border-violet-300 shadow-md' : 'border-slate-200',
      )}
      onDoubleClick={handleDoubleClick}
      onMouseUp={handleMouseUp}
    >
      {/* 顶部装饰条 */}
      <div className="h-1.5 rounded-t-xl bg-gradient-to-r from-violet-400 to-purple-400" />

      {/* 内容区 */}
      <div className="p-4">
        {editing ? (
          <textarea
            ref={textRef}
            className="nodrag nokey w-full min-h-[60px] resize-none border-none bg-transparent text-sm text-slate-700 outline-none"
            value={data.content}
            onChange={(e) => updateTextContent(id, e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <div className="nowheel min-h-[40px] whitespace-pre-wrap text-sm text-slate-700 select-text">
            {data.content || '双击编辑...'}
          </div>
        )}
      </div>

      {/* 局部引用浮动按钮 */}
      {selection && !editing && (
        <div
          className="fixed z-50 flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2 py-1 shadow-lg"
          style={{
            left: selection.rect.left + selection.rect.width / 2 - 40,
            top: selection.rect.top - 36,
          }}
          onClick={(e) => { e.stopPropagation(); handleQuoteChat() }}
        >
          <span className="text-xs text-violet-600 cursor-pointer hover:text-violet-800">
            引用对话
          </span>
        </div>
      )}

      {/* 右侧拖线 Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-violet-400 !border-2 !border-white hover:!bg-violet-600"
      />

      {/* 左侧接收 Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-300 !border-2 !border-white"
      />
    </div>
  )
}
