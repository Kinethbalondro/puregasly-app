const PDFDocument = require('pdfkit');
const { formatPHP, formatDateTime } = require('./helpers');

// Builds a simple one-page receipt PDF and returns the (still-streaming)
// PDFDocument. Caller is responsible for piping it to the response.
function renderReceiptPdf(order, store) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  doc.fontSize(20).fillColor('#3457c9').text('PureGasly', { continued: false });
  doc.fontSize(11).fillColor('#444').text('Order Receipt').moveDown(1);

  doc.fontSize(10).fillColor('#000');
  doc.text(`Order No: ${order.orderNo}`);
  doc.text(`Date: ${formatDateTime(order.createdAt)}`);
  doc.text(`Store: ${store?.name || ''}`);
  if (store?.address) doc.text(`Store address: ${store.address}`);
  doc.text(`Status: ${labelStatus(order.status)}`);
  doc.moveDown(1);

  doc.text(`Delivery address: ${order.deliveryAddress}`);
  doc.text(`Contact number: ${order.contactNumber}`);
  doc.text(`Payment method: ${order.paymentMethod}`);
  doc.moveDown(1);

  // Items table (simple, text-based - no external assets needed).
  const startY = doc.y;
  doc.font('Helvetica-Bold');
  doc.text('Item', 50, startY, { width: 250 });
  doc.text('Qty', 300, startY, { width: 50, align: 'right' });
  doc.text('Unit Price', 350, startY, { width: 90, align: 'right' });
  doc.text('Subtotal', 440, startY, { width: 100, align: 'right' });
  doc.font('Helvetica');
  doc.moveDown(0.5);
  doc.moveTo(50, doc.y).lineTo(540, doc.y).strokeColor('#ccc').stroke();
  doc.moveDown(0.3);

  order.items.forEach((it) => {
    const y = doc.y;
    const label = [it.name, it.brand, it.sizeKg ? `${it.sizeKg} kg` : null].filter(Boolean).join(' - ');
    doc.text(label, 50, y, { width: 250 });
    doc.text(String(it.qty), 300, y, { width: 50, align: 'right' });
    doc.text(formatPHP(it.unitPrice), 350, y, { width: 90, align: 'right' });
    doc.text(formatPHP(it.unitPrice * it.qty), 440, y, { width: 100, align: 'right' });
    doc.moveDown(0.6);
  });

  doc.moveTo(50, doc.y).lineTo(540, doc.y).strokeColor('#ccc').stroke();
  doc.moveDown(0.5);

  if (order.discount > 0) {
    doc.text(`Subtotal: ${formatPHP(order.subtotal)}`, { align: 'right' });
    doc.text(`Discount${order.couponCode ? ` (${order.couponCode})` : ''}: -${formatPHP(order.discount)}`, { align: 'right' });
    doc.moveDown(0.2);
  }
  doc.font('Helvetica-Bold').text(`Total: ${formatPHP(order.total)}`, { align: 'right' });
  doc.font('Helvetica');

  doc.moveDown(2);
  doc.fontSize(8).fillColor('#888').text('This receipt was generated automatically by PureGasly.', { align: 'center' });

  doc.end();
  return doc;
}

function labelStatus(s) {
  const map = {
    pending: 'Placed',
    preparing: 'Preparing',
    out_for_delivery: 'Out for Delivery',
    delivered: 'Delivered',
    received: 'Received',
    cancelled: 'Cancelled',
  };
  return map[s] || s;
}

module.exports = { renderReceiptPdf };
