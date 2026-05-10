import { useState, useCallback } from 'react';

const STORAGE_KEY = 'jt-mp3-search-history';
const MAX_ITEMS = 8;

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveHistory(queries: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queries));
  } catch { /* storage full */ }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>(loadHistory);

  const addQuery = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setHistory((prev) => {
      // Remove if already exists, then prepend
      const filtered = prev.filter((q) => q !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, MAX_ITEMS);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const removeQuery = useCallback((query: string) => {
    setHistory((prev) => {
      const updated = prev.filter((q) => q !== query);
      saveHistory(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  return { history, addQuery, removeQuery, clearHistory };
}
