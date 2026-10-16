import { useState } from 'react';
import api from '../api/axios';
import { errMsg } from '../utils/format';

export default function ReviewModal({ order, onClose, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/reviews', { orderId: order.id, rating, comment });
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
