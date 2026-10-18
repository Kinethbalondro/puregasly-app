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
  const serverMessage = err.response?.data?.message;
  if (serverMessage) return serverMessage;
  if (!err.response) return 'Could not reach the server. Check your connection and try again.';
  // 502/503/504 come from the host, not our API - usually it is waking up after being idle.
  if ([502, 503, 504].includes(err.response.status)) {
    return 'The server is waking up or busy. Please try again in a few seconds.';
  }
  return fallback;
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
