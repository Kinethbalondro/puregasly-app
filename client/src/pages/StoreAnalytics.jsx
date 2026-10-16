import { useEffect, useState } from 'react';
import api from '../api/axios';
import AppShell from '../components/AppShell';
import { errMsg, formatPHP, STATUS_LABELS } from '../utils/format';
import RatingStars from '../components/RatingStars';
import usePageTitle from '../utils/usePageTitle';
import { toCSV, downloadCSV } from '../utils/csv';

function BarChart({ series }) {
  const max = Math.max(1, ...series.map((d) => d.revenue));
  const W = 600;
  const H = 180;
  const gap = 2;
  const bw = W / series.length - gap;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Revenue per day">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H - H * f} y2={H - H * f} className="grid-line" />
        ))}
        {series.map((d, i) => {
          const h = (d.revenue / max) * (H - 4);
          return (
            <rect
              key={d.date}
              x={i * (bw + gap)}
              y={H - h}
              width={bw}
              height={Math.max(h, d.revenue > 0 ? 2 : 0)}
              rx="2"
              className="bar"
              style={{ animationDelay: `${Math.min(i * 15, 400)}ms` }}
            >
              <title>{`${d.date}: ${formatPHP(d.revenue)} (${d.orders} orders)`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="chart-axis">
        <span>{series[0]?.date}</span>
        <span>peak {formatPHP(max === 1 && series.every((d) => d.revenue === 0) ? 0 : max)}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export default function StoreAnalytics() {
  usePageTitle('Analytics');
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .get('/analytics/summary', { params: { days } })
      .then((res) => !cancelled && setData(res.data))
      .catch((err) => !cancelled && setError(errMsg(err, 'Could not load analytics.')));
    return () => {
      cancelled = true;
    };
  }, [days]);

  useEffect(() => {
    api.get('/reviews/store').then((res) => setReviews(res.data)).catch(() => setReviews([]));
  }, []);

  const avgRating = reviews && reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null;

  const statusTotal = data ? Object.values(data.statusBreakdown).reduce((a, b) => a + b, 0) : 0;

  function exportCSV() {
    if (!data) return;
    const csv = toCSV(
      [
        { key: 'date', label: 'Date' },
        { key: 'revenue', label: 'Revenue' },
        { key: 'orders', label: 'Orders' },
      ],
      data.series
    );
    downloadCSV(`analytics-${days}d-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return (
    <AppShell wide>
      <div className="page-head">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="muted small">Sales count once an order is marked Delivered.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="tabs compact">
            {[7, 30, 90].map((d) => (
              <button key={d} className={days === d ? 'active' : ''} onClick={() => setDays(d)}>
                {d} days
              </button>
            ))}
          </div>
          <button className="btn-ghost" disabled={!data} onClick={exportCSV}>⬇ Export CSV</button>
        </div>
      </div>

      {error && <div className="message error">{error}</div>}
      {!data && !error && (
        <div className="kpi-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="kpi skeleton-row">
              <span className="skeleton-block" style={{ width: '50%', height: 10 }} />
              <span className="skeleton-block" style={{ width: '70%', height: 20, marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="kpi-grid">
            <div className="kpi accent"><span>Today's revenue</span><strong>{formatPHP(data.today.revenue)}</strong><em>{data.today.orders} orders</em></div>
            <div className="kpi"><span>Last {days} days</span><strong>{formatPHP(data.period.revenue)}</strong><em>{data.period.orders} orders</em></div>
            <div className="kpi"><span>All-time revenue</span><strong>{formatPHP(data.totals.revenue)}</strong><em>{data.totals.completedOrders} completed</em></div>
            <div className="kpi"><span>Avg. order value</span><strong>{formatPHP(data.totals.avgOrderValue)}</strong></div>
            <div className="kpi"><span>Units sold</span><strong>{data.totals.unitsSold}</strong></div>
            <div className={`kpi ${data.totals.newOrders ? 'warn' : ''}`}><span>New orders</span><strong>{data.totals.newOrders}</strong><em>{data.totals.activeOrders} in progress</em></div>
          </div>

          <div className="panel">
            <h3>Revenue per day</h3>
            <BarChart series={data.series} />
          </div>

          <div className="two-col">
            <div className="panel">
              <h3>Top products</h3>
              {data.topProducts.length === 0 ? (
                <p className="empty small">No sales in this period yet.</p>
              ) : (
                <ol className="rank-list">
                  {data.topProducts.map((p, i) => (
                    <li key={i}>
                      <span><strong>{p.name}</strong>{p.brand && <span className="muted small"> · {p.brand}</span>}</span>
                      <span>{p.units} sold · {formatPHP(p.revenue)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="panel">
              <h3>Orders by status</h3>
              {statusTotal === 0 ? (
                <p className="empty small">No orders yet.</p>
              ) : (
                Object.entries(data.statusBreakdown).map(([s, n]) => (
                  <div key={s} className="hbar">
                    <span>{STATUS_LABELS[s]}</span>
                    <div className="hbar-track"><div className={`hbar-fill ${s}`} style={{ width: `${(n / statusTotal) * 100}%` }} /></div>
                    <span>{n}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <h3>Inventory health</h3>
            <div className="chip-row">
              <span className="chip">{data.inventory.totalProducts} products</span>
              <span className="chip">{data.inventory.totalUnits} units</span>
              <span className="chip">{formatPHP(data.inventory.stockValue)} stock value</span>
              <span className="chip">{data.inventory.onPromo} on sale</span>
              {data.inventory.outOfStock > 0 && <span className="chip danger">{data.inventory.outOfStock} out of stock</span>}
            </div>
            {data.inventory.lowStock.length > 0 && (
              <>
                <h4>Running low</h4>
                <ul className="rank-list">
                  {data.inventory.lowStock.map((p) => (
                    <li key={p.id}>
                      <span><strong>{p.name}</strong>{p.brand && <span className="muted small"> · {p.brand}</span>}</span>
                      <span className="text-warn">{p.stock} left (alert at {p.lowStockAt})</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3>Customer reviews</h3>
              {avgRating != null && <RatingStars value={avgRating} count={reviews.length} />}
            </div>
            {!reviews ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className="skeleton-block" style={{ width: '100%', height: 14 }} />
                ))}
              </div>
            ) : reviews.length === 0 ? (
              <p className="empty small">No reviews yet.</p>
            ) : (
              <div className="review-list">
                {reviews.map((r) => (
                  <div key={r.id} className="review-item">
                    <div className="review-head">
                      <strong>{r.customerName}</strong>
                      <RatingStars value={r.rating} size="sm" />
                    </div>
                    {r.comment && <p className="small">{r.comment}</p>}
                    <span className="muted small">Order {r.orderNo}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  );
}
