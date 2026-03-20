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
