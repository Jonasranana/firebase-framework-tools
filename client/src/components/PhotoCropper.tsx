import { useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw, ZoomIn } from "lucide-react";

// Recadrage de la photo de profil : on déplace l'image avec la souris ou le
// doigt, on règle le zoom et on pivote par quarts de tour ; le résultat est une
// image carrée de 400 × 400 px (JPEG) affichée en rond dans le CRM.
const VIEW = 280; // taille de la zone de recadrage à l'écran
const OUT = 400; // taille de l'image enregistrée

export default function PhotoCropper({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  onDone: (blob: Blob) => void;
}) {
  const [src, setSrc] = useState("");
  const [nat, setNat] = useState({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Dimensions de l'image après rotation, et échelle qui la fait couvrir la zone.
  const swap = rot % 180 !== 0;
  const rw = swap ? nat.h : nat.w;
  const rh = swap ? nat.w : nat.h;
  const base = VIEW / Math.min(rw, rh);
  const scale = base * zoom;

  // L'image ne doit jamais laisser de vide dans la zone de recadrage.
  const clamp = (p: { x: number; y: number }) => {
    const mx = Math.max(0, (rw * scale - VIEW) / 2);
    const my = Math.max(0, (rh * scale - VIEW) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  };
  useEffect(() => setPos((p) => clamp(p)), [zoom, rot, nat]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const img = imgRef.current;
    if (!img) return;
    const k = OUT / VIEW;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = OUT;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, OUT, OUT);
    ctx.translate(OUT / 2 + pos.x * k, OUT / 2 + pos.y * k);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(scale * k, scale * k);
    ctx.drawImage(img, -nat.w / 2, -nat.h / 2);
    canvas.toBlob((b) => b && onDone(b), "image/jpeg", 0.88);
  };

  return (
    <div className="space-y-4">
      <div
        className="relative mx-auto overflow-hidden rounded-xl bg-gray-900 touch-none select-none cursor-grab active:cursor-grabbing"
        style={{ width: VIEW, height: VIEW }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setPos(clamp({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }));
        }}
        onPointerUp={() => (drag.current = null)}
      >
        {src && (
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: nat.w,
              height: nat.h,
              maxWidth: "none",
              transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${rot}deg) scale(${scale})`,
            }}
          />
        )}
        {/* masque rond : ce qui sera visible dans le CRM */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(circle at center, transparent ${VIEW / 2 - 1}px, rgba(0,0,0,0.55) ${VIEW / 2}px)` }}
        />
        <div className="absolute inset-0 pointer-events-none rounded-full border-2 border-white/80" />
      </div>

      <div className="flex items-center gap-3 px-2">
        <ZoomIn size={16} className="text-gray-500 shrink-0" />
        <input
          type="range"
          min={1}
          max={3}
          step={0.02}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1"
          aria-label="Zoom"
        />
        <button onClick={() => setRot((r) => (r + 270) % 360)} aria-label="Pivoter à gauche" className="p-1.5 rounded-md hover:bg-gray-100">
          <RotateCcw size={18} />
        </button>
        <button onClick={() => setRot((r) => (r + 90) % 360)} aria-label="Pivoter à droite" className="p-1.5 rounded-md hover:bg-gray-100">
          <RotateCw size={18} />
        </button>
      </div>
      <p className="text-xs text-gray-400 text-center">Glissez la photo pour la cadrer, réglez le zoom, pivotez si besoin.</p>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-sm font-semibold text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100">
          Annuler
        </button>
        <button onClick={save} className="text-sm font-bold text-white bg-[#2b5a8f] px-4 py-2 rounded-lg">
          Utiliser cette photo
        </button>
      </div>
    </div>
  );
}
