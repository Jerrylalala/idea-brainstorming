// src/components/ai-status-badge.tsx
import { useAIConnectionStore } from '@/canvas/lib/ai-config-store'
import { useUIStore } from '@/store/ui-store'
import { cn } from '@/lib/utils'

export function AIStatusBadge() {
  const { connections, activeId } = useAIConnectionStore()
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen)
  const active = connections.find(c => c.id === activeId)

  const dotClass = cn('inline-block h-2 w-2 rounded-full flex-shrink-0', {
    'bg-emerald-500': active?.status === 'connected',
    'bg-slate-300': !active || active.status === 'idle',
    'bg-red-400': active?.status === 'error',
  })

  const label = active
    ? active.model
    : '未配置 AI'

  return (
    <button
      onClick={() => setSettingsOpen(true)}
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      title={active ? `${active.name} · 点击配置` : '点击配置 AI'}
    >
      <span className={dotClass} />
      <span className="max-w-[120px] truncate">{label}</span>
    </button>
  )
}
