import React from 'react';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OfflineIndicatorProps {
  isOffline: boolean;
}

export function OfflineIndicator({ isOffline }: OfflineIndicatorProps) {
  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="offline-banner"
        >
          <WifiOff className="h-4 w-4 mr-2" />
          <span className="text-sm font-bold">Offline-Modus - Musik aus Cache verfügbar</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
