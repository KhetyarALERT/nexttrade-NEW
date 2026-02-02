import React from "react";
import PropTypes from "prop-types";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useMobileNavigation } from "./MobileNavigationContext";

// Animation variants for page transitions
const variants = {
  enter: (direction) => ({
    x: direction === "forward" ? "100%" : direction === "back" ? "-30%" : 0,
    opacity: direction === "none" ? 1 : 0.8,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    x: direction === "forward" ? "-30%" : direction === "back" ? "100%" : 0,
    opacity: direction === "none" ? 1 : 0.8,
  }),
};

// Transition config
const transition = {
  type: "tween",
  ease: [0.25, 0.1, 0.25, 1], // cubic-bezier for iOS-like feel
  duration: 0.25,
};

export default function PageTransition({ children }) {
  const location = useLocation();
  const { navigationDirection, updateFromPathname } = useMobileNavigation();
  
  // Check if mobile
  const [isMobile, setIsMobile] = React.useState(() => 
    typeof window !== "undefined" && window.innerWidth < 768
  );
  
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update navigation context on path change
  React.useEffect(() => {
    updateFromPathname(location.pathname);
  }, [location.pathname, updateFromPathname]);

  // Desktop: no animation wrapper
  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false} custom={navigationDirection}>
      <motion.div
        key={location.pathname}
        custom={navigationDirection}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={transition}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

PageTransition.propTypes = {
  children: PropTypes.node.isRequired,
};