import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { useConfirm } from './ConfirmContext';
import { useToast } from './ToastContext';

const CartContext = createContext(null);

const empty = { store: null, items: [] };

export function CartProvider({ children }) {
  const { user } = useAuth();
  const confirmDialog = useConfirm();
  const toastCtx = useToast();
  // Works whether useToast() returns a function or an object with .toast
  const notify = typeof toastCtx === 'function' ? toastCtx : toastCtx?.toast;
  const key = user?.role === 'customer' ? `pg_cart_${user.id}` : null;

  const [cart, setCart] = useState(empty);
  const [open, setOpen] = useState(false);

  // Load the saved cart for whoever is logged in.
  useEffect(() => {
    if (!key) {
      setCart(empty);
      return;
    }
    try {
      setCart(JSON.parse(localStorage.getItem(key)) || empty);
    } catch {
      setCart(empty);
    }
  }, [key]);

  useEffect(() => {
    if (key) localStorage.setItem(key, JSON.stringify(cart));
  }, [key, cart]);

  function announce(product) {
    if (notify) notify(`Added to cart: ${product.name}`);
  }

  async function addItem(product, qty = 1) {
    // Nothing to add if the product is out of stock.
    if (!product.stock || product.stock <= 0) return;

    // A cart can only hold items from one store (an order belongs to one store).
    // Warn clearly before clearing the current cart.
    if (cart.store && cart.store.id !== product.storeId) {
      const itemCount = cart.items.reduce((n, i) => n + i.qty, 0);
      const itemWord = itemCount === 1 ? 'item' : 'items';
      const ok = await confirmDialog(
        `Your cart has ${itemCount} ${itemWord} from ${cart.store.name}. An order can only be from one store, so adding this from ${product.storeName || 'another store'} will remove them. Continue?`,
        { title: 'Replace your cart?', confirmLabel: 'Clear cart & add', danger: false }
      );
      if (!ok) return;
      setCart({
        store: { id: product.storeId, name: product.storeName },
        items: [line(product, Math.min(qty, product.stock))],
      });
      announce(product);
      return;
    }

    setCart((prev) => {
      const existing = prev.items.find((i) => i.productId === product.id);
      const items = existing
        ? prev.items.map((i) =>
            i.productId === product.id ? { ...i, qty: Math.min(i.qty + qty, product.stock, 99), price: product.effectivePrice, stock: product.stock } : i
          )
        : [...prev.items, line(product, Math.min(qty, product.stock))];
      return { store: { id: product.storeId, name: product.storeName }, items };
    });
    announce(product);
  }

  function setQty(productId, qty) {
    setCart((prev) => {
      const items = prev.items
        .map((i) => (i.productId === productId ? { ...i, qty: Math.max(0, Math.min(qty, i.stock, 99)) } : i))
        .filter((i) => i.qty > 0);
      return items.length ? { ...prev, items } : empty;
    });
  }

  function clear() {
    setCart(empty);
  }

  const count = useMemo(() => cart.items.reduce((n, i) => n + i.qty, 0), [cart]);
  const total = useMemo(() => cart.items.reduce((n, i) => n + i.qty * i.price, 0), [cart]);

  return (
    <CartContext.Provider value={{ cart, addItem, setQty, clear, count, total, open, setOpen }}>
      {children}
    </CartContext.Provider>
  );
}

function line(p, qty) {
  return {
    productId: p.id,
    name: p.name,
    brand: p.brand,
    sizeKg: p.sizeKg,
    price: p.effectivePrice,
    stock: p.stock,
    qty,
  };
}

export function useCart() {
  return useContext(CartContext);
}