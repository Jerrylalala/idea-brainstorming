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
import { toast } from 'sonner'
import { useSessionStore } from '@/store/session-store'
import type { SessionItem, SessionStatus } from '@/types/session'

const STATUS_LABELS: Record<SessionStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  'needs-review': 'Needs Review',
  done: 'Done',
  archived: 'Archived',
}

const STATUS_OPTIONS: SessionStatus[] = ['backlog', 'todo', 'needs-review', 'done']

interface SessionContextMenuProps {
  session: SessionItem
  onRename: () => void
  children: React.ReactNode
}

export function SessionContextMenu({ session, onRename, children }: SessionContextMenuProps) {
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
      toast(`已移至 ${STATUS_LABELS[status]}`)
    }
  }

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
                className={session.status === s ? 'font-medium' : ''}
              >
                {STATUS_LABELS[s]}
                {session.status === s && ' ✓'}
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
