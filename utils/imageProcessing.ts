import { Point, ProcessorSettings } from '../types';

// Standard A4 Aspect Ratio
export const A4_RATIO = 210 / 297;

/**
 * Loads an image from a URL or Base64 string
 */
export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Detects document corners using improved edge detection (Blur + Sobel + Adaptive Threshold)
 */
export const detectDocumentEdges = (img: HTMLImageElement): Point[] | null => {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  
  // Downscale for performance and noise reduction
  // 512px is a good balance for structure detection
  const maxDim = 512;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const sw = Math.floor(w * scale);
  const sh = Math.floor(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, sw, sh);
  const imageData = ctx.getImageData(0, 0, sw, sh);
  
  // 1. Grayscale & Blur (Box Blur 3x3) to remove texture noise
  const gray = new Uint8ClampedArray(sw * sh);
  preprocessImage(imageData.data, gray, sw, sh);

  // 2. Edge Detection (Sobel)
  const edges = new Uint8Array(sw * sh);
  // Compute average edge strength to set adaptive threshold
  const avgGradient = applySobel(gray, edges, sw, sh);
  
  // Threshold should be relative to image complexity. 
  // Multiplier 2.5 removes weak texture edges, keeping strong document boundaries.
  const threshold = Math.max(30, avgGradient * 2.5);

  // 3. Find Corners
  // We search for points that maximize/minimize x+y, x-y, etc.
  // We ignore a safety margin around the border to avoid detecting the image frame itself.
  const margin = Math.floor(Math.min(sw, sh) * 0.05); // 5% margin
  
  let minSum = Infinity, maxSum = -Infinity;
  let minDiff = Infinity, maxDiff = -Infinity;
  
  let tl = { x: 0, y: 0 };
  let tr = { x: sw, y: 0 };
  let br = { x: sw, y: sh };
  let bl = { x: 0, y: sh };

  let foundPixels = 0;

  for (let y = margin; y < sh - margin; y++) {
    for (let x = margin; x < sw - margin; x++) {
      const idx = y * sw + x;
      if (edges[idx] > threshold) {
        foundPixels++;
        const sum = x + y;
        const diff = x - y;

        if (sum < minSum) { minSum = sum; tl = { x, y }; }
        if (sum > maxSum) { maxSum = sum; br = { x, y }; }
        if (diff < minDiff) { minDiff = diff; bl = { x, y }; }
        if (diff > maxDiff) { maxDiff = diff; tr = { x, y }; }
      }
    }
  }

  // If we didn't find enough edge pixels, or they are too spread out (likely noise)
  if (foundPixels < (sw * sh * 0.001)) return null;

  // Scale back up
  const unscale = 1 / scale;
  
  // Helper to scale point
  const s = (p: Point) => ({ x: p.x * unscale, y: p.y * unscale });

  // Calculate area of detected quad to check validity
  // If it covers < 5% of image, it's probably noise.
  // If it covers > 98% of image (and we ignored margins), it likely failed to separate background.
  
  return [s(tl), s(tr), s(br), s(bl)];
};

/**
 * Converts to grayscale and applies a 3x3 Box Blur
 */
const preprocessImage = (src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number) => {
  // First pass: Grayscale
  const tempGray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = src[i * 4];
    const g = src[i * 4 + 1];
    const b = src[i * 4 + 2];
    tempGray[i] = (r * 0.299 + g * 0.587 + b * 0.114);
  }

  // Second pass: Box Blur
  // To avoid boundary checks inside loop, we skip outer pixels
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sum = 0;
      // 3x3 kernel
      sum += tempGray[(y-1)*w + (x-1)];
      sum += tempGray[(y-1)*w + x];
      sum += tempGray[(y-1)*w + (x+1)];
      sum += tempGray[y*w + (x-1)];
      sum += tempGray[y*w + x];
      sum += tempGray[y*w + (x+1)];
      sum += tempGray[(y+1)*w + (x-1)];
      sum += tempGray[(y+1)*w + x];
      sum += tempGray[(y+1)*w + (x+1)];
      
      dst[y*w + x] = sum / 9;
    }
  }
};

/**
 * Applies Sobel Edge Detection
 * Returns average gradient magnitude
 */
const applySobel = (gray: Uint8ClampedArray, edges: Uint8Array, w: number, h: number): number => {
  let totalMag = 0;
  let count = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      // Gx
      // -1 0 1
      // -2 0 2
      // -1 0 1
      const gx = 
        -gray[(y-1)*w + (x-1)] + gray[(y-1)*w + (x+1)] +
        -2*gray[y*w + (x-1)]   + 2*gray[y*w + (x+1)] +
        -gray[(y+1)*w + (x-1)] + gray[(y+1)*w + (x+1)];

      // Gy
      // -1 -2 -1
      //  0  0  0
      //  1  2  1
      const gy = 
        -gray[(y-1)*w + (x-1)] - 2*gray[(y-1)*w + x] - gray[(y-1)*w + (x+1)] +
         gray[(y+1)*w + (x-1)] + 2*gray[(y+1)*w + x] + gray[(y+1)*w + (x+1)];

      const mag = Math.sqrt(gx*gx + gy*gy);
      edges[y*w + x] = mag;
      
      totalMag += mag;
      count++;
    }
  }
  return count > 0 ? totalMag / count : 0;
};


/**
 * Applies basic image filters (Grayscale, Threshold, Brightness/Contrast)
 */
export const applyFilters = (
  ctx: CanvasRenderingContext2D, 
  width: number, 
  height: number, 
  settings: ProcessorSettings
) => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Calculate Contrast Factor
  const contrast = settings.contrast * 1.5; 
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  
  const brightness = settings.brightness * 1.5;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. Grayscale Logic
    if (settings.mode === 'grayscale' || settings.mode === 'binary') {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = g = b = gray;
    }

    // 2. Mode Specifics (Enhanced vs Normal)
    if (settings.mode === 'enhanced') {
        // Smart Enhance that preserves color tone
        // We operate on luminance to avoid color shifting (pink/green artifacts)
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // S-Curve for luminance: Darker blacks, Whiter whites
        let newLum = lum;
        if (lum > 180) {
             // Push light grays to white
             newLum = Math.min(255, lum + (lum - 180) * 1.2); 
        } else if (lum < 100) {
             // Push dark grays to black
             newLum = Math.max(0, lum - (100 - lum) * 0.5);
        }

        // Apply scaling factor to RGB channels
        // Avoid division by zero
        if (lum > 0) {
             const ratio = newLum / lum;
             r = r * ratio;
             g = g * ratio;
             b = b * ratio;
        }
    }

    // 3. Brightness & Contrast
    // Apply uniformly
    r = contrastFactor * (r - 128) + 128 + brightness;
    g = contrastFactor * (g - 128) + 128 + brightness;
    b = contrastFactor * (b - 128) + 128 + brightness;

    // 4. Binary Threshold
    if (settings.mode === 'binary') {
        const v = (r + g + b) / 3;
        const bin = v >= settings.threshold ? 255 : 0;
        r = g = b = bin;
    }

    // Final Clamp
    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }

  ctx.putImageData(imageData, 0, 0);

  // Apply Sharpening if needed
  if (settings.sharpness > 0) {
    applySharpen(ctx, width, height, settings.sharpness / 100);
  }
};

/**
 * Applies a convolution sharpen filter
 */
const applySharpen = (ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) => {
  const imageData = ctx.getImageData(0, 0, w, h);
  const buff = ctx.createImageData(w, h);
  const src = imageData.data;
  const dst = buff.data;
  const w4 = w * 4;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      
      // Alpha
      dst[idx + 3] = src[idx + 3];

      // RGB
      for (let c = 0; c < 3; c++) {
        // Kernel:
        //  0 -1  0
        // -1  5 -1
        //  0 -1  0
        const val = src[idx + c] * 5
          - src[idx + c - 4]
          - src[idx + c + 4]
          - src[idx + c - w4]
          - src[idx + c + w4];
        
        const original = src[idx + c];
        dst[idx + c] = Math.max(0, Math.min(255, original + (val - original) * amount));
      }
    }
  }
  ctx.putImageData(buff, 0, 0);
};

/**
 * Performs a perspective crop.
 */
export const performWarp = async (
    img: HTMLImageElement, 
    corners: Point[], 
    targetWidth: number = 1240 // A4 @ ~150dpi width
  ): Promise<string> => {
  
  const targetHeight = Math.round(targetWidth / A4_RATIO);

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('No Context');

  const inputData = getSourceImageData(img);
  const outputData = ctx.createImageData(targetWidth, targetHeight);
  
  const hMatrix = computeHomography(
    {x:0, y:0}, {x:targetWidth, y:0}, {x:targetWidth, y:targetHeight}, {x:0, y:targetHeight},
    corners[0], corners[1], corners[2], corners[3]
  );

  const srcWidth = img.naturalWidth;
  const srcHeight = img.naturalHeight;
  const dstData = outputData.data;
  const srcData = inputData.data;

  // Pixel loop
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const dom = hMatrix[6] * x + hMatrix[7] * y + 1;
      const srcX = (hMatrix[0] * x + hMatrix[1] * y + hMatrix[2]) / dom;
      const srcY = (hMatrix[3] * x + hMatrix[4] * y + hMatrix[5]) / dom;

      const dstIndex = (y * targetWidth + x) * 4;

      if (srcX >= 0 && srcX < srcWidth - 1 && srcY >= 0 && srcY < srcHeight - 1) {
        // Bilinear Interpolation
        const x0 = Math.floor(srcX);
        const x1 = x0 + 1;
        const y0 = Math.floor(srcY);
        const y1 = y0 + 1;
        
        const wx = srcX - x0;
        const wy = srcY - y0;
        
        const i00 = (y0 * srcWidth + x0) * 4;
        const i10 = (y0 * srcWidth + x1) * 4;
        const i01 = (y1 * srcWidth + x0) * 4;
        const i11 = (y1 * srcWidth + x1) * 4;

        for (let c = 0; c < 3; c++) {
          const val = 
            srcData[i00 + c] * (1 - wx) * (1 - wy) +
            srcData[i10 + c] * wx * (1 - wy) +
            srcData[i01 + c] * (1 - wx) * wy +
            srcData[i11 + c] * wx * wy;
          dstData[dstIndex + c] = val;
        }
        dstData[dstIndex + 3] = 255;
      } else {
        // White background for out of bounds
        dstData[dstIndex] = 255;
        dstData[dstIndex+1] = 255;
        dstData[dstIndex+2] = 255;
        dstData[dstIndex+3] = 255;
      }
    }
  }

  ctx.putImageData(outputData, 0, 0);
  return canvas.toDataURL('image/png', 0.9);
};

const getSourceImageData = (img: HTMLImageElement) => {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if(!ctx) throw new Error("No context");
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
}

const computeHomography = (
  src1: Point, src2: Point, src3: Point, src4: Point,
  dst1: Point, dst2: Point, dst3: Point, dst4: Point
) => {
  const A: number[][] = [];
  const B: number[] = [];
  
  const addRow = (x: number, y: number, u: number, v: number) => {
    A.push([x, y, 1, 0, 0, 0, -x*u, -y*u]);
    B.push(u);
    A.push([0, 0, 0, x, y, 1, -x*v, -y*v]);
    B.push(v);
  };

  addRow(src1.x, src1.y, dst1.x, dst1.y);
  addRow(src2.x, src2.y, dst2.x, dst2.y);
  addRow(src3.x, src3.y, dst3.x, dst3.y);
  addRow(src4.x, src4.y, dst4.x, dst4.y);

  const x = solveLinearSystem(A, B);
  return [...x, 1];
};

const solveLinearSystem = (A: number[][], B: number[]) => {
  const n = B.length;

  for (let i = 0; i < n; i++) {
    let maxEl = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i]);
        maxRow = k;
      }
    }

    for (let k = i; k < n; k++) {
      const tmp = A[maxRow][k];
      A[maxRow][k] = A[i][k];
      A[i][k] = tmp;
    }
    const tmp = B[maxRow];
    B[maxRow] = B[i];
    B[i] = tmp;

    for (let k = i + 1; k < n; k++) {
      const c = -A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        if (i === j) {
          A[k][j] = 0;
        } else {
          A[k][j] += c * A[i][j];
        }
      }
      B[k] += c * B[i];
    }
  }

  const x = new Array(n).fill(0);
  for (let i = n - 1; i > -1; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
        sum += A[i][j] * x[j];
    }
    x[i] = (B[i] - sum) / A[i][i];
  }
  return x;
};