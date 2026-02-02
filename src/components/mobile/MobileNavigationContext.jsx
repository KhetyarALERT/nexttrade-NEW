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
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [assistantModalOpen, setAssistantModalOpen] = useState(false);
  const [navigationDirection, setNavigationDirection] = useState("none"); // "forward" | "back" | "none"
  const lastPathRef = useRef("");

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

  // Update active tab from pathname
  const updateFromPathname = useCallback((pathname) => {
    const newTab = getActiveTabFromPath(pathname);
    const isRoot = isRootPath(pathname);
    
    // Determine navigation direction
    const lastPath = lastPathRef.current;
    if (lastPath && pathname !== lastPath) {
      // Simple heuristic: going to root = back, going deeper = forward
      const wasRoot = isRootPath(lastPath);
      if (wasRoot && !isRoot) {
        setNavigationDirection("forward");
      } else if (!wasRoot && isRoot) {
        setNavigationDirection("back");
      } else if (getActiveTabFromPath(lastPath) !== newTab) {
        setNavigationDirection("none"); // Tab switch - no slide
      } else {
        setNavigationDirection("forward");
      }
    }
    
    lastPathRef.current = pathname;
    
    if (newTab !== activeTab) {
      saveScrollPosition(activeTab);
      setActiveTab(newTab);
      restoreScrollPosition(newTab);
    }
  }, [activeTab, saveScrollPosition, restoreScrollPosition]);

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
    };
  }
  return context;
}

export { getActiveTabFromPath, isRootPath };