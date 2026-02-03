/**
 * Mobile Haptic Feedback Utility
 * Supports different feedback patterns for native-like feel
 */

// Vibration patterns (in ms)
const PATTERNS = {
  light: [10],           // Quick tap - for button presses
  medium: [20],          // Standard feedback - for selections
  heavy: [30],           // Strong feedback - for important actions
  success: [10, 50, 20], // Double tap - for successful actions
  warning: [30, 50, 30], // Attention pattern - for warnings
  error: [50, 30, 50, 30, 50], // Error pattern
  selection: [5],        // Ultra-light - for list item selections
};

/**
 * Trigger haptic feedback
 * @param {'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection'} type - Feedback type
 * @returns {boolean} - Whether haptic was triggered
 */
export function triggerHaptic(type = 'light') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return false;
  }

  const pattern = PATTERNS[type] || PATTERNS.light;
  
  try {
    navigator.vibrate(pattern);
    return true;
  } catch (e) {
    // Silently fail - some browsers may block vibration
    return false;
  }
}

/**
 * Cancel any ongoing vibration
 */
export function cancelHaptic() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(0);
  }
}

/**
 * Check if haptics are supported
 * @returns {boolean}
 */
export function isHapticsSupported() {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
}

export default triggerHaptic;