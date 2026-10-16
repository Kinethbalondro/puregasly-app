import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { errMsg, formatPHP } from '../utils/format';
import Spinner from './Spinner';

const NEW_ADDRESS = '__new__';

export default function CartDrawer() {
  const { cart, setQty, clear, total, open, setOpen } = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem('pg_delivery')) || {};
    } catch {
      return {};
    }
  })();

  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [address, setAddress] = useState(saved.address || '');
  const [phone, setPhone] = useState(saved.phone || '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState(null); // { code, discount }
  const [couponError, setCouponError] = useState('');
  const [checkingCoupon, setCheckingCoupon] = useState(false);

  // Only auto-fills the default address the FIRST time the drawer opens in
  // this cart session - otherwise closing the drawer by accident (e.g.
  // clicking the backdrop) and reopening it would silently wipe out an
  // address the customer had already picked or started typing.
  const addressAutoFilled = useRef(false);

  useEffect(() => {
    if (!open) return;
    api
      .get('/addresses')
      .then((res) => {
        setSavedAddresses(res.data);
        if (addressAutoFilled.current) return;
        addressAutoFilled.current = true;

        const def = res.data.find((a) => a.isDefault);
        if (def) {
          setSelectedAddressId(def.id);
          setAddress(def.address);
          setPhone(def.contactNumber);
        } else if (res.data.length === 0) {
          setSelectedAddressId(NEW_ADDRESS);
        }
      })
      .catch(() => {});
  }, [open]);

  // Discount only applies while it's still valid for the current total -
  // clear it if the cart changes so a stale discount can't sneak through.
  useEffect(() => {
    setCoupon(null);
    setCouponError('');
  }, [cart.store?.id, total]);

  if (!open) return null;

  function pickAddress(id) {
    setSelectedAddressId(id);
    if (id === NEW_ADDRESS) {
      setAddress('');
      setPhone('');
      return;
    }
    const a = savedAddresses.find((x) => x.id === id);
    if (a) {
      setAddress(a.address);
      setPhone(a.contactNumber);
    }
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCheckingCoupon(true);
    setCouponError('');
    try {
      const res = await api.post('/coupons/validate', {
        storeId: cart.store?.id,
        code: couponCode.trim(),
        subtotal: total,
      });
      setCoupon({ code: res.data.code, discount: res.data.discount });
      toast(`Coupon applied: -${formatPHP(res.data.discount)}`);
    } catch (err) {
      setCoupon(null);
      setCouponError(errMsg(err, 'Invalid coupon.'));
    } finally {
      setCheckingCoupon(false);
    }
  }

  function removeCoupon() {
    setCoupon(null);
    setCouponCode('');
    setCouponError('');
  }

  const finalTotal = Math.max(0, total - (coupon?.discount || 0));

  async function placeOrder(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/orders', {
        items: cart.items.map((i) => ({ productId: i.productId, qty: i.qty })),
        deliveryAddress: address,
        contactNumber: phone,
        notes,
        couponCode: coupon?.code || undefined,
      });
      localStorage.setItem('pg_delivery', JSON.stringify({ address, phone }));
      clear();
      setNotes('');
      setCoupon(null);
      setCouponCode('');
      setOpen(false);
      toast('Order placed!');
      navigate('/orders');
    } catch (err) {
      setError(errMsg(err, 'Could not place the order.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drawer-backdrop" onClick={() => setOpen(false)}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>Your Cart</h3>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close cart">
            ✕
          </button>
        </div>

        {cart.items.length === 0 ? (
          <p className="muted center pad">Your cart is empty. Browse stores and add some LPG!</p>
        ) : (
          <form onSubmit={placeOrder} className="drawer-body">
            <p className="muted small">
              Ordering from <strong>{cart.store?.name}</strong>
            </p>

            <div className="cart-lines">
              {cart.items.map((i) => (
                <div key={i.productId} className="cart-line">
                  <div>
                    <strong>{i.name}</strong>
                    <span className="muted small">
                      {[i.brand, i.sizeKg ? `${i.sizeKg} kg` : null].filter(Boolean).join(' · ')}
                    </span>
                    <span className="small">{formatPHP(i.price)} each</span>
                  </div>
                  <div className="qty">
                    <button type="button" onClick={() => setQty(i.productId, i.qty - 1)}>
                      −
                    </button>
                    <span>{i.qty}</span>
                    <button type="button" onClick={() => setQty(i.productId, i.qty + 1)} disabled={i.qty >= i.stock}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="field">
              <label htmlFor="coupon">Coupon code (optional)</label>
              {coupon ? (
                <div className="coupon-applied">
                  <span>
                    🎟️ <strong>{coupon.code}</strong> applied · -{formatPHP(coupon.discount)}
                  </span>
                  <button type="button" className="link-btn" onClick={removeCoupon}>
                    Remove
                  </button>
                </div>
              ) : (
                <div className="coupon-row">
                  <input
                    id="coupon"
                    type="text"
                    maxLength={20}
                    placeholder="e.g. WELCOME10"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  />
                  <button type="button" className="btn-ghost small" disabled={checkingCoupon || !couponCode.trim()} onClick={applyCoupon}>
                    {checkingCoupon && <Spinner />}Apply
                  </button>
                </div>
              )}
              {couponError && <div className="message error" style={{ marginTop: 6 }}>{couponError}</div>}
            </div>

            <div className="cart-total">
              <span>Subtotal</span>
              <span>{formatPHP(total)}</span>
            </div>
            {coupon && (
              <div className="cart-total discount-row">
                <span>Discount ({coupon.code})</span>
                <span>-{formatPHP(coupon.discount)}</span>
              </div>
            )}
            <div className="cart-total cart-grand-total">
              <span>Total</span>
              <strong>{formatPHP(finalTotal)}</strong>
            </div>

            {savedAddresses.length > 0 && (
              <div className="field">
                <label htmlFor="savedAddr">Delivery address</label>
                <select id="savedAddr" value={selectedAddressId} onChange={(e) => pickAddress(e.target.value)}>
                  {savedAddresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {a.address.slice(0, 40)}{a.address.length > 40 ? '…' : ''}
                    </option>
                  ))}
                  <option value={NEW_ADDRESS}>+ Enter a new address</option>
                </select>
              </div>
            )}

            {(savedAddresses.length === 0 || selectedAddressId === NEW_ADDRESS) && (
              <div className="field">
                <label htmlFor="addr">{savedAddresses.length > 0 ? 'New delivery address' : 'Delivery address'}</label>
                <textarea id="addr" rows={2} required maxLength={250} value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label htmlFor="phone">Contact number</label>
              <input id="phone" type="tel" required maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="notes">Notes for the store (optional)</label>
              <input id="notes" type="text" maxLength={200} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <p className="muted small">Payment: Cash on Delivery</p>
            {error && <div className="message error">{error}</div>}

            <button type="submit" className="btn-primary" disabled={busy}>
              {busy && <Spinner light />}{busy ? 'Placing order...' : `Place Order · ${formatPHP(finalTotal)}`}
            </button>
            <button type="button" className="btn-ghost full" onClick={clear}>
              Clear cart
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}
