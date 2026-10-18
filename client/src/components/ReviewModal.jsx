import { useState } from 'react';
import api from '../api/axios';
import { errMsg } from '../utils/format';

export default function ReviewModal({ order, onClose, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  // Rider rating is optional: null means "not rated"
  const [riderRating, setRiderRating] = useState(null);
  const [riderComment, setRiderComment] = useState('');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const hasRider = !!order.rider;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = { orderId: order.id, rating, comment };
      if (hasRider && riderRating) {
        body.riderRating = riderRating;
        body.riderComment = riderComment;
      }
      await api.post('/reviews', body);
      onSubmitted();
      onClose();
    } catch (err) {
      setError(errMsg(err, 'Could not submit your review.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Rate {order.storeName}</h3>
        <p className="muted small">Order {order.orderNo}</p>

        <div className="star-picker">
          {[1, 2, 3, 4, 5].map((i) => (
            <button type="button" key={i} className={i <= rating ? 'star-btn on' : 'star-btn'} onClick={() => setRating(i)}>
              ★
            </button>
          ))}
        </div>

        <textarea
          rows={3}
          maxLength={500}
          placeholder="How was the store and delivery? (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        {hasRider && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(128,128,128,0.3)' }}>
            <h3 style={{ margin: 0 }}>Rate your rider</h3>
            <p className="muted small">🛵 {order.rider.name} (optional)</p>

            <div className="star-picker">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  type="button"
                  key={i}
                  className={riderRating && i <= riderRating ? 'star-btn on' : 'star-btn'}
                  onClick={() => setRiderRating(i)}
                  aria-label={`${i} star${i > 1 ? 's' : ''} for the rider`}
                >
                  ★
                </button>
              ))}
              {riderRating && (
                <button
                  type="button"
                  className="btn-ghost small"
                  onClick={() => {
                    setRiderRating(null);
                    setRiderComment('');
                  }}
                  style={{ marginLeft: 8 }}
                >
                  Clear
                </button>
              )}
            </div>

            {riderRating && (
              <textarea
                rows={2}
                maxLength={500}
                placeholder="How was the delivery? (optional)"
                value={riderComment}
                onChange={(e) => setRiderComment(e.target.value)}
              />
            )}
          </div>
        )}

        {error && <div className="message error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-solid" disabled={busy}>
            {busy ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </form>
    </div>
  );
}