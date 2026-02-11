/**
 * Client-side image compression for payment receipt uploads.
 * Uses Canvas API — works in browser and Capacitor.
 */

const MAX_DIMENSION = 1200;
const VALID_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export function validateImageFile(file: File, maxSizeMB = 10): { valid: boolean; error?: string } {
  if (!VALID_TYPES.includes(file.type)) {
    return { valid: false, error: 'Please upload a JPEG, PNG, or WebP image' };
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `File too large. Maximum ${maxSizeMB}MB` };
  }
  return { valid: true };
}

export function compressImage(file: File, maxSizeKB = 180): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        let { width, height } = img;

        // Cap dimensions
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height / width) * MAX_DIMENSION);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width / height) * MAX_DIMENSION);
            height = MAX_DIMENSION;
          }
        }

        const tryCompress = (w: number, h: number, quality: number): string | null => {
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          const sizeKB = (dataUrl.length * 3) / 4 / 1024;
          return sizeKB <= maxSizeKB ? dataUrl : null;
        };

        // Step down quality, then dimensions
        let result = tryCompress(width, height, 0.85);
        if (!result) result = tryCompress(width, height, 0.7);
        if (!result) result = tryCompress(width, height, 0.5);
        if (!result) {
          const w2 = Math.round(width * 0.7);
          const h2 = Math.round(height * 0.7);
          result = tryCompress(w2, h2, 0.7);
        }
        if (!result) {
          const w3 = Math.round(width * 0.5);
          const h3 = Math.round(height * 0.5);
          result = tryCompress(w3, h3, 0.6);
        }

        if (result) {
          resolve(result);
        } else {
          reject(new Error('Could not compress image to target size'));
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
