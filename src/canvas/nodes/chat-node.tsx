import { useCallback, useRef, useState, useEffect } from 'react'
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react'
import type { ChatCanvasNode } from '../types'
import { useCanvasStore } from '../store/canvas-store'
import { cn } from '@/lib/utils'

export function ChatNode({ id, data, selected }: NodeProps<ChatCanvasNode>) {
  const updateDraft = useCanvasStore((s) => s.updateDraft)
  const sendMessage = useCanvasStore((s) => s.sendMessage)
  const expandNote = useCanvasStore((s) => s.expandNote)
  const addChatFromQuote = useCanvasStore((s) => s.addChatFromQuote)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect } | null>(null)
  const reactFlow = useReactFlow()

  const handleSend = useCallback(() => {
    if (data.draft.trim() && data.status !== 'streaming') {
      sendMessage(id)
    }
  }, [id, data.draft, data.status, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
      e.stopPropagation()
    },
    [handleSend]
  )

  const statusColor = {
    idle: 'bg-emerald-400',
    streaming: 'bg-amber-400 animate-pulse',
    error: 'bg-rose-400',
  }[data.status]

  // 监听消息区文字选择
  const handleMessageMouseUp = useCallback(() => {
    const sel = window.getSelection()
    if (sel && sel.toString().trim()) {
      const range = sel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      setSelection({ text: sel.toString(), rect })
    } else {
      setSelection(null)
    }
  }, [])

  // 引用提问：选中文字 → 创建分支 Chat
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
        'relative min-w-[300px] max-w-[480px] rounded-xl border bg-white shadow-sm',
        'transition-shadow duration-150',
        selected ? 'border-sky-300 shadow-md' : 'border-slate-200',
      )}
    >
      {/* 顶部状态条 */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2">
        <div className={cn('h-2 w-2 rounded-full', statusColor)} />
        <span className="text-xs font-medium text-slate-500">
          {data.status === 'streaming' ? '思考中...' : data.status === 'error' ? '出错了' : '对话'}
        </span>
      </div>

      {/* 引用来源 */}
      {data.sourceRefs.length > 0 && (
        <div className="border-b border-slate-50 px-4 py-2">
          {data.sourceRefs.map((ref, i) => (
            <div
              key={i}
              className="rounded-md bg-violet-50 px-2 py-1 text-xs text-violet-600 line-clamp-2"
            >
              {ref.quotedText
                ? `"${ref.quotedText.slice(0, 100)}${ref.quotedText.length > 100 ? '...' : ''}"`
                : `引用自节点 ${ref.nodeId}`}
            </div>
          ))}
        </div>
      )}

      {/* 消息列表 */}
      <div className="nowheel max-h-[300px] overflow-y-auto px-4 py-2 space-y-3" onMouseUp={handleMessageMouseUp}>
        {data.messages.map((msg) => (
          <div key={msg.id}>
            <div
              className={cn(
                'text-sm',
                msg.role === 'user' ? 'text-slate-800' : 'text-slate-600',
              )}
            >
              <span className="text-xs font-medium text-slate-400 mr-1">
                {msg.role === 'user' ? '你' : 'AI'}:
              </span>
              <span className="whitespace-pre-wrap select-text nopan">{msg.text}</span>
            </div>
            {/* 展开笔记按钮（仅 assistant 消息） */}
            {msg.role === 'assistant' && data.status === 'idle' && (
              <button
                className="mt-1 text-xs text-violet-500 hover:text-violet-700 hover:underline"
                onClick={(e) => {
                  e.stopPropagation()
                  expandNote(id, msg.id)
                }}
              >
                展开为笔记
              </button>
            )}
          </div>
        ))}
      </div>

      {/* 输入区 */}
      <div className="border-t border-slate-100 px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            className="nodrag nokey flex-1 min-h-[32px] max-h-[80px] resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-1 focus:ring-sky-200"
            placeholder={data.status === 'streaming' ? '等待回复...' : '输入你的问题...'}
            value={data.draft}
            onChange={(e) => updateDraft(id, e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={data.status === 'streaming'}
          />
          <button
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors',
              data.draft.trim() && data.status !== 'streaming'
                ? 'bg-sky-500 hover:bg-sky-600'
                : 'bg-slate-300 cursor-not-allowed',
            )}
            onClick={handleSend}
            disabled={!data.draft.trim() || data.status === 'streaming'}
          >
            发送
          </button>
        </div>
      </div>

      {/* 引用提问浮动按钮 */}
      {selection && (
        <div
          className="fixed z-50 flex items-center gap-1 rounded-lg border border-sky-200 bg-white px-2 py-1 shadow-lg"
          style={{
            left: selection.rect.left + selection.rect.width / 2 - 40,
            top: selection.rect.top - 36,
          }}
          onClick={(e) => { e.stopPropagation(); handleQuoteChat() }}
        >
          <span className="text-xs text-sky-600 cursor-pointer hover:text-sky-800">
            引用提问
          </span>
        </div>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-sky-400 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-sky-300 !border-2 !border-white hover:!bg-sky-500"
      />
    </div>
  )
}
