'use client';

/** Draw-to-sign canvas. Exposes the drawing as a PNG data URL for upload. */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toDataUrl: () => string;
};

const SignaturePad = forwardRef<SignaturePadHandle, { width?: number; height?: number }>(
  function SignaturePad({ width = 480, height = 180 }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const hasDrawn = useRef(false);
    const [empty, setEmpty] = useState(true);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Render at device pixel ratio for a crisp line, scaled back down via CSS.
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0a1420';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }, [width, height]);

    function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
      const rect = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function start(e: React.PointerEvent<HTMLCanvasElement>) {
      drawing.current = true;
      const ctx = canvasRef.current!.getContext('2d')!;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      canvasRef.current!.setPointerCapture(e.pointerId);
    }

    function move(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current) return;
      const ctx = canvasRef.current!.getContext('2d')!;
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      hasDrawn.current = true;
      setEmpty(false);
    }

    function end() {
      drawing.current = false;
    }

    useImperativeHandle(ref, () => ({
      clear() {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        hasDrawn.current = false;
        setEmpty(true);
      },
      isEmpty: () => !hasDrawn.current,
      toDataUrl: () => canvasRef.current?.toDataURL('image/png') ?? '',
    }), [width, height]);

    return (
      <div className="signature-pad">
        <canvas
          ref={canvasRef}
          style={{ width, height, touchAction: 'none' }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {empty && <span className="signature-pad-hint">Draw your signature here</span>}
      </div>
    );
  }
);

export default SignaturePad;
