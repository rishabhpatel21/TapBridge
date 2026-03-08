import React, { createContext, useContext, useMemo } from 'react';
import { LauncherItem } from '../types/launcher';
import { useLauncherItems } from '../hooks/useLauncherItems';

type LauncherItemsContextValue = {
  items: LauncherItem[];
  loading: boolean;
  addItem: (item: LauncherItem) => Promise<void>;
  upsertItem: (item: LauncherItem) => Promise<void>;
  updateItem: (item: LauncherItem) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  reorderItems: (items: LauncherItem[]) => Promise<void>;
};

const LauncherItemsContext = createContext<LauncherItemsContextValue | undefined>(undefined);

export const LauncherItemsProvider = ({ children }: { children: React.ReactNode }) => {
  const value = useLauncherItems();

  const memo = useMemo(
    () => ({
      items: value.items,
      loading: value.loading,
      addItem: value.addItem,
      upsertItem: value.upsertItem,
      updateItem: value.updateItem,
      removeItem: value.removeItem,
      reorderItems: value.reorderItems
    }),
    [value]
  );

  return <LauncherItemsContext.Provider value={memo}>{children}</LauncherItemsContext.Provider>;
};

export const useLauncherItemsContext = () => {
  const ctx = useContext(LauncherItemsContext);
  if (!ctx) {
    throw new Error('useLauncherItemsContext must be used within LauncherItemsProvider');
  }
  return ctx;
};
