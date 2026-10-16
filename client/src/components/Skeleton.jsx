// A gently shimmering placeholder block, used instead of bare "Loading..."
// text wherever a grid/list is the main content of a page.
export function SkeletonBlock({ width = '100%', height = 16, style, round = 6 }) {
  return <span className="skeleton-block" style={{ width, height, borderRadius: round, ...style }} />;
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <SkeletonBlock width="60%" height={14} />
      <SkeletonBlock width="40%" height={11} style={{ marginTop: 10 }} />
      <SkeletonBlock width="100%" height={11} style={{ marginTop: 14 }} />
      <SkeletonBlock width="70%" height={11} style={{ marginTop: 8 }} />
    </div>
  );
}

export function SkeletonGrid({ count = 6, grid = 'product' }) {
  return (
    <div className={grid === 'store' ? 'store-grid' : 'product-grid'}>
      {Array.from({ length: count }).map((_, i) =>
        grid === 'store' ? (
          <div key={i} className="skeleton-card" style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <SkeletonBlock width={48} height={48} round={14} />
            <div style={{ flex: 1 }}>
              <SkeletonBlock width="50%" height={14} />
              <SkeletonBlock width="70%" height={11} style={{ marginTop: 8 }} />
            </div>
          </div>
        ) : (
          <SkeletonCard key={i} />
        )
      )}
    </div>
  );
}

export function SkeletonRows({ count = 4 }) {
  return (
    <div className="row-list">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="row-item skeleton-row">
          <div style={{ flex: 1 }}>
            <SkeletonBlock width="35%" height={13} />
            <SkeletonBlock width="55%" height={11} style={{ marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
