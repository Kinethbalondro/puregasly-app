export default function RatingStars({ value, count, size = 'md' }) {
  if (value == null) return <span className="muted small">No ratings yet</span>;
  const full = Math.round(value);
  return (
    <span className={`rating-stars ${size}`} title={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= full ? 'star on' : 'star'}>★</span>
      ))}
      <span className="rating-value">{value.toFixed(1)}</span>
      {count != null && <span className="muted small"> ({count})</span>}
    </span>
  );
}
