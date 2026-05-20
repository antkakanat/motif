import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js to fetch from HuggingFace CDN and store locally in the browser's Cache Storage
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton model pipeline
let extractor: any = null;

async function getExtractor(progressCallback?: (data: any) => void): Promise<any> {
  if (extractor) return extractor;
  
  extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    progress_callback: progressCallback
  });
  return extractor;
}

// Listen for message events from Svelte client
self.addEventListener('message', async (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === 'LOAD_MODEL') {
    try {
      await getExtractor((data: any) => {
        if (data.status === 'progress') {
          self.postMessage({
            type: 'PROGRESS',
            payload: {
              file: data.file,
              progress: data.progress,
              loaded: data.loaded,
              total: data.total
            }
          });
        }
      });
      self.postMessage({ type: 'READY' });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', payload: err.message || 'Failed to load AI model' });
    }
  } else if (type === 'GET_EMBEDDING') {
    try {
      const { text, captureId } = payload;
      const pipe = await getExtractor();
      const output = await pipe(text, { pooling: 'mean', normalize: true });
      const embedding = Array.from(output.data) as number[];
      self.postMessage({
        type: 'EMBEDDING_RESULT',
        payload: { captureId, embedding }
      });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', payload: err.message || 'Failed to compute embedding' });
    }
  } else if (type === 'COMPUTE_BATCH') {
    try {
      const { items } = payload; // items: Array<{ id: string, text: string }>
      const pipe = await getExtractor();
      const results = [];
      
      for (const item of items) {
        const output = await pipe(item.text, { pooling: 'mean', normalize: true });
        const embedding = Array.from(output.data) as number[];
        results.push({ captureId: item.id, embedding });
      }
      
      self.postMessage({
        type: 'BATCH_RESULT',
        payload: { results }
      });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', payload: err.message || 'Failed to compute batch embeddings' });
    }
  }
});
