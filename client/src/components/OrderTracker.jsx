import { STATUS_LABELS } from '../utils/format';

const STEPS = ['pending', 'preparing', 'out_for_delivery', 'delivered', 'received'];
const STEP_LABELS = {
  pending: 'Placed',
  preparing: 'Preparing',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  received: 'Received',
};

export default function OrderTracker({ status }) {
  if (status === 'cancelled') {
    return <span className="status-pill cancelled">Cancelled</span>;
  }
  const current = STEPS.indexOf(status);

  return (
    <div className="tracker" aria-label={`Order status: ${STATUS_LABELS[status]}`}>
      {STEPS.map((s, i) => (
        <div key={s} className={`tracker-step ${i < current ? 'done' : ''} ${i === current ? 'current' : ''}`}>
          <div className="tracker-dot">{i < current ? '✓' : i + 1}</div>
          <div className="tracker-label">{STEP_LABELS[s]}</div>
        </div>
      ))}
    </div>
  );
}
