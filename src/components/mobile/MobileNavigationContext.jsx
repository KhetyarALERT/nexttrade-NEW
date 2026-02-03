import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import PropTypes from "prop-types";

// Context for mobile navigation state management
const MobileNavigationContext = createContext(null);

// Root tab paths (no sub-routes)
const ROOT_TABS = {
  Dashboard: ["/Dashboard", "/"],
  Futures: ["/Futures", "/Trading"],
  Wallet: ["/Wallet"],
  Profile: ["/Profile"],
};

// Determine active tab from pathname
function getActiveTabFromPath(pathname) {
  for (const [tab, paths] of Object.entries(ROOT_TABS)) {
    if (paths.some(p => pathname === p || pathname.startsWith(p + "?"))) {
      return tab;
    }
  }
  // Check if it's a sub-page of a root tab
  if (pathname.includes("Wallet") || pathname.includes("Deposit") || pathname.includes("Withdraw")) return "Wallet";
  if (pathname.includes("Profile") || pathname.includes("Settings")) return "Profile";
  if (pathname.includes("Futures") || pathname.includes("Trading")) return "Futures";
  return "Dashboard";
}

// Check if current path is a root path for its tab
function isRootPath(pathname) {
  const tab = getActiveTabFromPath(pathname);
  const rootPaths = ROOT_TABS[tab] || [];
  return rootPaths.some(p => pathname === p || pathname === p + "/");
}

export function MobileNavigationProvider({ children }) {
  // Track scroll positions per tab
  const scrollPositions = useRef({});
  // Track navigation history per tab for proper back handling
  const tabHistories = useRef({
    Dashboard: [],
    Futures: [],
    Wallet: [],
    Profile: [],
  });
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [assistantModalOpen, setAssistantModalOpen] = useState(false);
  const [navigationDirection, setNavigationDirection] = useState("none"); // "forward" | "back" | "none"
  const [isPopstateNavigation, setIsPopstateNavigation] = useState(false);
  const lastPathRef = useRef("");

  // Listen for browser back/forward (popstate)
  useEffect(() => {
    const handlePopstate = () => {
      setIsPopstateNavigation(true);
      // Reset after a short delay to allow navigation to complete
      setTimeout(() => setIsPopstateNavigation(false), 50);
    };

    window.addEventListener("popstate", handlePopstate);
    return () => window.removeEventListener("popstate", handlePopstate);
  }, []);

  // Save scroll position for current tab
  const saveScrollPosition = useCallback((tab) => {
    if (typeof window !== "undefined") {
      scrollPositions.current[tab] = window.scrollY;
    }
  }, []);

  // Restore scroll position for tab
  const restoreScrollPosition = useCallback((tab) => {
    if (typeof window !== "undefined") {
      const pos = scrollPositions.current[tab] || 0;
      // Use setTimeout to ensure DOM is ready
      setTimeout(() => {
        window.scrollTo(0, pos);
      }, 0);
    }
  }, []);

  // Push a path to the tab's local history
  const pushToTabHistory = useCallback((tab, pathname) => {
    const history = tabHistories.current[tab] || [];
    // Avoid duplicates at the top
    if (history[history.length - 1] !== pathname) {
      history.push(pathname);
      tabHistories.current[tab] = history;
    }
  }, []);

  // Pop from the tab's local history
  const popFromTabHistory = useCallback((tab) => {
    const history = tabHistories.current[tab] || [];
    if (history.length > 1) {
      history.pop();
      tabHistories.current[tab] = history;
      return history[history.length - 1]; // Return the previous path
    }
    return null;
  }, []);

  // Check if the tab has history to go back to
  const canGoBackInTab = useCallback((tab) => {
    const history = tabHistories.current[tab] || [];
    return history.length > 1;
  }, []);

  // Clear tab history (when switching tabs)
  const clearTabHistory = useCallback((tab) => {
    tabHistories.current[tab] = [];
  }, []);

  // Update active tab from pathname
  const updateFromPathname = useCallback((pathname) => {
    const newTab = getActiveTabFromPath(pathname);
    const newIsRoot = isRootPath(pathname);
    
    // Determine navigation direction
    const lastPath = lastPathRef.current;
    if (lastPath && pathname !== lastPath) {
      // Simple heuristic: going to root = back, going deeper = forward
      const wasRoot = isRootPath(lastPath);
      const lastTab = getActiveTabFromPath(lastPath);
      
      if (lastTab !== newTab) {
        // Tab switch - no slide animation
        setNavigationDirection("none");
        // Reset the new tab's history with its root
        if (newIsRoot) {
          tabHistories.current[newTab] = [pathname];
        }
      } else if (wasRoot && !newIsRoot) {
        setNavigationDirection("forward");
        pushToTabHistory(newTab, pathname);
      } else if (!wasRoot && newIsRoot) {
        setNavigationDirection("back");
        // Clear history when going back to root
        tabHistories.current[newTab] = [pathname];
      } else {
        // Same level navigation
        setNavigationDirection("forward");
        pushToTabHistory(newTab, pathname);
      }
    } else if (!lastPath) {
      // Initial load - set up history
      tabHistories.current[newTab] = [pathname];
    }
    
    lastPathRef.current = pathname;
    
    if (newTab !== activeTab) {
      saveScrollPosition(activeTab);
      setActiveTab(newTab);
      restoreScrollPosition(newTab);
    }
  }, [activeTab, saveScrollPosition, restoreScrollPosition, pushToTabHistory]);

  // Toggle assistant modal
  const toggleAssistantModal = useCallback(() => {
    setAssistantModalOpen(prev => !prev);
  }, []);

  // Open assistant modal
  const openAssistantModal = useCallback(() => {
    setAssistantModalOpen(true);
  }, []);

  // Close assistant modal
  const closeAssistantModal = useCallback(() => {
    setAssistantModalOpen(false);
  }, []);

  // Reset navigation direction after animation completes
  useEffect(() => {
    if (navigationDirection !== "none") {
      const timer = setTimeout(() => setNavigationDirection("none"), 300);
      return () => clearTimeout(timer);
    }
  }, [navigationDirection]);

  const value = {
    activeTab,
    setActiveTab,
    saveScrollPosition,
    restoreScrollPosition,
    updateFromPathname,
    isRootPath,
    getActiveTabFromPath,
    assistantModalOpen,
    toggleAssistantModal,
    openAssistantModal,
    closeAssistantModal,
    navigationDirection,
    isPopstateNavigation,
    // Tab history management
    canGoBackInTab,
    popFromTabHistory,
    pushToTabHistory,
    clearTabHistory,
  };

  return (
    <MobileNavigationContext.Provider value={value}>
      {children}
    </MobileNavigationContext.Provider>
  );
}

MobileNavigationProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useMobileNavigation() {
  const context = useContext(MobileNavigationContext);
  if (!context) {
    // Return a no-op default for server-side or when not wrapped
    return {
      activeTab: "Dashboard",
      setActiveTab: () => {},
      saveScrollPosition: () => {},
      restoreScrollPosition: () => {},
      updateFromPathname: () => {},
      isRootPath: () => true,
      getActiveTabFromPath: () => "Dashboard",
      assistantModalOpen: false,
      toggleAssistantModal: () => {},
      openAssistantModal: () => {},
      closeAssistantModal: () => {},
      navigationDirection: "none",
      isPopstateNavigation: false,
      canGoBackInTab: () => false,
      popFromTabHistory: () => null,
      pushToTabHistory: () => {},
      clearTabHistory: () => {},
    };
  }
  return context;
}

export { getActiveTabFromPath, isRootPath };