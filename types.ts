
export interface Point {
  x: number;
  y: number;
}

export interface Area {
  width: number;
  height: number;
}

export interface EraserPath {
  points: Point[];
  size: number;
}

export interface ProcessorSettings {
  threshold: number; // 0-255
  sharpness: number; // 0-100
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  rotation: number; // 0, 90, 180, 270
  margin: number; // 0 to 50 (percentage)
  cropTop: number; // 0 to 50 (percentage)
  cropBottom: number; // 0 to 50 (percentage)
  cropLeft: number; // 0 to 50 (percentage)
  cropRight: number; // 0 to 50 (percentage)
  format: 'A4_PORTRAIT' | 'A4_LANDSCAPE' | 'LETTER_PORTRAIT' | 'LETTER_LANDSCAPE';
  mode: 'original' | 'grayscale' | 'binary' | 'enhanced';
  eraserPaths: EraserPath[];
}

export interface CropState {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}
