import React, { useRef, useState } from 'react';
import { Point, CropState } from '../types';
import { Check, RotateCcw, ScanLine, MousePointerClick } from 'lucide-react';
import { detectDocumentEdges } from '../utils/imageProcessing';

interface CropEditorProps {
  imageSrc: string;
  initialCorners: Point[] | null;
  onConfirm: (corners: Point[]) => void;
  onCancel: () => void;
}

const CropEditor: React.FC<CropEditorProps> = ({ imageSrc, initialCorners, onConfirm, onCancel }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [corners, setCorners] = useState<CropState | null>(null);
  const [activeCorner, setActiveCorner] = useState<keyof CropState | null>(null);
  const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0 });
  const [isDetecting, setIsDetecting] = useState(!initialCorners);

  // Initialize corners when image loads
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setImgDimensions({ w, h });

    // If we have previous corners, use them
    if (initialCorners) {
        setCorners({
            topLeft: initialCorners[0],
            topRight: initialCorners[1],
            bottomRight: initialCorners[2],
            bottomLeft: initialCorners[3],
        });
        setIsDetecting(false);
        return;
    }

    // Attempt auto-detection
    setTimeout(() => {
        let detected = null;
        try {
            detected = detectDocumentEdges(img);
        } catch (err) {
            console.error("Detection failed", err);
        }

        // Validate detection: Check if corners are valid and don't cover 100% of the image (which implies failure to find edges)
        const isValid = detected && validateDetection(detected, w, h);

        if (isValid && detected) {
            setCorners({
                topLeft: detected[0],
                topRight: detected[1],
                bottomRight: detected[2],
                bottomLeft: detected[3],
            });
        } else {
            // Fallback: Center 80% rectangle
            // This is better than 100% because it shows the user they need to edit
            const paddingX = w * 0.1;
            const paddingY = h * 0.1;
            setCorners({
              topLeft: { x: paddingX, y: paddingY },
              topRight: { x: w - paddingX, y: paddingY },
              bottomRight: { x: w - paddingX, y: h - paddingY },
              bottomLeft: { x: paddingX, y: h - paddingY },
            });
        }
        setIsDetecting(false);
    }, 100);
  };

  const validateDetection = (corners: Point[], w: number, h: number) => {
    // Simple check: if area is > 99% of image, it's likely just the image frame
    // Shoelace formula for area
    let area = 0;
    const n = corners.length;
    for(let i=0; i<n; i++) {
        area += (corners[i].x * corners[(i+1)%n].y) - (corners[(i+1)%n].x * corners[i].y);
    }
    area = Math.abs(area) / 2;
    
    const imageArea = w * h;
    const ratio = area / imageArea;
    
    // If it covers almost everything or almost nothing, reject
    return ratio > 0.05 && ratio < 0.98;
  };

  // Convert image coordinates to screen coordinates
  const getScreenCoords = (point: Point): React.CSSProperties => {
    if (!containerRef.current || !imgRef.current) return {};
    const imgRect = imgRef.current.getBoundingClientRect();
    const scaleX = imgRect.width / imgRef.current.naturalWidth;
    const scaleY = imgRect.height / imgRef.current.naturalHeight;

    return {
      left: `${point.x * scaleX}px`,
      top: `${point.y * scaleY}px`,
    };
  };

  // Drag logic for Handles
  const handlePointerDown = (corner: keyof CropState) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActiveCorner(corner);
  };

  // Click-to-Snap logic for Background
  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    if (!corners || !imgRef.current) return;
    
    e.preventDefault();
    const imgRect = imgRef.current.getBoundingClientRect();
    const clickX = e.clientX;
    const clickY = e.clientY;

    // Helper to get raw screen x/y for a corner
    const getCornerScreenPos = (point: Point) => {
        const scaleX = imgRect.width / imgRef.current!.naturalWidth;
        const scaleY = imgRect.height / imgRef.current!.naturalHeight;
        return {
            x: imgRect.left + point.x * scaleX,
            y: imgRect.top + point.y * scaleY
        };
    };

    // Find nearest corner
    const cornerKeys: (keyof CropState)[] = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
    let minDist = Infinity;
    let nearest: keyof CropState | null = null;

    cornerKeys.forEach(key => {
        const screenPos = getCornerScreenPos(corners[key]);
        const dist = Math.hypot(screenPos.x - clickX, screenPos.y - clickY);
        if (dist < minDist) {
            minDist = dist;
            nearest = key;
        }
    });

    // Snap nearest corner to click position
    if (nearest) {
        const scaleX = imgRef.current.naturalWidth / imgRect.width;
        const scaleY = imgRef.current.naturalHeight / imgRect.height;
        
        const relativeX = e.clientX - imgRect.left;
        const relativeY = e.clientY - imgRect.top;

        // Clamp to image bounds
        const x = Math.max(0, Math.min(imgDimensions.w, relativeX * scaleX));
        const y = Math.max(0, Math.min(imgDimensions.h, relativeY * scaleY));

        setCorners(prev => prev ? ({
            ...prev,
            [nearest!]: { x, y }
        }) : null);

        // Start dragging immediately
        setActiveCorner(nearest);
        e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeCorner || !corners || !imgRef.current) return;

    const imgRect = imgRef.current.getBoundingClientRect();
    const scaleX = imgRef.current.naturalWidth / imgRect.width;
    const scaleY = imgRef.current.naturalHeight / imgRect.height;

    // Relative position in the container
    const relativeX = e.clientX - imgRect.left;
    const relativeY = e.clientY - imgRect.top;

    // Clamp values
    const x = Math.max(0, Math.min(imgDimensions.w, relativeX * scaleX));
    const y = Math.max(0, Math.min(imgDimensions.h, relativeY * scaleY));

    setCorners({
      ...corners,
      [activeCorner]: { x, y },
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setActiveCorner(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Render SVG polygon overlay
  const renderSvgOverlay = () => {
    if (!corners || !imgRef.current) return null;
    const imgRect = imgRef.current.getBoundingClientRect();
    const scaleX = imgRect.width / imgRef.current.naturalWidth;
    const scaleY = imgRect.height / imgRef.current.naturalHeight;

    const points = [
      `${corners.topLeft.x * scaleX},${corners.topLeft.y * scaleY}`,
      `${corners.topRight.x * scaleX},${corners.topRight.y * scaleY}`,
      `${corners.bottomRight.x * scaleX},${corners.bottomRight.y * scaleY}`,
      `${corners.bottomLeft.x * scaleX},${corners.bottomLeft.y * scaleY}`,
    ].join(' ');

    return (
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
        <polygon points={points} fill="rgba(59, 130, 246, 0.2)" stroke="#3b82f6" strokeWidth="2" />
        <line x1={corners.topLeft.x * scaleX} y1={corners.topLeft.y * scaleY} x2={corners.topRight.x * scaleX} y2={corners.topRight.y * scaleY} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" />
        <line x1={corners.topRight.x * scaleX} y1={corners.topRight.y * scaleY} x2={corners.bottomRight.x * scaleX} y2={corners.bottomRight.y * scaleY} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" />
        <line x1={corners.bottomRight.x * scaleX} y1={corners.bottomRight.y * scaleY} x2={corners.bottomLeft.x * scaleX} y2={corners.bottomLeft.y * scaleY} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" />
        <line x1={corners.bottomLeft.x * scaleX} y1={corners.bottomLeft.y * scaleY} x2={corners.topLeft.x * scaleX} y2={corners.topLeft.y * scaleY} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" />
      </svg>
    );
  };

  const renderHandle = (corner: keyof CropState) => {
    if (!corners) return null;
    // Hide the handle if it is currently being dragged (active) to avoid obstructing the magnifier
    if (activeCorner === corner) return null;

    return (
      <div
        className={`absolute w-8 h-8 -ml-4 -mt-4 bg-blue-500 border-4 border-white rounded-full z-20 cursor-move shadow-lg transform transition-transform hover:scale-110 touch-none`}
        style={getScreenCoords(corners[corner])}
        onPointerDown={handlePointerDown(corner)}
      />
    );
  };

  // Magnifier Rendering
  const renderMagnifier = () => {
    if (!activeCorner || !corners || !imgDimensions.w) return null;

    const corner = corners[activeCorner];
    const zoom = 2.5;
    const size = 120;
    
    const coords = getScreenCoords(corner);
    
    // Background math:
    const bgX = - (corner.x * zoom - size / 2);
    const bgY = - (corner.y * zoom - size / 2);
    
    const bgSizeX = imgDimensions.w * zoom;
    const bgSizeY = imgDimensions.h * zoom;

    return (
        <div 
            className="absolute z-50 pointer-events-none border-4 border-white rounded-full shadow-2xl overflow-hidden bg-slate-900"
            style={{
                width: size,
                height: size,
                left: coords.left,
                top: coords.top,
                transform: 'translate(-50%, -50%)', // Centered on cursor
                backgroundImage: `url(${imageSrc})`,
                backgroundSize: `${bgSizeX}px ${bgSizeY}px`,
                backgroundPosition: `${bgX}px ${bgY}px`,
                backgroundRepeat: 'no-repeat'
            }}
        >
            {/* Crosshair inside magnifier */}
            <div className="absolute inset-0 flex items-center justify-center opacity-50">
                <div className="w-full h-0.5 bg-blue-500"></div>
                <div className="h-full w-0.5 bg-blue-500 absolute"></div>
            </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900" onPointerUp={handlePointerUp} onPointerMove={handlePointerMove}>
      <div className="flex-1 relative flex items-center justify-center p-4 overflow-hidden select-none touch-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
        {imageSrc && (
          <div 
            ref={containerRef} 
            className={`relative shadow-2xl cursor-crosshair group ${activeCorner ? 'cursor-none' : ''}`}
            onPointerDown={handleBackgroundPointerDown}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Source"
              className="max-h-[75vh] max-w-full object-contain pointer-events-none"
              onLoad={handleImageLoad}
            />
            {renderSvgOverlay()}
            {!isDetecting && (
                <>
                    {renderHandle('topLeft')}
                    {renderHandle('topRight')}
                    {renderHandle('bottomRight')}
                    {renderHandle('bottomLeft')}
                </>
            )}
            
            {/* Magnifier Element */}
            {activeCorner && renderMagnifier()}
            
            {isDetecting && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-lg transition-opacity pointer-events-none">
                     <div className="flex flex-col items-center text-white bg-slate-900/90 p-6 rounded-2xl shadow-2xl border border-slate-700">
                         <ScanLine className="animate-pulse w-10 h-10 mb-3 text-blue-400" />
                         <span className="text-sm font-semibold tracking-wide">Detectando bordas...</span>
                     </div>
                 </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-between items-center gap-4 z-30">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 transition-colors flex items-center gap-2"
        >
          <RotateCcw size={18} />
          <span>Voltar</span>
        </button>
        
        <div className="text-sm text-slate-400 hidden md:flex items-center gap-2 text-center bg-slate-700/50 px-3 py-1.5 rounded-full border border-slate-600">
          <MousePointerClick size={14} className="text-blue-400" />
          <span>Clique na imagem para atrair o canto mais próximo</span>
        </div>

        <button
          disabled={isDetecting}
          onClick={() => corners && onConfirm([corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft])}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-lg flex items-center gap-2 transition-transform active:scale-95"
        >
          <Check size={18} />
          <span>Recortar</span>
        </button>
      </div>
    </div>
  );
};

export default CropEditor;
