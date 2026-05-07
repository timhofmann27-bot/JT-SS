import { useRef, useCallback, type TouchEvent } from 'react';

interface PullToRefreshOptions {
  threshold?: number;
  maxPull?: number;
  resistance?: number;
}

export function usePullToRefresh(
  onRefresh: () => void,
  options: PullToRefreshOptions = {}
) {
  const { threshold = 80, maxPull = 120, resistance = 2.5 } = options;
  
  const touchStartY = useRef(0);
  const currentPull = useRef(0);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onTouchStart = useCallback((e: TouchEvent) => {
    // Nur aktiv wenn ganz oben gescrollt
    if (window.scrollY > 0) return;
    
    touchStartY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling.current) return;
    
    const touchY = e.touches[0].clientY;
    const pullDistance = (touchY - touchStartY.current) / resistance;
    
    if (pullDistance <= 0) {
      isPulling.current = false;
      currentPull.current = 0;
      return;
    }

    // Max pull begrenzen
    currentPull.current = Math.min(pullDistance, maxPull);
    
    // Visuelles Feedback
    if (containerRef.current) {
      containerRef.current.style.transform = `translateY(${currentPull.current}px)`;
      containerRef.current.style.transition = 'none';
    }
  }, [maxPull, resistance]);

  const onTouchEnd = useCallback(() => {
    if (!isPulling.current) return;
    
    isPulling.current = false;
    
    if (containerRef.current) {
      containerRef.current.style.transition = 'transform 0.3s ease-out';
      
      if (currentPull.current >= threshold) {
        // Refresh auslösen
        containerRef.current.style.transform = `translateY(${threshold / 2}px)`;
        onRefresh();
        
        // Nach Refresh zurücksetzen
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.style.transform = 'translateY(0)';
          }
        }, 500);
      } else {
        // Zurückspringen
        containerRef.current.style.transform = 'translateY(0)';
      }
    }
    
    currentPull.current = 0;
  }, [threshold, onRefresh]);

  return {
    containerRef,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    currentPull: () => currentPull.current,
    threshold,
  };
}
