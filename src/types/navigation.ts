import type { LucideIcon } from 'lucide-react';
import type { SessionStatus } from './session';

export interface NavSubItem {
    label: string;
    icon: LucideIcon;
    color?: string;
    filter?: SessionStatus;
}

export interface NavGroup {
    title: string;
    items: NavSubItem[];
    action?: () => void;
}