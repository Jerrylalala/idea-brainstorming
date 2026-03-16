import { create } from 'zustand';

interface UIState {
    leftCollapsed: boolean;
    rightDrawerOpen: boolean;
    setLeftCollapsed: (value: boolean) => void;
    toggleLeftCollapsed: () => void;
    setRightDrawerOpen: (value: boolean) => void;
    toggleRightDrawer: () => void;
}

export const useUIStore = create<UIState>((set) => ({
    leftCollapsed: true,
    rightDrawerOpen: true,

    setLeftCollapsed: (value) => set({ leftCollapsed: value }),
    toggleLeftCollapsed: () =>
        set((state) => ({ leftCollapsed: !state.leftCollapsed })),

    setRightDrawerOpen: (value) => set({ rightDrawerOpen: value }),
    toggleRightDrawer: () =>
        set((state) => ({ rightDrawerOpen: !state.rightDrawerOpen })),
}));