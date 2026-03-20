import { create } from 'zustand';

interface UIState {
    leftCollapsed: boolean;
    rightDrawerOpen: boolean;
    settingsOpen: boolean;
    searchQuery: string;
    isSearchVisible: boolean;
    focusedSessionId: string | null;
    setLeftCollapsed: (value: boolean) => void;
    toggleLeftCollapsed: () => void;
    setRightDrawerOpen: (value: boolean) => void;
    toggleRightDrawer: () => void;
    setSettingsOpen: (value: boolean) => void;
    setSearchQuery: (query: string) => void;
    setSearchVisible: (visible: boolean) => void;
    openSearch: () => void;
    closeSearch: () => void;
    setFocusedSessionId: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
    leftCollapsed: true,
    rightDrawerOpen: true,
    settingsOpen: false,
    searchQuery: '',
    isSearchVisible: false,
    focusedSessionId: null,

    setLeftCollapsed: (value) => set({ leftCollapsed: value }),
    toggleLeftCollapsed: () =>
        set((state) => ({ leftCollapsed: !state.leftCollapsed })),

    setRightDrawerOpen: (value) => set({ rightDrawerOpen: value }),
    toggleRightDrawer: () =>
        set((state) => ({ rightDrawerOpen: !state.rightDrawerOpen })),

    setSettingsOpen: (value) => set({ settingsOpen: value }),

    setSearchQuery: (query) => set({ searchQuery: query }),
    setSearchVisible: (visible) => set({ isSearchVisible: visible }),
    openSearch: () => set({ isSearchVisible: true, searchQuery: '' }),
    closeSearch: () => set({ isSearchVisible: false, searchQuery: '' }),

    setFocusedSessionId: (id) => set({ focusedSessionId: id }),
}));
