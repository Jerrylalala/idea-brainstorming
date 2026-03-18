import { create } from 'zustand';
import type { SessionItem, SessionStatus } from '@/types/session';
import { mockSessions } from '@/data/mock-sessions';

interface SessionState {
    sessions: SessionItem[];
    activeSessionId: string | null;
    activeFilter: SessionStatus | null;
    setActiveSessionId: (id: string) => void;
    setFilter: (filter: SessionStatus | null) => void;
    createSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
    sessions: mockSessions,
    activeSessionId: mockSessions.find((item) => item.isActive)?.id ?? null,
    activeFilter: null,

    setActiveSessionId: (id) => set({ activeSessionId: id }),

    setFilter: (filter) => set({ activeFilter: filter }),

    createSession: () =>
        set((state) => {
            const newSession: SessionItem = {
                id: `session-${Date.now()}`,
                title: 'New chat',
                time: 'now',
                group: 'TODAY',
                status: 'todo',
                isActive: true,
            };

            const nextSessions = state.sessions.map((item) => ({
                ...item,
                isActive: false,
            }));

            return {
                sessions: [newSession, ...nextSessions],
                activeSessionId: newSession.id,
                activeFilter: null,
            };
        }),
}));