export function formatPHP(n) {
  return '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateTime(d) {
  return new Date(d).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

export const STATUS_LABELS = {
  pending: 'New',
  preparing: 'Preparing',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  received: 'Received',
  cancelled: 'Cancelled',
};

export const CATEGORY_LABELS = { lpg: 'LPG Tank', refill: 'Refill', accessory: 'Accessory' };

export function errMsg(err, fallback = 'Something went wrong.') {
  return err.response?.data?.message || (err.response ? fallback : 'Could not reach the server.');
}

// Triggers a browser download from an axios blob response.
export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
