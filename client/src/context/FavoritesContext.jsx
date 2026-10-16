import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [storeIds, setStoreIds] = useState(new Set());
  const [productIds, setProductIds] = useState(new Set());
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    if (user?.role !== 'customer') return;
    api
      .get('/favorites/ids')
      .then((res) => {
        setStoreIds(new Set(res.data.stores.map(String)));
        setProductIds(new Set(res.data.products.map(String)));
        setLoaded(true);
      })
      .catch(() => {});
  }, [user?.role]);

  useEffect(() => {
    if (user?.role === 'customer') load();
  }, [user?.role, load]);

  function isFavorite(targetType, id) {
    const set = targetType === 'store' ? storeIds : productIds;
    return set.has(String(id));
  }

  async function toggle(targetType, id) {
    const setFn = targetType === 'store' ? setStoreIds : setProductIds;
    const key = String(id);
    // Read the current value through the functional updater (not a closed-over
    // variable), so this is correct even if another toggle of the same type is
    // already in flight - both updates and both possible reverts stay
    // consistent with whatever the latest state actually is at the time.
    let was;
    setFn((prev) => {
      was = prev.has(key);
      const next = new Set(prev);
      if (was) next.delete(key);
      else next.add(key);
      return next;
    });

    try {
      if (was) {
        await api.delete(`/favorites/${targetType}/${id}`);
      } else {
        await api.post('/favorites', { targetType, targetId: id });
        toast(`Added to favorites.`);
      }
    } catch {
      // Revert just this one id's change on top of whatever the current state
      // is now, rather than resetting to a stale snapshot from before the call.
      setFn((prev) => {
        const next = new Set(prev);
        if (was) next.add(key);
        else next.delete(key);
        return next;
      });
      toast('Could not update favorites.', { type: 'error' });
    }
  }

  return (
    <FavoritesContext.Provider value={{ isFavorite, toggle, loaded, refresh: load }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
