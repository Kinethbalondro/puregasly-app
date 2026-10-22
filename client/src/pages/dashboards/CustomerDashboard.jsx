import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../api/axios';
import { useCart } from '../../context/CartContext';
import { CATEGORY_LABELS, errMsg, formatPHP } from '../../utils/format';
import RatingStars from '../../components/RatingStars';
import { SkeletonGrid } from '../../components/Skeleton';
import usePageTitle from '../../utils/usePageTitle';
import { useFavorites } from '../../context/FavoritesContext';
import ReportModal from '../../components/ReportModal'; // NEW

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// The PROMO badge and the heart sit inside the card's top row,
// so they never overlap each other or the Add to cart button.
const PROMO_BADGE = {
  position: 'static',
  top: 'auto',
  right: 'auto',
  bottom: 'auto',
  left: 'auto',
  transform: 'none',
  clipPath: 'none',
  width: 'auto',
  height: 'auto',
  margin: 0,
  padding: '2px 8px',
  borderRadius: 999,
  display: 'inline-block',
  fontSize: 11,
  lineHeight: 1.5,
  whiteSpace: 'nowrap',
  zIndex: 'auto',
};

const FAV_INLINE = {
  position: 'static',
  top: 'auto',
  right: 'auto',
  bottom: 'auto',
  left: 'auto',
  margin: 0,
  flexShrink: 0,
};

// Product photo (or a placeholder so cards stay the same height).
const PHOTO_BOX = {
  width: '100%',
  height: 130,
  borderRadius: 10,
  overflow: 'hidden',
  margin: '8px 0',
  background: 'rgba(127,127,127,0.12)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 38,
};

function ProductPhoto({ image, name }) {
  const [failed, setFailed] = useState(false);
  const base = String(api.defaults.baseURL || '/api').replace(/\/$/, '');

  return (
    <div style={PHOTO_BOX}>
      {image && !failed ? (
        <img
          src={`${base}/media/${image}`}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span aria-hidden="true">🛢️</span>
      )}
    </div>
  );
}

export function ProductCard({ p, onOpenStore }) {
  const { addItem } = useCart();
  const favorites = useFavorites();
  const out = p.stock === 0;
  const faved = favorites?.isFavorite('product', p.id);

  return (
    <div className={`product-card ${out ? 'is-out' : ''}`}>
      <div
        className="product-top"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <span className="cat-tag">{CATEGORY_LABELS[p.category] || 'LPG'}</span>

        {/* Right side: sold count, then PROMO, then the heart (PROMO sits just left of the heart) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span className="muted small" style={{ whiteSpace: 'nowrap' }}>
            {p.sold} sold
          </span>
          {p.onPromo && (
            <span className="ribbon" style={PROMO_BADGE}>
              PROMO
            </span>
          )}
          <button
            className={`fav-btn ${faved ? 'faved' : ''}`}
            style={FAV_INLINE}
            onClick={(e) => {
              e.stopPropagation();
              favorites?.toggle('product', p.id);
            }}
            aria-label={faved ? 'Remove from favorites' : 'Add to favorites'}
          >
            {faved ? '❤️' : '🤍'}
          </button>
        </div>
      </div>
      <ProductPhoto image={p.image} name={p.name} />
      <h3>{p.name}</h3>
      <p className="muted small">{[p.brand, p.sizeKg ? `${p.sizeKg} kg` : null].filter(Boolean).join(' · ') || '—'}</p>
      {onOpenStore && (
        <button className="link-btn" onClick={() => onOpenStore(p.storeId)}>
          🏪 {p.storeName}
        </button>
      )}
      <div className="price-row">
        <strong className="price">{formatPHP(p.effectivePrice)}</strong>
        {p.onPromo && <s className="muted small">{formatPHP(p.price)}</s>}
      </div>
      <div className="product-foot">
        <span className={`small ${out ? 'text-danger' : p.stock <= 5 ? 'text-warn' : 'muted'}`}>
          {out ? 'Out of stock' : `${p.stock} in stock`}
        </span>
        <button className="btn-solid small" disabled={out} onClick={() => addItem(p, 1)}>
          Add to cart
        </button>
      </div>
    </div>
  );
}

export function StoreCard({ s, onOpen }) {
  const favorites = useFavorites();
  const faved = favorites?.isFavorite('store', s.id);

  return (
    <div className="store-card">
      <button
        className={`fav-btn ${faved ? 'faved' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          favorites?.toggle('store', s.id);
        }}
        aria-label={faved ? 'Remove from favorites' : 'Add to favorites'}
      >
        {faved ? '❤️' : '🤍'}
      </button>
      <button className="store-card-inner" onClick={() => onOpen(s.id)}>
      <div className="store-avatar">{s.name.charAt(0).toUpperCase()}</div>
      <div className="store-info">
        <h3>{s.name}</h3>
        <p className="muted small">{s.address || 'No address listed'}</p>
        <RatingStars value={s.avgRating} count={s.reviewCount} size="sm" />
        <div className="chip-row">
          <span className="chip">{s.productCount} products</span>
          {s.minPrice != null && <span className="chip">from {formatPHP(s.minPrice)}</span>}
          {s.promoCount > 0 && <span className="chip promo">🔥 {s.promoCount} promo</span>}
          <span className="chip">{s.totalSold} sold</span>
        </div>
      </div>
      </button>
    </div>
  );
}

export default function CustomerDashboard({ user }) {
  usePageTitle('Shop');
  const location = useLocation();
  const [tab, setTab] = useState('stores'); // stores | products
  const [openStoreId, setOpenStoreId] = useState(location.state?.openStoreId || null);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('');
  const [promoOnly, setPromoOnly] = useState(false);
  const [category, setCategory] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [storeDetail, setStoreDetail] = useState(null);
  const [reporting, setReporting] = useState(false); // NEW
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const q = useDebounced(search);
  const minP = useDebounced(minPrice, 500);
  const maxP = useDebounced(maxPrice, 500);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        if (openStoreId) {
          const res = await api.get(`/shop/stores/${openStoreId}`);
          if (!cancelled) setStoreDetail(res.data);
        } else if (tab === 'stores') {
          const res = await api.get('/shop/stores', {
            params: { search: q, sort: sort || 'name', promo: promoOnly ? 'true' : undefined },
          });
          if (!cancelled) setStores(res.data);
        } else {
          const res = await api.get('/shop/products', {
            params: {
              search: q,
              sort: sort || 'price_asc',
              promo: promoOnly ? 'true' : undefined,
              category: category || undefined,
              minPrice: minP || undefined,
              maxPrice: maxP || undefined,
            },
          });
          if (!cancelled) setProducts(res.data);
        }
      } catch (err) {
        if (!cancelled) setError(errMsg(err, 'Could not load the shop.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [tab, openStoreId, q, sort, promoOnly, category, minP, maxP]);

  function openStore(id) {
    setStoreDetail(null);
    setSearch('');
    setPromoOnly(false);
    setOpenStoreId(id);
  }

  function switchTab(t) {
    setOpenStoreId(null);
    setTab(t);
    setSort('');
  }

  // ---------- single store view ----------
  if (openStoreId) {
    const visible = (storeDetail?.products || []).filter(
      (p) =>
        (!q || `${p.name} ${p.brand}`.toLowerCase().includes(q.toLowerCase())) &&
        (!promoOnly || p.onPromo)
    );
    return (
      <>
        <button className="link-btn back" onClick={() => setOpenStoreId(null)}>
          ← Back to browsing
        </button>
        {error && <div className="message error">{error}</div>}
        {storeDetail && (
          <>
            <div className="panel store-header">
              <div className="store-avatar big">{storeDetail.store.name.charAt(0).toUpperCase()}</div>
              <div>
                <h1>{storeDetail.store.name}</h1>
                <RatingStars value={storeDetail.store.avgRating} count={storeDetail.store.reviewCount} />
                <p className="muted small">
                  {[storeDetail.store.address, storeDetail.store.phone].filter(Boolean).join(' · ') || 'No contact info yet'}
                </p>
                {storeDetail.store.description && <p className="small">{storeDetail.store.description}</p>}
                {/* NEW: Report button */}
                <button className="btn-danger-outline small" onClick={() => setReporting(true)}>
                  🚩 Report this store
                </button>
              </div>
            </div>
            <div className="filter-bar">
              <input placeholder="Search this store..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <label className="toggle">
                <input type="checkbox" checked={promoOnly} onChange={(e) => setPromoOnly(e.target.checked)} /> Promos only
              </label>
            </div>
            {visible.length === 0 ? (
              <p className="empty">No products match.</p>
            ) : (
              <div className="product-grid">
                {visible.map((p) => (
                  <ProductCard key={p.id} p={p} />
                ))}
              </div>
            )}

            {storeDetail.reviews && storeDetail.reviews.length > 0 && (
              <div className="panel">
                <h3>Recent reviews</h3>
                <div className="review-list">
                  {storeDetail.reviews.map((r) => (
                    <div key={r.id} className="review-item">
                      <div className="review-head">
                        <strong>{r.customerName}</strong>
                        <RatingStars value={r.rating} size="sm" />
                      </div>
                      {r.comment && <p className="small">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {loading && !storeDetail && <SkeletonGrid count={6} />}
        {/* NEW: Report popup */}
        {reporting && storeDetail && (
          <ReportModal
            storeId={storeDetail.store.id}
            storeName={storeDetail.store.name}
            onClose={() => setReporting(false)}
          />
        )}
      </>
    );
  }

  // ---------- browse view ----------
  return (
    <>
      <div className="hero">
        <div>
          <h1>Hi {user.name.split(' ')[0]} 👋</h1>
          <p>Find LPG from stores near you and get it delivered.</p>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === 'stores' ? 'active' : ''} onClick={() => switchTab('stores')}>
          🏪 Browse Stores
        </button>
        <button className={tab === 'products' ? 'active' : ''} onClick={() => switchTab('products')}>
          🔥 LPG Products
        </button>
      </div>

      <div className="filter-bar">
        <input
          placeholder={tab === 'stores' ? 'Search stores...' : 'Search LPG, brand...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          {tab === 'stores' ? (
            <>
              <option value="">Sort: Name (A–Z)</option>
              <option value="price_asc">Lowest price first</option>
              <option value="price_desc">Highest price first</option>
              <option value="sales_desc">Highest sales</option>
              <option value="sales_asc">Lowest sales</option>
              <option value="rating_desc">Highest rated</option>
            </>
          ) : (
            <>
              <option value="">Sort: Lowest price</option>
              <option value="price_desc">Highest price first</option>
              <option value="sales_desc">Highest sales</option>
              <option value="sales_asc">Lowest sales</option>
              <option value="newest">Newest</option>
            </>
          )}
        </select>
        {tab === 'products' && (
          <>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All types</option>
              <option value="lpg">LPG Tank</option>
              <option value="refill">Refill</option>
              <option value="accessory">Accessory</option>
            </select>
            <input className="price-input" type="number" min="0" placeholder="Min ₱" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
            <input className="price-input" type="number" min="0" placeholder="Max ₱" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          </>
        )}
        <label className="toggle">
          <input type="checkbox" checked={promoOnly} onChange={(e) => setPromoOnly(e.target.checked)} /> 🔥 Promos only
        </label>
      </div>

      {error && <div className="message error">{error}</div>}
      {loading ? (
        <SkeletonGrid count={tab === 'stores' ? 4 : 8} grid={tab === 'stores' ? 'store' : 'product'} />
      ) : tab === 'stores' ? (
        stores.length === 0 ? (
          <p className="empty">No stores found.</p>
        ) : (
          <div className="store-grid">
            {stores.map((s) => (
              <StoreCard key={s.id} s={s} onOpen={openStore} />
            ))}
          </div>
        )
      ) : products.length === 0 ? (
        <p className="empty">No products found.</p>
      ) : (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} p={p} onOpenStore={openStore} />
          ))}
        </div>
      )}
    </>
  );
}