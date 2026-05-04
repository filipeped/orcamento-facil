import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Eraser, Pen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SignaturePadHandle {
  clear: () => void;
  getDataURL: () => string | null;
  isEmpty: () => boolean;
}

interface SignaturePadProps {
  width?: number;
  height?: number;
  className?: string;
  strokeColor?: string;
  strokeWidth?: number;
  initialDataURL?: string;
  onChange?: (dataURL: string | null) => void;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  (
    {
      width = 600,
      height = 200,
      className,
      strokeColor = "#0f172a",
      strokeWidth = 2.2,
      initialDataURL,
      onChange,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [hasInk, setHasInk] = useState(false);

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;

    const getCtx = () => canvasRef.current?.getContext("2d") ?? null;

    const resetCanvas = () => {
      const canvas = canvasRef.current;
      const ctx = getCtx();
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = getCtx();
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      resetCanvas();

      if (initialDataURL) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, width, height);
          setHasInk(true);
        };
        img.src = initialDataURL;
      }
    }, [width, height, dpr, strokeColor, strokeWidth, initialDataURL]);

    const pointerPos = (e: PointerEvent | React.PointerEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (width / rect.width);
      const y = (e.clientY - rect.top) * (height / rect.height);
      return { x, y };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      canvasRef.current?.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastPointRef.current = pointerPos(e);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const ctx = getCtx();
      if (!ctx) return;
      const last = lastPointRef.current;
      const next = pointerPos(e);
      if (last) {
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(next.x, next.y);
        ctx.stroke();
      }
      lastPointRef.current = next;
      if (!hasInk) setHasInk(true);
    };

    const handlePointerUp = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      lastPointRef.current = null;
      onChange?.(getDataURL());
    };

    const getDataURL = () => {
      if (!hasInk) return null;
      return canvasRef.current?.toDataURL("image/png") ?? null;
    };

    const clear = () => {
      resetCanvas();
      setHasInk(false);
      onChange?.(null);
    };

    useImperativeHandle(ref, () => ({
      clear,
      getDataURL,
      isEmpty: () => !hasInk,
    }));

    return (
      <div className={cn("space-y-2", className)}>
        <div className="relative rounded-xl border-2 border-dashed border-neutral-300 bg-white overflow-hidden">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="block touch-none cursor-crosshair w-full max-w-full"
            style={{ height }}
          />
          {!hasInk && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-neutral-400">
              <Pen className="w-6 h-6 mb-1 opacity-40" />
              <span className="text-xs">Assine aqui</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>Use o dedo no celular ou o mouse no computador</span>
          <button
            type="button"
            onClick={clear}
            disabled={!hasInk}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Eraser className="w-3.5 h-3.5" />
            Limpar
          </button>
        </div>
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";
