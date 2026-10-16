// Shared branding panel for Login/Register - a proper split-screen side
// instead of the old centered-box-on-a-gradient look.
export default function AuthVisual() {
  return (
    <div className="auth-visual">
      <div className="auth-visual-glow" />
      <div className="auth-visual-glow glow-2" />

      {/* Slowly drifting decorative icons - purely for depth/motion, not interactive. */}
      <span className="auth-float f1" aria-hidden="true">🔥</span>
      <span className="auth-float f2" aria-hidden="true">🛵</span>
      <span className="auth-float f3" aria-hidden="true">🏪</span>
      <span className="auth-float f4" aria-hidden="true">💧</span>

      <div className="auth-visual-inner">
        <div className="brand auth-reveal" style={{ animationDelay: '0ms' }}>
          <span className="brand-badge">
            <img src="/assets/logo-transparent.png" alt="PureGasly logo" />
          </span>
          <span>PureGasly</span>
        </div>

        <h1 className="auth-reveal" style={{ animationDelay: '80ms' }}>LPG delivery, made simple.</h1>
        <p className="auth-reveal" style={{ animationDelay: '160ms' }}>
          Order from trusted local stores, track every delivery in real time, and never run out of gas again.
        </p>

        <ul className="auth-highlights">
          <li className="auth-reveal" style={{ animationDelay: '240ms' }}>
            <span className="auth-highlight-icon pulse-icon">🔥</span>
            <div>
              <strong>Live order tracking</strong>
              <span className="auth-live-track">
                <em className="done">Preparing</em>
                <i />
                <em className="done">Out for delivery</em>
                <i />
                <em className="current">Delivered</em>
              </span>
            </div>
          </li>
          <li className="auth-reveal" style={{ animationDelay: '320ms' }}>
            <span className="auth-highlight-icon">🏪</span>
            <div>
              <strong>Multiple verified stores</strong>
              <span>Compare prices, promos, and ratings</span>
            </div>
          </li>
          <li className="auth-reveal" style={{ animationDelay: '400ms' }}>
            <span className="auth-highlight-icon">🎟️</span>
            <div>
              <strong>Exclusive coupons</strong>
              <span>Save on your next refill</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
