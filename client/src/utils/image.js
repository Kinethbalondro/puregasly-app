import api from '../api/axios';

// Shrinks a photo in the browser before upload: phone photos are often 5-10 MB,
// but a 512 px avatar or a 1600 px cover only needs a few hundred KB.
// `square` center-crops to a square (avatars, logos). Output is JPEG.
export function compressImage(file, { maxWidth = 1280, maxHeight = 1280, square = false, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let sx = 0;
      let sy = 0;
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;
      if (square) {
        const side = Math.min(sw, sh);
        sx = (sw - side) / 2;
        sy = (sh - side) / 2;
        sw = side;
        sh = side;
      }
      const scale = Math.min(1, maxWidth / sw, maxHeight / sh);
      const w = Math.max(1, Math.round(sw * scale));
      const h = Math.max(1, Math.round(sh * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; // flatten transparent PNGs onto white
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not process that image.'))),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image.'));
    };
    img.src = url;
  });
}

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

// Compresses then POSTs as multipart field "image". Throws Error with a readable message.
export async function uploadImage(path, file, options) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error('Please choose a JPG, PNG or WebP image.');
  }
  const blob = await compressImage(file, options);
  const form = new FormData();
  form.append('image', blob, 'photo.jpg');
  return api.post(path, form);
}
