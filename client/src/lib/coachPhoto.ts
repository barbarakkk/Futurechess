// Shared between BecomeCoachPage (application wizard) and CoachDashboardPage (profile
// editing) — client-side photo resize before it's sent to the server as a data URL.

// Standard square size every uploaded coach photo is resized to before it's sent to the server.
export const PHOTO_MAX_DIMENSION = 320;
export const PHOTO_MAX_SOURCE_BYTES = 8 * 1024 * 1024; // 8MB cap on the original file, before resizing

/** Resizes/crops an image file to a standard square JPEG and returns it as a data URL. */
export async function resizeImageToDataUrl(file: File): Promise<string> {
  if (file.size > PHOTO_MAX_SOURCE_BYTES) {
    throw new Error("Image too large");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not read image"));
      img.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_MAX_DIMENSION;
    canvas.height = PHOTO_MAX_DIMENSION;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas not supported");
    }

    const sourceSize = Math.min(image.width, image.height);
    const sourceX = (image.width - sourceSize) / 2;
    const sourceY = (image.height - sourceSize) / 2;
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      PHOTO_MAX_DIMENSION,
      PHOTO_MAX_DIMENSION,
    );

    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
