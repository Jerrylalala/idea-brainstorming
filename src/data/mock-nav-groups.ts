import { Archive, Circle, CheckCircle } from 'lucide-react';
import type { NavGroup } from '@/types/navigation';

export const mockNavGroups: NavGroup[] = [
    {
        title: 'All Sessions',
        items: [
            { label: 'Backlog', icon: Circle, color: 'text-slate-400', filter: 'backlog' },
            { label: 'Todo', icon: Circle, color: 'text-slate-400', filter: 'todo' },
            { label: 'Needs Review', icon: Circle, color: 'text-amber-500', filter: 'needs-review' },
            { label: 'Done', icon: CheckCircle, color: 'text-violet-500', filter: 'done' },
            { label: 'Archived', icon: Archive, color: 'text-slate-400', filter: 'archived' },
        ],
    },
    {
        title: 'Labels',
        items: [],
    },
    {
        title: 'Settings',
        items: [],
    },
];