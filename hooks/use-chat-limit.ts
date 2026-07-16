'use client';

import { useState, useEffect } from 'react';

const DAILY_LIMIT = 6;
const STORAGE_PREFIX = 'vsu_chat_limit_';

export function useChatLimit() {
  const [count, setCount] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Get today's date string YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `${STORAGE_PREFIX}${today}`;

    const storedCount = localStorage.getItem(storageKey);
    if (storedCount) {
      setCount(parseInt(storedCount, 10));
    } else {
      setCount(0);
    }

    setIsInitialized(true);
  }, []);

  const increment = () => {
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `${STORAGE_PREFIX}${today}`;

    const newCount = count + 1;
    setCount(newCount);
    localStorage.setItem(storageKey, newCount.toString());
  };

  return {
    count,
    limit: DAILY_LIMIT,
    remaining: Math.max(0, DAILY_LIMIT - count),
    isLimitReached: count >= DAILY_LIMIT,
    increment,
    isInitialized
  };
}
