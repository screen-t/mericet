import { cropToCanvas, type PixelCrop } from "react-image-crop";

/**
 * Crops the given rendered <img> element to the given pixel crop (in the
 * image's DISPLAYED coordinate space, exactly as produced by react-image-crop's
 * onComplete) and returns the result as a Blob. cropToCanvas handles scaling
 * from displayed size to the image's real natural size internally.
 */
export async function getCroppedImageBlob(
  image: HTMLImageElement,
  crop: PixelCrop,
  outputType: string = "image/jpeg",
  quality: number = 0.92
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await cropToCanvas(image, canvas, crop);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas produced an empty image"))),
      outputType,
      quality
    );
  });
}
