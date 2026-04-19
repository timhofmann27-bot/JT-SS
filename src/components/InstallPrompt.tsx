import React, { useState, useEffect } from 'react';
import { usePWA } from '../hooks/usePWA';
import { Download, X, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function InstallPrompt() {
  const { isInstallable, isInstalled, install } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showIosPrompt, setShowIosPrompt] = useState(false);

  useEffect(() => {
    // iOS Detection
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
    const isInStandaloneMode = (window.navigator as { standalone?: boolean }).standalone === true;
    
    if (isIOS && !isInStandaloneMode && !dismissed) {
      setShowIosPrompt(true);
    }
  }, [dismissed]);

  if (dismissed || isInstalled) return null;

  // Native Install Prompt (Android/Chrome)
  if (isInstallable) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="install-banner"
        >
          <div className="install-content">
            <div className="install-icon">
              <Smartphone className="h-6 w-6" />
            </div>
            <div className="install-text">
              <p className="font-bold">JT-MP3 als App installieren</p>
              <p className="text-sm text-muted">Schneller Zugriff, Offline-Modus, volle Screen-Größe</p>
            </div>
            <button onClick={install} className="install-button">
              <Download className="h-4 w-4 mr-1" />
              Installieren
            </button>
            <button onClick={() => setDismissed(true)} className="install-close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // iOS Install Instructions
  if (showIosPrompt) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="install-banner ios"
        >
          <div className="install-content">
            <div className="install-text">
              <p className="font-bold">Auf iPhone hinzufügen</p>
              <p className="text-sm text-muted">
                Tippe auf <span className="share-icon">⎋</span> und dann "Zum Home-Bildschirm hinzufügen"
              </p>
            </div>
            <button onClick={() => setDismissed(true)} className="install-close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
