import { create } from 'zustand';

interface UIState {
    leftCollapsed: boolean;
    rightDrawerOpen: boolean;
    settingsOpen: boolean;
    setLeftCollapsed: (value: boolean) => void;
    toggleLeftCollapsed: () => void;
    setRightDrawerOpen: (value: boolean) => void;
    toggleRightDrawer: () => void;
    setSettingsOpen: (value: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
    leftCollapsed: true,
    rightDrawerOpen: true,
    settingsOpen: false,

    setLeftCollapsed: (value) => set({ leftCollapsed: value }),
    toggleLeftCollapsed: () =>
        set((state) => ({ leftCollapsed: !state.leftCollapsed })),

    setRightDrawerOpen: (value) => set({ rightDrawerOpen: value }),
    toggleRightDrawer: () =>
        set((state) => ({ rightDrawerOpen: !state.rightDrawerOpen })),

    setSettingsOpen: (value) => set({ settingsOpen: value }),
}));
