import type { SessionStatus } from '@/types/session'

// ─── Status 颜色配置（单一来源，三处复用：菜单 / session 行 / 侧边栏）───

export const STATUS_CONFIG: Record<
  SessionStatus,
  { label: string; color: string; filled: boolean }
> = {
  backlog:        { label: 'Backlog',      color: '#94a3b8', filled: false },
  todo:           { label: 'Todo',         color: '#94a3b8', filled: false },
  'needs-review': { label: 'Needs Review', color: '#f97316', filled: true  },
  done:           { label: 'Done',         color: '#8b5cf6', filled: true  },
  archived:       { label: 'Archived',     color: '#94a3b8', filled: false },
}

/** 状态圆圈图标，空心或实心，颜色与 STATUS_CONFIG 一致 */
export function StatusDot({ status }: { status: SessionStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.backlog
  return (
    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
      <svg viewBox="0 0 12 12" width="10" height="10">
        <circle
          cx="6" cy="6" r="4.5"
          fill={cfg.filled ? cfg.color : 'none'}
          stroke={cfg.color}
          strokeWidth="1.5"
        />
      </svg>
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

/** 将分组标签定义为常量，避免拼写错误 */
export const SESSION_GROUP = {
  TODAY: 'TODAY',
  YESTERDAY: 'YESTERDAY',
  THIS_WEEK: 'THIS WEEK',
  LAST_WEEK: 'LAST WEEK',
  THIS_MONTH: 'THIS MONTH',
} as const

/**
 * 根据 createdAt 动态计算 session 所属时间分组标签
 * 使用本地日历日期比较，避免跨时区的毫秒差计算误差
 */
export function getSessionGroup(createdAt: string): string {
  const now = new Date()
  const created = new Date(createdAt)

  // 用本地日期字符串比较，正确处理时区
  const todayStr = now.toDateString()
  const createdStr = created.toDateString()

  if (createdStr === todayStr) return SESSION_GROUP.TODAY

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (createdStr === yesterday.toDateString()) return SESSION_GROUP.YESTERDAY

  // 毫秒差（仅用于 7/14 天分界，时区误差可接受）
  const diffDays = Math.floor((now.getTime() - created.getTime()) / 86400000)
  if (diffDays <= 6) return SESSION_GROUP.THIS_WEEK
  if (diffDays <= 13) return SESSION_GROUP.LAST_WEEK

  if (
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth()
  ) return SESSION_GROUP.THIS_MONTH

  // 更早：绝对月份（'MARCH 2026'）
  return created
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })
    .toUpperCase()
}

/** 展示用相对时间字符串 */
export function formatSessionTime(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
