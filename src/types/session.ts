export type SessionGroup = 'TODAY' | 'YESTERDAY';

export interface SessionItem {
    id: string;
    title: string;
    time: string;
    group: SessionGroup;
    isActive?: boolean;
}