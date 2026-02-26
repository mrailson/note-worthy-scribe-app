import { useState } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Printer, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";

const GPContract = () => {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(100);

  const handlePrint = () => {
    const iframe = document.getElementById('gp-contract-iframe') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.print();
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/documents/gp-contract-2627.html';
    link.download = 'gp-contract-2626-27-infographic.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <div className="flex items-center gap-2 px-4 py-2 border-b flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-lg font-semibold flex-1">GP Contract 2026/27 Update</h1>
        
        {/* Zoom controls */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-full px-3 py-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(Math.max(25, zoom - 10))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Slider
            value={[zoom]}
            onValueChange={(v) => setZoom(v[0])}
            min={25}
            max={200}
            step={5}
            className="w-24 sm:w-32"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(Math.min(200, zoom + 10))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(100)}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button variant="outline" size="sm" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Print</span>
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Download</span>
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <iframe
          id="gp-contract-iframe"
          src="/documents/gp-contract-2627.html"
          className="border-0"
          title="GP Contract 2026/27 Infographic"
          style={{
            width: `${10000 / zoom}%`,
            height: `${10000 / zoom}vh`,
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    </div>
  );
};

export default GPContract;
