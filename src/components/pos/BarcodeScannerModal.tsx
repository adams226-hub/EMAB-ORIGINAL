"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { FormError } from "@/components/ui/FormError";

// L'API BarcodeDetector n'est pas encore dans lib.dom.d.ts de TypeScript.
interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

export function BarcodeScannerModal({
  open,
  onClose,
  onDetect,
}: {
  open: boolean;
  onClose: () => void;
  onDetect: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!open) return;

    if (typeof window === "undefined" || !window.BarcodeDetector) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const detector = new window.BarcodeDetector({
      formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
    });

    let cancelled = false;
    let frameId: number;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onDetect(codes[0].rawValue);
              return;
            }
          } catch {
            // frame pas encore prête — on continue la boucle
          }
          frameId = requestAnimationFrame(scan);
        };
        frameId = requestAnimationFrame(scan);
      })
      .catch(() => setError("Impossible d'accéder à la caméra. Vérifiez les autorisations du navigateur."));

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, onDetect]);

  return (
    <Modal open={open} onClose={onClose} title="Scanner un code-barres">
      <div className="space-y-3">
        <FormError message={error} />
        {supported ? (
          <div className="overflow-hidden rounded-xl bg-slate-900">
            <video ref={videoRef} className="aspect-video w-full" muted playsInline />
          </div>
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Le scan de code-barres n&apos;est pas supporté par ce navigateur. Utilisez la recherche par nom
            ou SKU à la place — fonctionne sur Chrome/Edge Android et les navigateurs récents.
          </p>
        )}
        <p className="text-center text-xs text-slate-400">Présentez le code-barres devant la caméra.</p>
      </div>
    </Modal>
  );
}
