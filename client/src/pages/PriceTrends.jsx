import { useEffect, useState } from 'react';
import api from '../api/axios';
import { errMsg, formatPHP } from '../utils/format';
import usePageTitle from '../utils/usePageTitle';

const CATEGORY_NAMES = { lpg: 'LPG Tank', refill: 'Refill', accessory: 'Accessory' };

function optionLabel(o) {
  const name = CATEGORY_NAMES[o.category] || o.category;
  return o.sizeKg ? `${name} ${o.sizeKg} kg` : name;
}

function Chart({ points }) {
  if (points.length === 0) return <p className="empty">No price data for this selection yet.</p>;

  const W = 720;
  const H = 280;
  const pad = { top: 20, right: 20, bottom: 40, left: 72 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const values = points.flatMap((p) => [p.min, p.max, p.avg]);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    lo = lo * 0.95;
    hi = hi * 1.05 || 1;
  }
  const span = hi - lo;
  lo = Math.max(0, lo - span * 0.08); // NEW: never below 0
  hi += span * 0.08;

  const x = (i) => pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v) => pad.top + innerH - ((v - lo) / (hi - lo)) * innerH;

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.avg)}`).join(' ');
  const band =
    points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.max)}`).join(' ') +
    ' ' +
    [...points].reverse().map((p, i) => `L ${x(points.length - 1 - i)} ${y(p.min)}`).join(' ') +
    ' Z';

  const ticks = 5;
  const gridValues = Array.from({ length: ticks }, (_, i) => lo + ((hi - lo) * i) / (ticks - 1));
  const labelEvery = Math.ceil(points.length / 7);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Average price over time">
      {gridValues.map((v, i) => (
        <g key={i}>
          <line x1={pad.left} x2={W - pad.right} y1={y(v)} y2={y(v)} stroke="currentColor" opacity="0.12" />
          <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.7">
            {formatPHP(v)}
          </text>
        </g>
      ))}

      <path d={band} fill="#6366f1" opacity="0.12" />
      <path d={line} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinejoin="round" />

      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={x(i)} cy={y(p.avg)} r="4" fill="#6366f1">
            <title>{`${p.label}: avg ${formatPHP(p.avg)} (low ${formatPHP(p.min)}, high ${formatPHP(p.max)})`}</title>
          </circle>
          {i % labelEvery === 0 && (
            <text x={x(i)} y={H - 14} textAnchor="middle" fontSize="11" fill="currentColor" opacity="0.7">
              {p.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function PriceTrends() {
  usePageTitle('Price Trends');
  const [period, setPeriod] = useState('weeks');
  const [selected, setSelected] = useState(null); // NEW: null = not chosen yet
  const [data, setData] = useState({ points: [], options: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const params = { period };
        if (selected) {
          const [category, sizeKg] = selected.split('|');
          params.category = category;
          if (sizeKg) params.sizeKg = sizeKg;
        }
        const res = await api.get('/prices/trends', { params });
        if (cancelled) return;
        setData(res.data);

        // NEW: first time, pick the first real product type automatically
        if (selected === null) {
          const opts = res.data.options || [];
          const pick =
            opts.find((o) => o.category === 'refill' && o.sizeKg === 11) ||
            opts.find((o) => o.category !== 'accessory') ||
            opts[0];
          setSelected(pick ? `${pick.category}|${pick.sizeKg ?? ''}` : '');
        }
      } catch (err) {
        if (!cancelled) setError(errMsg(err, 'Could not load price trends.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [period, selected]);

  const pts = data.points || [];
  const first = pts.length ? pts[0].avg : null;
  const last = pts.length ? pts[pts.length - 1].avg : null;
  const change = first && last ? ((last - first) / first) * 100 : null;

  return (
    <>
      <div className="hero">
        <div>
          <h1>Price Trends 📈</h1>
          <p>See how LPG prices moved over the past weeks and months.</p>
        </div>
      </div>

      <div className="filter-bar">
        <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value)}>
          <option value="">All products</option>
          {(data.options || []).map((o) => (
            <option key={`${o.category}|${o.sizeKg ?? ''}`} value={`${o.category}|${o.sizeKg ?? ''}`}>
              {optionLabel(o)}
            </option>
          ))}
        </select>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={period === 'weeks' ? 'active' : ''} onClick={() => setPeriod('weeks')}>
            Weekly
          </button>
          <button className={period === 'months' ? 'active' : ''} onClick={() => setPeriod('months')}>
            Monthly
          </button>
        </div>
      </div>

      {error && <div className="message error">{error}</div>}

      <div className="panel">
        {loading ? (
          <p className="muted">Loading...</p>
        ) : (
          <>
            {change !== null && (
              <p className="small">
                Average price is{' '}
                <strong className={change > 0 ? 'text-danger' : change < 0 ? 'text-warn' : ''}>
                  {change > 0 ? '▲' : change < 0 ? '▼' : '•'} {Math.abs(change).toFixed(1)}%
                </strong>{' '}
                over this period ({formatPHP(first)} → {formatPHP(last)}).
              </p>
            )}
            <Chart points={pts} />
            <p className="muted small">The line is the average price. The shaded area shows the lowest to highest price.</p>
          </>
        )}
      </div>
    </>
  );
}