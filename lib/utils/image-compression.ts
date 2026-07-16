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

export async function compressImage(file: File): Promise<CompressionResult> {
  const { compression, compressedMaxMB } = STORAGE_LIMITS;
  const targetBytes = compressedMaxMB * 1024 * 1024;

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
      const compressedBlob = await imageCompression(file, options);
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
  const compressedBlob = await imageCompression(file, {
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
