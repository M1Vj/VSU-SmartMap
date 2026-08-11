import imageCompression from "browser-image-compression";
import { STORAGE_LIMITS } from "@/lib/constants/storage";

export type CompressionResult = {
  file: File;
  originalSize: number;
  compressedSize: number;
  format: string;
};

interface CompressionStep {
  quality: number;
  maxDimension: number;
}

const COMPRESSION_STEPS: CompressionStep[] = [
  { quality: 0.8, maxDimension: 1920 },
  { quality: 0.7, maxDimension: 1600 },
  { quality: 0.6, maxDimension: 1400 },
  { quality: 0.5, maxDimension: 1200 },
  { quality: 0.4, maxDimension: 1000 },
  { quality: 0.3, maxDimension: 900 },
  { quality: 0.25, maxDimension: 800 },
  { quality: 0.2, maxDimension: 700 },
  { quality: 0.15, maxDimension: 600 },
  { quality: 0.1, maxDimension: 500 },
];

const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"]);

const hasHeicExtension = (name: string) => /\.(heic|heif)$/i.test(name);

async function decodeHeic(file: File): Promise<File> {
  if (!HEIC_MIME_TYPES.has(file.type.toLowerCase()) && !hasHeicExtension(file.name)) {
    return file;
  }

  try {
    const { heicTo, isHeic } = await import("heic-to/csp");
    if (!(await isHeic(file))) {
      throw new Error("The selected file is not a valid HEIC or HEIF image.");
    }

    const jpeg = await heicTo({
      blob: file,
      type: "image/jpeg",
      quality: 0.92,
    });
    const jpegName = file.name.includes(".")
      ? file.name.replace(/\.[^.]+$/, ".jpg")
      : `${file.name}.jpg`;

    return new File([jpeg], jpegName, { type: "image/jpeg" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown decoding error";
    throw new Error(
      `We couldn't read this HEIC/HEIF image. It may be damaged or use an unsupported variant. Try exporting it as JPEG, PNG, or WebP. (${detail})`,
    );
  }
}

export async function compressImage(file: File): Promise<CompressionResult> {
  const { compression, compressedMaxMB } = STORAGE_LIMITS;
  const targetBytes = compressedMaxMB * 1024 * 1024;
  const compressionSource = await decodeHeic(file);

  const webpName = file.name.includes(".")
    ? file.name.replace(/\.[^.]+$/, ".webp")
    : `${file.name}.webp`;

  for (const step of COMPRESSION_STEPS) {
    const options = {
      maxSizeMB: compressedMaxMB,
      maxWidthOrHeight: step.maxDimension,
      useWebWorker: compression.useWebWorker,
      fileType: compression.fileType,
      initialQuality: step.quality,
    };

    try {
      const compressedBlob = await imageCompression(compressionSource, options);
      const compressedFile = new File([compressedBlob], webpName, {
        type: "image/webp",
      });

      if (compressedFile.size <= targetBytes) {
        return {
          file: compressedFile,
          originalSize: file.size,
          compressedSize: compressedFile.size,
          format: "webp",
        };
      }
    } catch (error) {
      throw new Error(
        `Image compression failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  const finalStep = COMPRESSION_STEPS[COMPRESSION_STEPS.length - 1];
  const compressedBlob = await imageCompression(compressionSource, {
    maxSizeMB: compressedMaxMB,
    maxWidthOrHeight: finalStep.maxDimension,
    useWebWorker: compression.useWebWorker,
    fileType: compression.fileType,
    initialQuality: finalStep.quality,
  });

  const finalFile = new File([compressedBlob], webpName, {
    type: "image/webp",
  });

  return {
    file: finalFile,
    originalSize: file.size,
    compressedSize: finalFile.size,
    format: "webp",
  };
}
