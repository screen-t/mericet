import { useEffect, useRef, useState } from "react";
import ReactCrop, { centerCrop, makeAspectCrop, convertToPixelCrop, type Crop, type PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getCroppedImageBlob } from "@/lib/imageCrop";

export interface AspectOption {
  label: string;
  value: number;
}

export interface ImageCropDialogProps {
  open: boolean;
  imageSrc: string | null;
  /** Current aspect ratio (width / height). */
  aspect: number;
  /** Optional selectable aspect presets shown as buttons above the cropper. */
  aspectOptions?: AspectOption[];
  onAspectChange?: (aspect: number) => void;
  cropShape?: "rect" | "round";
  title?: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

function centeredAspectCrop(width: number, height: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, aspect, width, height),
    width,
    height
  );
}

export function ImageCropDialog({
  open,
  imageSrc,
  aspect,
  aspectOptions,
  onAspectChange,
  cropShape = "rect",
  title = "Adjust image",
  onCancel,
  onConfirm,
}: ImageCropDialogProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset crop state only when we get a genuinely new image to crop (e.g.
  // moving to the next image in a multi-image post) — NOT reactively right
  // after confirm/cancel, and NOT when imageSrc clears to null on close.
  // Radix keeps the dialog mounted and fading out for a beat after `open`
  // flips to false, so any state reset in that window is briefly visible as
  // a flash back to "not applied yet" right before the dialog disappears.
  useEffect(() => {
    if (!imageSrc) return;
    setCrop(undefined);
    setCompletedCrop(null);
    setIsProcessing(false);
  }, [imageSrc]);

  // Re-center the crop to match the new aspect whenever it changes (e.g. the
  // user switches Square/Portrait/Landscape for a post image) on an
  // already-loaded image.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.width && img.height) {
      const initial = centeredAspectCrop(img.width, img.height, aspect);
      setCrop(initial);
      // ReactCrop's onComplete only fires on manual drag/resize — a
      // programmatically-set crop like this one never triggers it, which
      // left Apply silently disabled until the user nudged the box by hand.
      setCompletedCrop(convertToPixelCrop(initial, img.width, img.height));
    }
  }, [aspect]);

  const handleImageLoad: React.ReactEventHandler<HTMLImageElement> = (e) => {
    const { width, height } = e.currentTarget;
    const initial = centeredAspectCrop(width, height, aspect);
    setCrop(initial);
    setCompletedCrop(convertToPixelCrop(initial, width, height));
  };

  const handleCancel = () => {
    onCancel();
  };

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop || !completedCrop.width || !completedCrop.height) return;
    setIsProcessing(true);
    try {
      const blob = await getCroppedImageBlob(imgRef.current, completedCrop);
      onConfirm(blob);
      // Don't reset isProcessing here on success. The parent either closes
      // the dialog (imageSrc -> null, deliberately skipped by the effect
      // above) or swaps in the next queued image (imageSrc -> a new value,
      // which the effect above then resets fresh) — either way that effect
      // owns the reset, not this success path.
    } catch {
      // Leave the dialog open so the user can retry rather than silently
      // losing their crop; caller's own upload mutation reports failures.
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {aspectOptions && aspectOptions.length > 0 && (
          <div className="flex gap-2">
            {aspectOptions.map((opt) => (
              <Button
                key={opt.label}
                type="button"
                size="sm"
                variant={aspect === opt.value ? "default" : "outline"}
                onClick={() => onAspectChange?.(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        )}

        {imageSrc && (
          <div className="flex items-center justify-center max-h-[28rem] overflow-hidden bg-muted rounded-md">
            <ReactCrop
              crop={crop}
              onChange={(_pixelCrop, percentCrop) => setCrop(percentCrop)}
              onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)}
              aspect={aspect}
              circularCrop={cropShape === "round"}
              keepSelection
            >
              <img ref={imgRef} src={imageSrc} alt="Crop preview" onLoad={handleImageLoad} className="max-h-[28rem] w-auto" />
            </ReactCrop>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isProcessing}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isProcessing || !completedCrop}>
            {isProcessing ? "Applying..." : "Apply"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
