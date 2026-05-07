import { useCallback, useEffect, useRef, useState } from 'react';

interface UseInfiniteScrollOptions<T> {
  items: T[];
  pageSize?: number;
}

interface UseInfiniteScrollReturn<T> {
  visibleItems: T[];
  hasMore: boolean;
  loadMore: () => void;
  reset: () => void;
  observerRef: (node: HTMLElement | null) => void;
}

export function useInfiniteScroll<T>({ items, pageSize = 20 }: UseInfiniteScrollOptions<T>): UseInfiniteScrollReturn<T> {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + pageSize, items.length));
  }, [pageSize, items.length]);

  const reset = useCallback(() => {
    setVisibleCount(pageSize);
  }, [pageSize]);

  useEffect(() => {
    reset();
  }, [items, reset]);

  const observeSentinel = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();

    if (!node || !hasMore) return;

    sentinelRef.current = node;

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        loadMore();
      }
    }, { rootMargin: '200px' });

    observerRef.current.observe(node);
  }, [hasMore, loadMore]);

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  return { visibleItems, hasMore, loadMore, reset, observerRef: observeSentinel };
}
