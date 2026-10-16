import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import { ProductCard, StoreCard } from './dashboards/CustomerDashboard';
import { SkeletonGrid } from '../components/Skeleton';
import usePageTitle from '../utils/usePageTitle';
import { errMsg } from '../utils/format';

export default function Favorites() {
  usePageTitle('Favorites');
  const navigate = useNavigate();
  const [tab, setTab] = useState('stores');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  function load() {
    api
      .get('/favorites')
      .then((res) => setData(res.data))
      .catch((err) => setError(errMsg(err, 'Could not load your favorites.')));
  }

  useEffect(load, []);

  return (
    <AppShell wide>
      <h1 className="page-title">Favorites</h1>
      <p className="muted small" style={{ marginBottom: 20 }}>
        Stores and products you've saved with the heart icon.
      </p>

      <div className="tabs">
        <button className={tab === 'stores' ? 'active' : ''} onClick={() => setTab('stores')}>
          🏪 Stores {data ? `(${data.stores.length})` : ''}
        </button>
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
          🔥 Products {data ? `(${data.products.length})` : ''}
        </button>
      </div>

      {error && <div className="message error">{error}</div>}

      {!data ? (
        <SkeletonGrid count={4} grid={tab === 'stores' ? 'store' : 'product'} />
      ) : tab === 'stores' ? (
        data.stores.length === 0 ? (
          <p className="empty">No favorite stores yet. Tap 🤍 on a store to save it here.</p>
        ) : (
          <div className="store-grid">
            {data.stores.map((s) => (
              <StoreCard
                key={s.id}
                s={{ ...s, productCount: 0, minPrice: null, promoCount: 0, totalSold: 0, avgRating: null }}
                onOpen={() => navigate('/dashboard', { state: { openStoreId: s.id } })}
              />
            ))}
          </div>
        )
      ) : data.products.length === 0 ? (
        <p className="empty">No favorite products yet. Tap 🤍 on a product to save it here.</p>
      ) : (
        <div className="product-grid">
          {data.products.map((p) => (
            <ProductCard key={p.id} p={p} onOpenStore={(id) => navigate('/dashboard', { state: { openStoreId: id } })} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
