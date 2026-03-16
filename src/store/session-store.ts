import { create } from 'zustand';
import type { SessionItem } from '@/types/session';
import { mockSessions } from '@/data/mock-sessions';

interface SessionState {
    sessions: SessionItem[];
    activeSessionId: string | null;
    setActiveSessionId: (id: string) => void;
    createSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
    sessions: mockSessions,
    activeSessionId: mockSessions.find((item) => item.isActive)?.id ?? null,

    setActiveSessionId: (id) => set({ activeSessionId: id }),

    createSession: () =>
        set((state) => {
            const newSession: SessionItem = {
                id: `session-${Date.now()}`,
                title: 'New chat',
                time: 'now',
                group: 'TODAY',
                isActive: true,
            };

            const nextSessions = state.sessions.map((item) => ({
                ...item,
                isActive: false,
            }));

            return {
                sessions: [newSession, ...nextSessions],
                activeSessionId: newSession.id,
            };
        }),
}));