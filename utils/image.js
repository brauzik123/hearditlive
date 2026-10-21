// Shrinks a picked photo in the browser before upload: a 12 MP phone photo
// (3–5 MB) becomes a ~300 KB JPEG at 1600px, which looks the same on a
// phone, uploads much faster on mobile data and keeps storage small.
// Re-encoding also drops camera metadata such as GPS location.
//
// `square` centre-crops to a square (profile photos). Throws if the browser
// can't decode the file (e.g. HEIC outside Safari).
export async function shrinkImage(file, { maxSide = 1600, square = false, quality = 0.82 } = {}) {
  const bitmap = await createImageBitmap(file);
  const srcSide = Math.min(bitmap.width, bitmap.height);
  const src = square
    ? { x: (bitmap.width - srcSide) / 2, y: (bitmap.height - srcSide) / 2, w: srcSide, h: srcSide }
    : { x: 0, y: 0, w: bitmap.width, h: bitmap.height };

  const scale = Math.min(1, maxSide / Math.max(src.w, src.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(src.w * scale);
  canvas.height = Math.round(src.h * scale);
  canvas.getContext('2d').drawImage(bitmap, src.x, src.y, src.w, src.h, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))), 'image/jpeg', quality)
  );
}
