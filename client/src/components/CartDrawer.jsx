import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { errMsg, formatPHP } from '../utils/format';
import Spinner from './Spinner';

const NEW_ADDRESS = '__new__';

// Delivery time slots: 2 hours each, Philippine time.
const SLOT_START_HOURS = [6, 8, 10, 12, 14, 16, 18];
const SLOT_MS = 2 * 60 * 60 * 1000;
const MIN_LEAD_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const dayLabelFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  hour: 'numeric',
  minute: '2-digit',
});

// The days (next 7) and time slots a customer can still pick right now.
function buildDays() {
  const now = Date.now();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(now + i * DAY_MS);
    const value = dateFmt.format(day); // e.g. 2026-10-19
    const slots = SLOT_START_HOURS.map((h) => {
      const start = new Date(`${value}T${String(h).padStart(2, '0')}:00:00+08:00`);
      const end = new Date(start.getTime() + SLOT_MS);
      return { hour: h, start, label: `${timeFmt.format(start)} - ${timeFmt.format(end)}` };
    }).filter((s) => s.start.getTime() >= now + MIN_LEAD_MS);

    if (slots.length > 0) {
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : dayLabelFmt.format(day);
      days.push({ value, label, slots });
    }
  }
  return days;
}

// Returns the number if it is a valid coordinate, otherwise null.
function pinValue(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

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
  // Map pin of the chosen saved address (null when typing a new address)
  const [pin, setPin] = useState({ lat: null, lng: null });
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Delivery time: 'asap' or 'scheduled' (a day + a 2-hour slot)
  const [timeType, setTimeType] = useState('asap');
  const [slotDate, setSlotDate] = useState('');
  const [slotHour, setSlotHour] = useState('');

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
          setPin({ lat: pinValue(def.lat), lng: pinValue(def.lng) });
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
      setPin({ lat: null, lng: null });
      return;
    }
    const a = savedAddresses.find((x) => x.id === id);
    if (a) {
      setAddress(a.address);
      setPhone(a.contactNumber);
      setPin({ lat: pinValue(a.lat), lng: pinValue(a.lng) });
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

  // --- FREE DELIVERY LOGIC ---
  const deliveryFee = 0; // Laging libre ang delivery sa lahat ng orders at produkto
  
  // Final total kasama ang delivery fee at bawas ng coupon discount kung meron
  const finalTotal = Math.max(0, total + deliveryFee - (coupon?.discount || 0));

  const hasPin = pin.lat !== null && pin.lng !== null;

  // Time slot choices (recomputed each render so past slots drop off).
  const days = buildDays();
  const selectedDay = days.find((d) => d.value === slotDate) || days[0] || null;
  const selectedSlot = selectedDay
    ? selectedDay.slots.find((s) => String(s.hour) === slotHour) || null
    : null;

  async function placeOrder(e) {
    e.preventDefault();
    setError('');

    if (timeType === 'scheduled' && !selectedSlot) {
      setError('Please choose a delivery day and time slot, or pick ASAP.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/orders', {
        items: cart.items.map((i) => ({ productId: i.productId, qty: i.qty })),
        deliveryAddress: address,
        contactNumber: phone,
        deliveryLat: hasPin ? pin.lat : undefined,
        deliveryLng: hasPin ? pin.lng : undefined,
        deliveryTimeType: timeType,
        scheduledFor: timeType === 'scheduled' ? selectedSlot.start.toISOString() : undefined,
        notes,
        couponCode: coupon?.code || undefined,
      });
      localStorage.setItem('pg_delivery', JSON.stringify({ address, phone }));
      clear();
      setNotes('');
      setCoupon(null);
      setCouponCode('');
      setTimeType('asap');
      setSlotDate('');
      setSlotHour('');
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
            
            {/* Delivery Fee Display */}
            <div className="cart-total">
              <span>Delivery Fee</span>
              <span>
                <strong style={{ color: '#22c55e' }}>FREE</strong>
              </span>
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
                {hasPin && selectedAddressId !== NEW_ADDRESS && (
                  <p className="muted small" style={{ marginTop: 6 }}>📍 Map pin included</p>
                )}
              </div>
            )}

            {(savedAddresses.length === 0 || selectedAddressId === NEW_ADDRESS) && (
              <div className="field">
                <label htmlFor="addr">{savedAddresses.length > 0 ? 'New delivery address' : 'Delivery address'}</label>
                <textarea id="addr" rows={2} required maxLength={250} value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            )}

            <div className="field">
              <label>Delivery time</label>
              <div className="tabs compact" style={{ marginBottom: 8 }}>
                <button
                  type="button"
                  className={timeType === 'asap' ? 'active' : ''}
                  onClick={() => setTimeType('asap')}
                >
                  ASAP
                </button>
                <button
                  type="button"
                  className={timeType === 'scheduled' ? 'active' : ''}
                  onClick={() => setTimeType('scheduled')}
                >
                  Pick a time
                </button>
              </div>

              {timeType === 'asap' ? (
                <p className="muted small">The store will deliver as soon as possible.</p>
              ) : selectedDay ? (
                <>
                  <select
                    aria-label="Delivery day"
                    value={selectedDay.value}
                    onChange={(e) => {
                      setSlotDate(e.target.value);
                      setSlotHour('');
                    }}
                    style={{ marginBottom: 8 }}
                  >
                    {days.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Delivery time slot"
                    value={selectedSlot ? String(selectedSlot.hour) : ''}
                    onChange={(e) => setSlotHour(e.target.value)}
                  >
                    <option value="">Choose a time slot</option>
                    {selectedDay.slots.map((s) => (
                      <option key={s.hour} value={String(s.hour)}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <p className="muted small">No time slots are available right now. Please pick ASAP.</p>
              )}
            </div>

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