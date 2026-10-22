"use client";
import { useEffect, useRef } from "react";

function SignaturePad({ onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  function paintWhite() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  useEffect(() => {
    paintWhite();
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  // the canvas is drawn at one size but shown at another, so we scale the position
  function getPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function start(e) {
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvasRef.current.setPointerCapture(e.pointerId);
  }

  function move(e) {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasInk.current) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  }

  function clear() {
    paintWhite();
    hasInk.current = false;
    onChange("");
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={400}
        height={160}
        className="nda-canvas"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <button type="button" className="nda-link" onClick={clear}>
        Clear signature
      </button>
    </div>
  );
}

export default SignaturePad;