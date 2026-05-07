import { useState, useEffect, useCallback } from 'react';

type WakeLockSentinelLike = {
  released: boolean;
  release(): Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinelLike>;
  };
};

export function useWakeLock(): {
  isSupported: boolean;
  isActive: boolean;
  request: () => Promise<void>;
  release: () => Promise<void>;
} {
  const [isActive, setIsActive] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinelLike | null>(null);
  const nav = (typeof navigator !== 'undefined' ? navigator : undefined) as NavigatorWithWakeLock | undefined;
  const isSupported = !!nav?.wakeLock;

  const request = useCallback(async () => {
    if (!isSupported || !nav?.wakeLock) return;

    try {
      const lock = await nav.wakeLock.request('screen');
      setWakeLock(lock);
      setIsActive(true);

      lock.addEventListener('release', () => {
        setIsActive(false);
        setWakeLock(null);
      });
    } catch (err) {
      console.error('Wake Lock request failed:', err);
    }
  }, [isSupported]);

  const release = useCallback(async () => {
    if (wakeLock && !wakeLock.released) {
      await wakeLock.release();
      setIsActive(false);
      setWakeLock(null);
    }
  }, [wakeLock]);

  // Wake Lock bei Visibility Change wiederherstellen
  useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive && !wakeLock) {
        request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isActive, wakeLock, isSupported, request]);

  return { isSupported, isActive, request, release };
}
