import React, { useEffect, useRef, useState } from 'react';
import { ProcessorSettings } from '../types';
import { applyFilters } from '../utils/imageProcessing';
import { Printer, Download, ArrowLeft, Settings2, Sun, Type, Eye } from 'lucide-react';

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
    mode: 'enhanced',
  });

  // Re-run processing when settings change
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

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      applyFilters(ctx, canvas.width, canvas.height, settings);
      
      // Update print source
      setPrintSrc(canvas.toDataURL('image/png'));
      
      setIsProcessing(false);
    };

    process();
  }, [warpedImageSrc, settings]);

  // Robust printing method using invisible iframe
  const handlePrint = () => {
    if (isProcessing || !printSrc) return;
    
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    
    const content = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Imprimir Documento</title>
          <style>
            @page { margin: 0; size: A4; }
            body { 
                margin: 0; 
                padding: 0; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                background: white;
            }
            img { 
                width: 100%; 
                height: 100%; 
                object-fit: contain; 
            }
          </style>
        </head>
        <body>
          <img src="${printSrc}" onload="window.print(); setTimeout(() => window.close(), 500);" />
        </body>
      </html>
    `;
    
    const doc = iframe.contentWindow?.document;
    if (doc) {
        doc.open();
        doc.write(content);
        doc.close();
    }
    
    // Cleanup iframe after a delay to ensure print dialog opened
    setTimeout(() => {
        document.body.removeChild(iframe);
    }, 2000);
  };

  const updateSetting = (key: keyof ProcessorSettings, value: number | string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Preview Area (A4 Simulation) */}
        <div className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-950 p-8 flex justify-center items-start min-h-0">
          <div className="no-print relative shadow-xl bg-white aspect-[210/297] w-full max-w-[500px] lg:max-w-[600px] transition-opacity duration-200" style={{ opacity: isProcessing ? 0.6 : 1 }}>
             <canvas ref={canvasRef} className="w-full h-full object-contain" />
             {isProcessing && (
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
               </div>
             )}
          </div>
        </div>

        {/* Controls Sidebar */}
        <div className="no-print w-full lg:w-80 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 p-6 overflow-y-auto z-20 shadow-lg">
           <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
             <Settings2 className="w-5 h-5 text-blue-500" />
             Ajustes Finais
           </h2>

           {/* Mode Selection */}
           <div className="mb-6">
             <label className="block text-sm font-medium mb-2 text-slate-600 dark:text-slate-400">Modo de Digitalização</label>
             <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => updateSetting('mode', 'original')}
                  className={`p-2 text-sm rounded border ${settings.mode === 'original' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-slate-300 dark:border-slate-600'}`}
                >
                  Original
                </button>
                <button 
                   onClick={() => updateSetting('mode', 'enhanced')}
                   className={`p-2 text-sm rounded border ${settings.mode === 'enhanced' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-slate-300 dark:border-slate-600'}`}
                >
                  Melhorado
                </button>
                <button 
                   onClick={() => updateSetting('mode', 'grayscale')}
                   className={`p-2 text-sm rounded border ${settings.mode === 'grayscale' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-slate-300 dark:border-slate-600'}`}
                >
                  P/B (Foto)
                </button>
                <button 
                   onClick={() => updateSetting('mode', 'binary')}
                   className={`p-2 text-sm rounded border ${settings.mode === 'binary' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'border-slate-300 dark:border-slate-600'}`}
                >
                  Binário (Texto)
                </button>
             </div>
           </div>

           {/* Sliders */}
           <div className="space-y-6">
             {settings.mode === 'binary' && (
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-medium flex items-center gap-2"><Type size={14} /> Limiar (Threshold)</label>
                    <span className="text-xs text-slate-500">{settings.threshold}</span>
                  </div>
                  <input 
                    type="range" min="0" max="255" 
                    value={settings.threshold} 
                    onChange={(e) => updateSetting('threshold', parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
             )}

             <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium flex items-center gap-2"><Eye size={14} /> Nitidez</label>
                  <span className="text-xs text-slate-500">{settings.sharpness}%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={settings.sharpness} 
                  onChange={(e) => updateSetting('sharpness', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
             </div>

             <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium flex items-center gap-2"><Sun size={14} /> Brilho</label>
                  <span className="text-xs text-slate-500">{settings.brightness}</span>
                </div>
                <input 
                  type="range" min="-100" max="100" 
                  value={settings.brightness} 
                  onChange={(e) => updateSetting('brightness', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
             </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="text-sm font-medium flex items-center gap-2"><div className="w-3.5 h-3.5 rounded-full border border-current opacity-70" /> Contraste</label>
                  <span className="text-xs text-slate-500">{settings.contrast}</span>
                </div>
                <input 
                  type="range" min="-100" max="100" 
                  value={settings.contrast} 
                  onChange={(e) => updateSetting('contrast', parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
             </div>
           </div>

           {/* Actions */}
           <div className="mt-8 space-y-3">
             <button 
               onClick={handlePrint}
               disabled={isProcessing}
               className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-wait text-white rounded-lg font-semibold shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"
             >
               <Printer size={20} />
               {isProcessing ? 'Processando...' : 'Imprimir A4'}
             </button>
             
             <button 
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = `scan-${Date.now()}.png`;
                  link.href = canvasRef.current?.toDataURL() || '';
                  link.click();
                }}
                className="w-full py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
             >
               <Download size={20} />
               Baixar Imagem
             </button>

             <button 
               onClick={onBack}
               className="w-full py-3 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center gap-2"
             >
               <ArrowLeft size={16} />
               Editar Recorte
             </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ScannerProcessor;