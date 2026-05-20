import { writable } from 'svelte/store';

export const activeOcrRuns = writable<Set<string>>(new Set());

/**
 * Performs local OCR on a given image source (Data URL or Blob) using Tesseract.js.
 * Dynamically imports tesseract.js to avoid bloating the initial SvelteKit page bundle.
 */
export async function performOCR(imageSrc: string): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  let worker;
  try {
    // Create worker using English model. Tesseract.js handles worker/core instantiation automatically.
    worker = await createWorker('eng');
    const { data: { text } } = await worker.recognize(imageSrc);
    return text;
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (err) {
        console.error('Failed to terminate Tesseract worker:', err);
      }
    }
  }
}
