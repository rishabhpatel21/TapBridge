import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LauncherItem } from '../types/launcher';
import { defaultItems } from '../data/defaultItems';

const STORAGE_KEY = 'tapbridge_launcher_items_v1';

export const useLauncherItems = () => {
  const [items, setItems] = useState<LauncherItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!mounted) return;
        if (raw) {
          setItems(JSON.parse(raw));
        } else {
          setItems(defaultItems);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(defaultItems));
        }
      } catch (error) {
        setItems(defaultItems);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const persist = useCallback(async (next: LauncherItem[]) => {
    setItems(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addItem = useCallback(
    async (item: LauncherItem) => {
      await persist([...items, item]);
    },
    [items, persist]
  );

  const upsertItem = useCallback(
    async (item: LauncherItem) => {
      const exists = items.some((existing) => existing.id === item.id);
      if (exists) {
        await persist(items.map((existing) => (existing.id === item.id ? item : existing)));
      } else {
        await persist([...items, item]);
      }
    },
    [items, persist]
  );

  const updateItem = useCallback(
    async (item: LauncherItem) => {
      await persist(items.map((existing) => (existing.id === item.id ? item : existing)));
    },
    [items, persist]
  );

  const removeItem = useCallback(
    async (id: string) => {
      await persist(items.filter((item) => item.id !== id));
    },
    [items, persist]
  );

  const reorderItems = useCallback(
    async (next: LauncherItem[]) => {
      await persist(next);
    },
    [persist]
  );

  return {
    items,
    loading,
    addItem,
    upsertItem,
    updateItem,
    removeItem,
    reorderItems
  };
};
