export type SessionGroup = 'TODAY' | 'YESTERDAY';
export type SessionStatus = 'backlog' | 'todo' | 'needs-review' | 'done' | 'archived';

export interface SessionItem {
    id: string;
    title: string;
    time: string;
    group: SessionGroup;
    status?: SessionStatus;
    isActive?: boolean;
}