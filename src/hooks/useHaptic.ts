/**
 * Haptic feedback hook for mobile devices
 * Provides subtle vibration feedback on button taps
 */

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const patterns: Record<HapticStyle, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 50,
  success: [10, 50, 10],
  warning: [25, 50, 25],
  error: [50, 100, 50],
};

export function useHaptic() {
  const vibrate = (style: HapticStyle = 'light') => {
    // Check if vibration is supported
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(patterns[style]);
      } catch (e) {
        // Silently fail if vibration not allowed
      }
    }
  };

  const tap = () => vibrate('light');
  const success = () => vibrate('success');
  const warning = () => vibrate('warning');
  const error = () => vibrate('error');

  return { vibrate, tap, success, warning, error };
}

/**
 * Simple function for one-off haptic feedback
 */
export function hapticTap() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10);
    } catch (e) {
      // Silently fail
    }
  }
}

export function hapticSuccess() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([10, 50, 10]);
    } catch (e) {
      // Silently fail
    }
  }
}
