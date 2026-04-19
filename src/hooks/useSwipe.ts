import { useRef, useCallback, type TouchEvent } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onLongPress?: () => void;
}

interface SwipeOptions {
  threshold?: number;
  timeout?: number;
}

export function useSwipe(
  handlers: SwipeHandlers,
  options: SwipeOptions = {}
) {
  const { threshold = 50, timeout = 300 } = options;
  
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchEnd = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    touchEnd.current = null;
    isLongPress.current = false;

    // Long Press Detection
    if (handlers.onLongPress) {
      longPressTimer.current = setTimeout(() => {
        isLongPress.current = true;
        handlers.onLongPress?.();
      }, 500);
    }
  }, [handlers.onLongPress]);

  const onTouchMove = useCallback((e: TouchEvent) => {
    // Long Press abbrechen bei Bewegung
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    const touch = e.touches[0];
    touchEnd.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }, []);

  const onTouchEnd = useCallback(() => {
    // Long Press Timer clearen
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // Bei Long Press keine Swipe Detection
    if (isLongPress.current) return;

    if (!touchStart.current || !touchEnd.current) {
      // Tap erkannt (keine Bewegung)
      if (touchStart.current && !touchEnd.current) {
        handlers.onTap?.();
      }
      return;
    }

    const deltaX = touchEnd.current.x - touchStart.current.x;
    const deltaY = touchEnd.current.y - touchStart.current.y;
    const deltaTime = touchEnd.current.time - touchStart.current.time;

    // Zu langsam für Swipe
    if (deltaTime > timeout) return;

    // Horizontaler Swipe
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          handlers.onSwipeRight?.();
        } else {
          handlers.onSwipeLeft?.();
        }
      }
    } else {
      // Vertikaler Swipe
      if (Math.abs(deltaY) > threshold) {
        if (deltaY > 0) {
          handlers.onSwipeDown?.();
        } else {
          handlers.onSwipeUp?.();
        }
      }
    }

    touchStart.current = null;
    touchEnd.current = null;
  }, [handlers, threshold, timeout]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
