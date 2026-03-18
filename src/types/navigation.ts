import type { LucideIcon } from 'lucide-react';

export interface NavSubItem {
    label: string;
    icon: LucideIcon;
    color?: string;
}

export interface NavGroup {
    title: string;
    items: NavSubItem[];
    action?: () => void;
}