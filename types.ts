export interface Point {
  x: number;
  y: number;
}

export interface Area {
  width: number;
  height: number;
}

export interface ProcessorSettings {
  threshold: number; // 0-255
  sharpness: number; // 0-100
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  mode: 'original' | 'grayscale' | 'binary' | 'enhanced';
}

export interface CropState {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}