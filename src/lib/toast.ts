type ToastType = 'success' | 'error' | 'info';

export function showToast(message: string, type: ToastType = 'info') {
  // Create container if needed
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Auto-remove after animation
  setTimeout(() => {
    toast.remove();
    if (container && container.children.length === 0) {
      container.remove();
    }
  }, 2600);
}

// Pre-built toast messages
export const toast = {
  addedToQueue: (title: string) => showToast(`„${title}" zur Warteschlange`, 'info'),
  removed: (title: string) => showToast(`„${title}" gelöscht`, 'error'),
  liked: (title: string) => showToast(`❤️ „${title}"`, 'success'),
  unliked: (title: string) => showToast(`„${title}" aus Favoriten`, 'error'),
  downloadStart: () => showToast('⬇️ Download gestartet...', 'info'),
  downloadDone: (title: string) => showToast(`✅ „${title}" gespeichert`, 'success'),
  albumDownload: () => showToast('⬇️ Album-Download gestartet...', 'info'),
};
