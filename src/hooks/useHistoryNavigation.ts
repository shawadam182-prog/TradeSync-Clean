import { useEffect, useCallback, useRef } from 'react';

interface NavigationState {
  tab: string;
  projectId?: string | null;
  quoteId?: string | null;
}

interface UseHistoryNavigationOptions {
  activeTab: string;
  activeProjectId: string | null;
  viewingQuoteId: string | null;
  setActiveTab: (tab: string) => void;
  setActiveProjectId: (id: string | null) => void;
  setViewingQuoteId: (id: string | null) => void;
}

// Tabs that should be treated as "detail" views (can go back from)
const DETAIL_TABS = ['view', 'jobpack_detail', 'quote_edit'];

// Default back destinations for detail views
const BACK_DESTINATIONS: Record<string, string> = {
  view: 'quotes',
  jobpack_detail: 'jobpacks',
  quote_edit: 'quotes',
};

export function useHistoryNavigation({
  activeTab,
  activeProjectId,
  viewingQuoteId,
  setActiveTab,
  setActiveProjectId,
  setViewingQuoteId,
}: UseHistoryNavigationOptions) {
  const isHandlingPopState = useRef(false);
  const lastPushedState = useRef<string>('');

  // Push state to history when navigation changes
  useEffect(() => {
    // Skip if we're handling a popstate event
    if (isHandlingPopState.current) {
      isHandlingPopState.current = false;
      return;
    }

    const state: NavigationState = {
      tab: activeTab,
      projectId: activeProjectId,
      quoteId: viewingQuoteId,
    };

    const stateKey = JSON.stringify(state);

    // Avoid pushing duplicate states
    if (stateKey === lastPushedState.current) {
      return;
    }

    lastPushedState.current = stateKey;

    // Push to history for detail views, replace for main tabs
    if (DETAIL_TABS.includes(activeTab)) {
      window.history.pushState(state, '', window.location.pathname);
    } else {
      window.history.replaceState(state, '', window.location.pathname);
    }
  }, [activeTab, activeProjectId, viewingQuoteId]);

  // Handle browser back button
  const handlePopState = useCallback((event: PopStateEvent) => {
    isHandlingPopState.current = true;

    const state = event.state as NavigationState | null;

    if (state?.tab) {
      // Restore previous state
      setActiveTab(state.tab);
      setActiveProjectId(state.projectId ?? null);
      setViewingQuoteId(state.quoteId ?? null);
      lastPushedState.current = JSON.stringify(state);
    } else {
      // No state - we're at the beginning, go to home
      // Push a new state to prevent exiting the app
      const homeState: NavigationState = { tab: 'home', projectId: null, quoteId: null };
      window.history.pushState(homeState, '', window.location.pathname);
      setActiveTab('home');
      setActiveProjectId(null);
      setViewingQuoteId(null);
      lastPushedState.current = JSON.stringify(homeState);
    }
  }, [setActiveTab, setActiveProjectId, setViewingQuoteId]);

  // Set up popstate listener
  useEffect(() => {
    window.addEventListener('popstate', handlePopState);

    // Initialize history state on mount
    const initialState: NavigationState = {
      tab: activeTab,
      projectId: activeProjectId,
      quoteId: viewingQuoteId,
    };

    // Replace current state to establish baseline
    window.history.replaceState(initialState, '', window.location.pathname);
    lastPushedState.current = JSON.stringify(initialState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [handlePopState]); // Only run on mount and when handler changes
}
