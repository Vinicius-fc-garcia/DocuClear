
import React, { useEffect, useRef, useState } from 'react';
import { ProcessorSettings, Point } from '../types';
import { applyFilters } from '../utils/imageProcessing';
import { Printer, Download, ArrowLeft, Settings2, Sun, Type, Eye, RotateCw, Maximize, Eraser, Undo, Scissors } from 'lucide-react';

interface ScannerProcessorProps {
  warpedImageSrc: string;
  onBack: () => void;
}

const ScannerProcessor: React.FC<ScannerProcessorProps> = ({ warpedImageSrc, onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [printSrc, setPrintSrc] = useState<string>('');
  
  const [settings, setSettings] = useState<ProcessorSettings>({
    threshold: 128,
    sharpness: 20,
    brightness: 10,
    contrast: 20,
    rotation: 0,
    margin: 0,
    cropTop: 0,
    cropBottom: 0,
    cropLeft: 0,
    cropRight: 0,
    format: 'A4_PORTRAIT',
    mode: 'enhanced',
    eraserPaths: [],
  });

  const [isEraserMode, setIsEraserMode] = useState(false);
  const [eraserSize, setEraserSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentPathRef = useRef<Point[]>([]);

  useEffect(() => {
    let isCancelled = false;

    const process = async () => {
      setIsProcessing(true);
      const img = new Image();
      img.src = warpedImageSrc;
      await new Promise((r) => (img.onload = r));

      if (isCancelled) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Calcular dimensões considerando rotação e formato
      const isVertical = settings.rotation % 180 === 0;
      let baseWidth = isVertical ? img.width : img.height;
      let baseHeight = isVertical ? img.height : img.width;

      // Apply crop to base dimensions
      const cropT = settings.cropTop / 100;
      const cropB = settings.cropBottom / 100;
      const cropL = settings.cropLeft / 100;
      const cropR = settings.cropRight / 100;

      const croppedWidth = baseWidth * (1 - cropL - cropR);
      const croppedHeight = baseHeight * (1 - cropT - cropB);

      canvas.width = croppedWidth;
      canvas.height = croppedHeight;

      // Limpar e aplicar rotação e crop
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((settings.rotation * Math.PI) / 180);
      
      // Aplicar margem (reduz o desenho da imagem)
      const marginFactor = 1 - (settings.margin / 100);
      const drawWidth = croppedWidth * marginFactor;
      const drawHeight = croppedHeight * marginFactor;
      
      // Source crop coordinates (before rotation)
      let sourceX = img.width * cropL;
      let sourceY = img.height * cropT;
      let sourceW = img.width * (1 - cropL - cropR);
      let sourceH = img.height * (1 - cropT - cropB);

      if (!isVertical) {
        sourceX = img.width * cropT;
        sourceY = img.height * cropR;
        sourceW = img.width * (1 - cropT - cropB);
        sourceH = img.height * (1 - cropL - cropR);
      }

      ctx.drawImage(
        img, 
        sourceX, sourceY, sourceW, sourceH, // Source
        -croppedWidth / 2 * marginFactor, -croppedHeight / 2 * marginFactor, drawWidth, drawHeight // Destination
      );
      ctx.restore();

      // Aplicar filtros de imagem
      applyFilters(ctx, canvas.width, canvas.height, settings);

      // Draw eraser paths
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'white';
      settings.eraserPaths.forEach(path => {
        if (path.points.length === 0) return;
        ctx.lineWidth = path.size;
        ctx.beginPath();
        ctx.moveTo(path.points[0].x, path.points[0].y);
        if (path.points.length === 1) {
          ctx.lineTo(path.points[0].x, path.points[0].y);
        } else {
          for (let i = 1; i < path.points.length; i++) {
            ctx.lineTo(path.points[i].x, path.points[i].y);
          }
        }
        ctx.stroke();
      });
      
      setPrintSrc(canvas.toDataURL('image/png'));
      setIsProcessing(false);
    };

    process();
    return () => { isCancelled = true; };
  }, [warpedImageSrc, settings]);

  const handlePrint = () => {
    if (isProcessing || !printSrc) return;
    
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
    
    const isLandscape = settings.format.includes('LANDSCAPE');
    const pageSize = settings.format.includes('A4') ? 'A4' : 'letter';
    const orientation = isLandscape ? 'landscape' : 'portrait';

    const content = `
      <html>
        <head>
          <style>
            @page { margin: 0; size: ${pageSize} ${orientation}; }
            body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
            img { max-width: 100%; max-height: 100%; object-fit: contain; }
          </style>
        </head>
        <body>
          <img src="${printSrc}" onload="window.print();" />
        </body>
      </html>
    `;
    
    const doc = iframe.contentWindow?.document;
    if (doc) {
        doc.open();
        doc.write(content);
        doc.close();
    }
    setTimeout(() => document.body.removeChild(iframe), 2000);
  };

  const updateSetting = (key: keyof ProcessorSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const rotate = () => {
    setSettings(prev => ({ ...prev, rotation: (prev.rotation + 90) % 360 }));
  };

  const undoEraser = () => {
    setSettings(prev => ({
      ...prev,
      eraserPaths: prev.eraserPaths.slice(0, -1)
    }));
  };

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isEraserMode) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    if (!point) return;
    setIsDrawing(true);
    currentPathRef.current = [point];
    
    // Draw initial dot
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = eraserSize;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isEraserMode || !isDrawing) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    if (!point) return;
    
    const lastPoint = currentPathRef.current[currentPathRef.current.length - 1];
    currentPathRef.current.push(point);

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'white';
        ctx.lineWidth = eraserSize;
        ctx.beginPath();
        ctx.moveTo(lastPoint.x, lastPoint.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    }
  };

  const handlePointerUp = () => {
    if (!isEraserMode || !isDrawing) return;
    setIsDrawing(false);
    
    const pathPoints = [...currentPathRef.current];
    
    if (pathPoints.length > 0) {
      setSettings(prev => ({
        ...prev,
        eraserPaths: [...prev.eraserPaths, { points: pathPoints, size: eraserSize }]
      }));
    }
    currentPathRef.current = [];
  };

  // Determine aspect ratio for preview container based on format
  const isLandscapeFormat = settings.format.includes('LANDSCAPE');
  const isLetter = settings.format.includes('LETTER');
  const ratioX = isLetter ? 8.5 : 210;
  const ratioY = isLetter ? 11 : 297;
  const aspectStyle = isLandscapeFormat ? `${ratioY}/${ratioX}` : `${ratioX}/${ratioY}`;

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Preview Area (A4 Simulation) */}
        <div className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-950 p-4 md:p-8 flex justify-center items-center min-h-0 relative">
          <div 
            className={`relative shadow-2xl bg-white h-full max-h-[85vh] transition-opacity duration-200 group ${isEraserMode ? 'cursor-crosshair' : ''}`} 
            style={{ opacity: isProcessing && !isDrawing ? 0.6 : 1, aspectRatio: aspectStyle }}
          >
             <canvas 
               ref={canvasRef} 
               className="w-full h-full object-contain touch-none" 
               onMouseDown={handlePointerDown}
               onMouseMove={handlePointerMove}
               onMouseUp={handlePointerUp}
               onMouseLeave={handlePointerUp}
               onTouchStart={handlePointerDown}
               onTouchMove={handlePointerMove}
               onTouchEnd={handlePointerUp}
             />
             
             {/* Overlay info */}
             <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white text-[10px] px-2 py-1 rounded pointer-events-none">
                Simulação {settings.format.replace('_', ' ')}
             </div>

             {isProcessing && !isDrawing && (
               <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/20 backdrop-blur-sm pointer-events-none">
                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
               </div>
             )}
          </div>
        </div>

        {/* Controls Sidebar */}
        <div className="w-full lg:w-80 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 p-6 overflow-y-auto z-20 shadow-lg">
           <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
             <Settings2 className="w-5 h-5 text-blue-500" />
             Ajustes do Documento
           </h2>

           {/* Quick Actions (Rotate/Layout) */}
           <div className="grid grid-cols-2 gap-3 mb-6">
              <button 
                onClick={rotate}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors gap-1"
              >
                <RotateCw size={20} className="text-blue-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Girar 90°</span>
              </button>
              <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 relative">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Formato</span>
                <select 
                  value={settings.format}
                  onChange={(e) => updateSetting('format', e.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-center appearance-none cursor-pointer outline-none"
                >
                  <option value="A4_PORTRAIT">A4 Retrato</option>
                  <option value="A4_LANDSCAPE">A4 Paisagem</option>
                  <option value="LETTER_PORTRAIT">Carta Retrato</option>
                  <option value="LETTER_LANDSCAPE">Carta Paisagem</option>
                </select>
              </div>
           </div>

           {/* Eraser Tool */}
           <div className="mb-6 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
             <div className="flex items-center justify-between mb-3">
               <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                 <Eraser size={14} className={isEraserMode ? 'text-blue-500' : ''} /> 
                 Borracha (Fundo Branco)
               </label>
               <div className="flex gap-2">
                 <button 
                   onClick={undoEraser} 
                   disabled={settings.eraserPaths.length === 0}
                   className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                   title="Desfazer borracha"
                 >
                   <Undo size={14} />
                 </button>
                 <button 
                   onClick={() => setIsEraserMode(!isEraserMode)}
                   className={`px-3 py-1 text-[10px] font-bold rounded-md transition-colors ${
                     isEraserMode ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                   }`}
                 >
                   {isEraserMode ? 'ATIVO' : 'ATIVAR'}
                 </button>
               </div>
             </div>
             {isEraserMode && (
               <div className="animate-fade-in">
                 <div className="flex justify-between mb-1">
                   <span className="text-[10px] text-slate-500">Tamanho</span>
                   <span className="text-[10px] font-mono">{eraserSize}px</span>
                 </div>
                 <input 
                   type="range" min="5" max="100" step="5"
                   value={eraserSize} 
                   onChange={(e) => setEraserSize(parseInt(e.target.value))}
                   className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                 />
                 <p className="text-[10px] text-slate-500 mt-2 leading-tight">Pinte sobre bordas escuras ou sujeiras para deixá-las brancas e poupar tinta.</p>
               </div>
             )}
           </div>

           {/* Mode Selection */}
           <div className="mb-6">
             <label className="block text-xs font-bold uppercase tracking-widest mb-3 text-slate-400">Modo Visual</label>
             <div className="grid grid-cols-2 gap-2">
                {(['enhanced', 'original', 'grayscale', 'binary'] as const).map(mode => (
                  <button 
                    key={mode}
                    onClick={() => updateSetting('mode', mode)}
                    className={`p-2 text-xs font-medium rounded-lg border transition-all ${
                      settings.mode === mode 
                      ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {mode === 'enhanced' ? 'Melhorado' : mode === 'grayscale' ? 'P/B Foto' : mode === 'binary' ? 'Texto' : 'Original'}
                  </button>
                ))}
             </div>
           </div>

           {/* Sliders */}
           <div className="space-y-6">
             
             {/* Fine Crop */}
             <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-3">
                  <Scissors size={14} /> Ajuste Fino de Bordas
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between mb-1"><span className="text-[10px] text-slate-500">Topo</span><span className="text-[10px] font-mono">{settings.cropTop}%</span></div>
                    <input type="range" min="0" max="25" value={settings.cropTop} onChange={(e) => updateSetting('cropTop', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1"><span className="text-[10px] text-slate-500">Base</span><span className="text-[10px] font-mono">{settings.cropBottom}%</span></div>
                    <input type="range" min="0" max="25" value={settings.cropBottom} onChange={(e) => updateSetting('cropBottom', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1"><span className="text-[10px] text-slate-500">Esq.</span><span className="text-[10px] font-mono">{settings.cropLeft}%</span></div>
                    <input type="range" min="0" max="25" value={settings.cropLeft} onChange={(e) => updateSetting('cropLeft', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1"><span className="text-[10px] text-slate-500">Dir.</span><span className="text-[10px] font-mono">{settings.cropRight}%</span></div>
                    <input type="range" min="0" max="25" value={settings.cropRight} onChange={(e) => updateSetting('cropRight', parseInt(e.target.value))} className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                  </div>
                </div>
             </div>

             <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2"><Maximize size={12} /> Margem Branca</label>
                  <span className="text-xs font-mono">{settings.margin}%</span>
                </div>
                <input 
                  type="range" min="0" max="40" step="1"
                  value={settings.margin} 
                  onChange={(e) => updateSetting('margin', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
             </div>

             {settings.mode === 'binary' && (
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2"><Type size={12} /> Limiar</label>
                    <span className="text-xs font-mono">{settings.threshold}</span>
                  </div>
                  <input 
                    type="range" min="0" max="255" 
                    value={settings.threshold} 
                    onChange={(e) => updateSetting('threshold', parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
             )}

             <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2"><Sun size={12} /> Brilho</label>
                  <span className="text-xs font-mono">{settings.brightness}</span>
                </div>
                <input 
                  type="range" min="-100" max="100" 
                  value={settings.brightness} 
                  onChange={(e) => updateSetting('brightness', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
             </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2"><Eye size={12} /> Nitidez</label>
                  <span className="text-xs font-mono">{settings.sharpness}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={settings.sharpness} 
                  onChange={(e) => updateSetting('sharpness', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
             </div>
           </div>

           {/* Actions */}
           <div className="mt-8 space-y-3">
             <button 
               onClick={handlePrint}
               disabled={isProcessing}
               className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl font-bold shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95"
             >
               <Printer size={20} />
               {isProcessing ? 'Processando...' : 'IMPRIMIR DOCUMENTO'}
             </button>
             
             <div className="grid grid-cols-2 gap-2">
                <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.download = `docuclear-${Date.now()}.png`;
                      link.href = printSrc;
                      link.click();
                    }}
                    className="py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Download size={14} />
                  SALVAR
                </button>
                <button 
                  onClick={onBack}
                  className="py-2.5 text-slate-500 hover:text-blue-500 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <ArrowLeft size={14} />
                  RECORTE
                </button>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ScannerProcessor;

