/**
 * Extract dominant / average color from an image URL using canvas.
 * Returns a hex color string like "#3a7bd5".
 */
export function extractDominantColor(imageUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve('#1a1a2e'); return; }
        ctx.drawImage(img, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;
        let r = 0, g = 0, b = 0, count = 0;

        // Sample every 4th pixel (performance) and skip very dark/very bright pixels
        for (let i = 0; i < data.length; i += 16) {
          const pr = data[i], pg = data[i + 1], pb = data[i + 2];
          // Skip pure black or white
          if ((pr < 15 && pg < 15 && pb < 15) || (pr > 240 && pg > 240 && pb > 240)) continue;
          r += pr; g += pg; b += pb; count++;
        }

        if (count === 0) {
          // Fallback: average all pixels
          for (let i = 0; i < data.length; i += 16) {
            r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
          }
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        // Boost saturation slightly for nicer background
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max - min < 30) {
          // Low saturation - leave as-is
        }

        resolve(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
      } catch {
        resolve('#1a1a2e');
      }
    };
    img.onerror = () => resolve('#1a1a2e');
    img.src = imageUrl;
  });
}

/**
 * Lighten a hex color by mixing with white.
 */
export function lightenHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${mix(r).toString(16).padStart(2, '0')}${mix(g).toString(16).padStart(2, '0')}${mix(b).toString(16).padStart(2, '0')}`;
}

/**
 * Darken a hex color by mixing with black.
 */
export function darkenHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c * (1 - amount));
  return `#${mix(r).toString(16).padStart(2, '0')}${mix(g).toString(16).padStart(2, '0')}${mix(b).toString(16).padStart(2, '0')}`;
}
