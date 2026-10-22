"use client";

import jsQR from "jsqr";
import { useEffect, useRef, useState } from "react";

/**
 * Reads the QR code from the visitor's invitation (FR-KIO-09), or an employee's personal QR
 * on the reception screen (FR-EMP-01); `what` names the code in the instructions.
 * Uses the live camera when the browser allows it (HTTPS or localhost). Over plain HTTP on the
 * office Wi-Fi getUserMedia is blocked, so it falls back to taking a photo of the code, the same
 * way the photo step does.
 */
type Props = { onDetected: (text: string) => void; what?: string };

export default function InviteScanner({ onDetected, what = "the QR code in your invitation" }: Props) {
  const [mode, setMode] = useState<"live" | "photo" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    // mediaDevices is missing entirely on plain HTTP, despite what the TS types say.
    setMode(window.isSecureContext && "mediaDevices" in navigator ? "live" : "photo");
  }, []);

  useEffect(() => {
    if (mode !== "live") return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    let lastScan = 0;

    const scan = (time: number) => {
      if (stopped) return;
      const video = videoRef.current;
      // A few frames a second is plenty and keeps older phones cool.
      if (video && video.readyState >= 2 && time - lastScan > 200) {
        lastScan = time;
        const text = decodeQr(video, video.videoWidth, video.videoHeight, 640, false);
        if (text) {
          stopped = true;
          stream?.getTracks().forEach((t) => t.stop());
          onDetectedRef.current(text);
          return;
        }
      }
      frame = requestAnimationFrame(scan);
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped || !videoRef.current) return stream.getTracks().forEach((t) => t.stop());
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        frame = requestAnimationFrame(scan);
      } catch {
        // Permission denied or no camera: a photo still works.
        if (!stopped) setMode("photo");
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [mode]);

  const onFile = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    const text = await decodePhoto(file);
    input.value = ""; // let the same image be picked again
    if (text) onDetectedRef.current(text);
    else setError("We couldn't find a QR code in that image. Make sure the code is clear and fills most of the picture.");
  };

  // No `capture` attribute, so phones offer the gallery/files, e.g. a screenshot of the invite.
  const upload = (
    <>
      <input ref={uploadRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.currentTarget)} />
      <button className="secondary" onClick={() => uploadRef.current?.click()} disabled={!mode}>Upload QR image</button>
    </>
  );

  if (mode === "live") {
    return (
      <>
        <video ref={videoRef} className="scanner" muted playsInline aria-label={`Camera view for scanning ${what}`} />
        <p className="muted small">Point the camera at {what}, or upload a screenshot of it.</p>
        {upload}
        {error && <p className="error" role="alert">{error}</p>}
      </>
    );
  }

  return (
    <>
      <p className="muted">Take a photo of {what}, or upload a screenshot of it.</p>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.currentTarget)} />
      <button onClick={() => inputRef.current?.click()} disabled={!mode}>Open camera</button>
      {upload}
      {error && <p className="error" role="alert">{error}</p>}
    </>
  );
}

let canvas: HTMLCanvasElement | null = null;

/** Draws the image scaled down to `max` px and looks for a QR code in it. */
function decodeQr(source: CanvasImageSource, width: number, height: number, max: number, thorough: boolean) {
  if (!width || !height) return null;
  const scale = Math.min(1, max / Math.max(width, height));
  canvas ??= document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(data, canvas.width, canvas.height, { inversionAttempts: thorough ? "attemptBoth" : "dontInvert" })?.data ?? null;
}

async function decodePhoto(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // Try a small size first (fast), then a larger one for codes that are small in the photo.
    return decodeQr(img, img.width, img.height, 800, true) ?? decodeQr(img, img.width, img.height, 1600, true);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
