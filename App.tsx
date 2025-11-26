import React, { useState, useCallback } from 'react';
import { Upload, Camera, FileText, X } from 'lucide-react';
import CropEditor from './components/CropEditor';
import ScannerProcessor from './components/ScannerProcessor';
import { performWarp } from './utils/imageProcessing';
import { Point } from './types';

enum AppState {
  UPLOAD,
  CROP,
  PROCESS
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [warpedImage, setWarpedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // Armazena a última configuração de recorte para não perder ao voltar
  const [lastCorners, setLastCorners] = useState<Point[] | null>(null);

  // Processa o arquivo de imagem (vindo do input ou do drop)
  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert("Por favor, envie apenas arquivos de imagem.");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setSourceImage(event.target.result as string);
        setLastCorners(null); // Nova imagem, reseta o recorte anterior
        setAppState(AppState.CROP);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleCropConfirm = async (corners: Point[]) => {
    if (!sourceImage) return;
    setLastCorners(corners); // Salva o estado atual
    setIsProcessing(true);
    try {
      // Load source image element
      const img = new Image();
      img.src = sourceImage;
      await new Promise(resolve => img.onload = resolve);
      
      // Perform the mathematical perspective warp (no AI)
      const resultDataUrl = await performWarp(img, corners);
      
      setWarpedImage(resultDataUrl);
      setAppState(AppState.PROCESS);
    } catch (error) {
      console.error("Processing failed", error);
      alert("Falha ao processar imagem. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetApp = () => {
    setSourceImage(null);
    setWarpedImage(null);
    setLastCorners(null);
    setAppState(AppState.UPLOAD);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Header - Only show if not printing */}
      <header className="no-print h-14 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <FileText size={20} className="text-white" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">DocuClear <span className="text-blue-500 font-normal">Pro</span></h1>
        </div>
        {appState !== AppState.UPLOAD && (
          <button onClick={resetApp} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        )}
      </header>

      <main className="flex-1 relative overflow-hidden">
        {appState === AppState.UPLOAD && (
          <div className="h-full flex flex-col items-center justify-center p-6 animate-fade-in">
            <div className="max-w-md w-full text-center space-y-8">
              <div className="space-y-2">
                <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                  Digitalize Documentos
                </h2>
                <p className="text-slate-400 text-lg">
                  Ajuste bordas, limpe ruídos e prepare para impressão A4. 100% Algorítmico. Zero IA.
                </p>
              </div>

              <div className="grid gap-4">
                <label 
                  className={`group relative flex flex-col items-center justify-center h-48 rounded-2xl border-2 border-dashed transition-all cursor-pointer
                    ${dragActive 
                      ? 'border-blue-500 bg-blue-500/10 scale-[1.02]' 
                      : 'border-slate-700 bg-slate-900/50 hover:bg-slate-800/50 hover:border-blue-500 hover:scale-[1.02]'
                    }
                  `}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center gap-3 pointer-events-none">
                    <div className={`p-4 rounded-full transition-colors ${dragActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-blue-500 group-hover:bg-blue-600/20'}`}>
                      <Upload size={32} />
                    </div>
                    <span className={`font-medium transition-colors ${dragActive ? 'text-blue-400' : 'text-slate-300 group-hover:text-blue-400'}`}>
                      {dragActive ? "Solte a imagem aqui" : "Carregar ou Arrastar Imagem"}
                    </span>
                  </div>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>

                <label className="group relative flex items-center justify-center p-4 rounded-xl bg-slate-800 hover:bg-slate-700 transition-all cursor-pointer active:scale-95">
                  <div className="flex items-center gap-3">
                    <Camera size={24} className="text-emerald-400" />
                    <span className="font-semibold text-white">Tirar Foto</span>
                  </div>
                  <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
                </label>
              </div>

              <p className="text-xs text-slate-600">
                Processamento local no navegador. Seus documentos não são enviados para nenhum servidor.
              </p>
            </div>
          </div>
        )}

        {appState === AppState.CROP && sourceImage && (
          <>
             {isProcessing ? (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-4"></div>
                  <p className="text-xl font-medium text-blue-400">Aplicando Correção de Perspectiva...</p>
                </div>
             ) : (
                <CropEditor 
                  imageSrc={sourceImage} 
                  initialCorners={lastCorners}
                  onConfirm={handleCropConfirm} 
                  onCancel={() => setAppState(AppState.UPLOAD)} 
                />
             )}
          </>
        )}

        {appState === AppState.PROCESS && warpedImage && (
          <ScannerProcessor 
            warpedImageSrc={warpedImage} 
            onBack={() => setAppState(AppState.CROP)} 
          />
        )}
      </main>
    </div>
  );
};

export default App;