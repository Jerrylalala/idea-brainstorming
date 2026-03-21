import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { useSessionStore } from '@/store/session-store'
import { STATUS_CONFIG, StatusDot } from '@/lib/session-utils'
import type { SessionItem, SessionStatus } from '@/types/session'

const STATUS_OPTIONS: SessionStatus[] = ['backlog', 'todo', 'needs-review', 'done']

// ─── 共享操作逻辑 hook ────────────────────────────────────────────────────────

function useSessionMenuActions(session: SessionItem, onRename: () => void) {
  const { deleteSession, restoreSession, archiveSession, setSessionStatus, activeFilter } =
    useSessionStore()

  const handleDelete = () => {
    deleteSession(session.id)
    toast(`已删除「${session.title}」`, {
      action: { label: '撤销', onClick: restoreSession },
      duration: 5000,
    })
  }

  const handleArchive = () => {
    archiveSession(session.id)
    toast(`已归档「${session.title}」`)
  }

  const handleStatus = (status: SessionStatus) => {
    setSessionStatus(session.id, status)
    if (activeFilter && activeFilter !== status) {
      toast(`已移至 ${STATUS_CONFIG[status].label}`)
    }
  }

  return { handleDelete, handleArchive, handleStatus, onRename }
}

// ─── 右键菜单（ContextMenu，跟随鼠标位置）────────────────────────────────────

interface SessionContextMenuProps {
  session: SessionItem
  onRename: () => void
  children: React.ReactNode
}

export function SessionContextMenu({ session, onRename, children }: SessionContextMenuProps) {
  const { handleDelete, handleArchive, handleStatus } = useSessionMenuActions(session, onRename)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={onRename}>Rename</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>Status</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {STATUS_OPTIONS.map((s) => (
              <ContextMenuItem
                key={s}
                onSelect={() => handleStatus(s)}
                className="gap-2"
              >
                <StatusDot status={s} />
                <span className={session.status === s ? 'font-medium' : ''}>
                  {STATUS_CONFIG[s].label}
                </span>
                {session.status === s && (
                  <span className="ml-auto text-xs text-slate-400">✓</span>
                )}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onSelect={handleArchive}>Archive</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={handleDelete}
          className="text-red-600 focus:text-red-600"
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

// ─── 点击菜单（DropdownMenu，锚定到 ... 按钮）────────────────────────────────

interface SessionDropdownMenuProps {
  session: SessionItem
  onRename: () => void
  onOpenChange?: (open: boolean) => void
}

export function SessionDropdownMenu({ session, onRename, onOpenChange }: SessionDropdownMenuProps) {
  const { handleDelete, handleArchive, handleStatus } = useSessionMenuActions(session, onRename)

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-200"
        >
          <MoreHorizontal className="h-4 w-4 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="end" className="w-52">
        <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {STATUS_OPTIONS.map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={() => handleStatus(s)}
                className="gap-2"
              >
                <StatusDot status={s} />
                <span className={session.status === s ? 'font-medium' : ''}>
                  {STATUS_CONFIG[s].label}
                </span>
                {session.status === s && (
                  <span className="ml-auto text-xs text-slate-400">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={handleArchive}>Archive</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleDelete}
          className="text-red-600 focus:text-red-600"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
