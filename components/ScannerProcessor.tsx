
import React, { useEffect, useRef, useState } from 'react';
import { ProcessorSettings } from '../types';
import { applyFilters } from '../utils/imageProcessing';
import { Printer, Download, ArrowLeft, Settings2, Sun, Type, Eye, RotateCw, Maximize } from 'lucide-react';

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
    mode: 'enhanced',
  });

  useEffect(() => {
    const process = async () => {
      setIsProcessing(true);
      const img = new Image();
      img.src = warpedImageSrc;
      await new Promise((r) => (img.onload = r));

      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Calcular dimensões considerando rotação
      const isVertical = settings.rotation % 180 === 0;
      const targetWidth = isVertical ? img.width : img.height;
      const targetHeight = isVertical ? img.height : img.width;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      // Limpar e aplicar rotação
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((settings.rotation * Math.PI) / 180);
      
      // Aplicar margem (reduz o desenho da imagem)
      const marginFactor = 1 - (settings.margin / 100);
      const drawWidth = img.width * marginFactor;
      const drawHeight = img.height * marginFactor;
      
      ctx.drawImage(img, -img.width / 2 * marginFactor, -img.height / 2 * marginFactor, drawWidth, drawHeight);
      ctx.restore();

      // Aplicar filtros de imagem
      applyFilters(ctx, canvas.width, canvas.height, settings);
      
      setPrintSrc(canvas.toDataURL('image/png'));
      setIsProcessing(false);
    };

    process();
  }, [warpedImageSrc, settings]);

  const handlePrint = () => {
    if (isProcessing || !printSrc) return;
    
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
    
    const content = `
      <html>
        <head>
          <style>
            @page { margin: 0; size: A4; }
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

  const updateSetting = (key: keyof ProcessorSettings, value: number | string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const rotate = () => {
    setSettings(prev => ({ ...prev, rotation: (prev.rotation + 90) % 360 }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Preview Area (A4 Simulation) */}
        <div className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-950 p-4 md:p-8 flex justify-center items-center min-h-0">
          <div className="relative shadow-2xl bg-white aspect-[210/297] h-full max-h-[85vh] transition-opacity duration-200 group" style={{ opacity: isProcessing ? 0.6 : 1 }}>
             <canvas ref={canvasRef} className="w-full h-full object-contain" />
             
             {/* Overlay info */}
             <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white text-[10px] px-2 py-1 rounded">
                Simulação A4
             </div>

             {isProcessing && (
               <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/20 backdrop-blur-sm">
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
           <div className="grid grid-cols-2 gap-3 mb-8">
              <button 
                onClick={rotate}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors gap-1"
              >
                <RotateCw size={20} className="text-blue-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Girar 90°</span>
              </button>
              <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Formato</span>
                <span className="text-sm font-bold">ISO A4</span>
              </div>
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
             <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2"><Maximize size={12} /> Margens</label>
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
