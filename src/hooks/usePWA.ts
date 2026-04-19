import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
}

export function usePWA(): PWAState & { install: () => Promise<void> } {
  const [state, setState] = useState<PWAState>({
    isInstallable: false,
    isInstalled: false,
    isOffline: !navigator.onLine,
    deferredPrompt: null,
  });

  useEffect(() => {
    // Prüfen ob bereits als App installiert
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
    
    if (isStandalone || isIOSStandalone) {
      setState((prev) => ({ ...prev, isInstalled: true }));
    }

    // BeforeInstallPrompt abfangen
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setState((prev) => ({ ...prev, deferredPrompt: e, isInstallable: true }));
    };

    // Online/Offline Status
    const handleOnline = () => setState((prev) => ({ ...prev, isOffline: false }));
    const handleOffline = () => setState((prev) => ({ ...prev, isOffline: true }));

    // App installiert Event
    const handleAppInstalled = () => {
      setState((prev) => ({ ...prev, isInstalled: true, isInstallable: false, deferredPrompt: null }));
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const install = useCallback(async () => {
    if (!state.deferredPrompt) return;
    
    await state.deferredPrompt.prompt();
    const choiceResult = await state.deferredPrompt.userChoice;
    
    if (choiceResult.outcome === 'accepted') {
      console.log('PWA Installation akzeptiert');
    }
    
    setState((prev) => ({ ...prev, deferredPrompt: null, isInstallable: false }));
  }, [state.deferredPrompt]);

  return { ...state, install };
}
