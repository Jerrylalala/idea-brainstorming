import { Archive, Circle, CheckCircle } from 'lucide-react';
import type { NavGroup } from '@/types/navigation';

export const mockNavGroups: NavGroup[] = [
    {
        title: 'All Sessions',
        items: [
            { label: 'Backlog', icon: Circle, color: 'text-slate-400' },
            { label: 'Todo', icon: Circle, color: 'text-slate-400' },
            { label: 'Needs Review', icon: Circle, color: 'text-amber-500' },
            { label: 'Done', icon: CheckCircle, color: 'text-violet-500' },
            { label: 'Archived', icon: Archive, color: 'text-slate-400' },
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