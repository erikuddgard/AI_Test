import { parseResults, type Entry } from "./league";

// The image stays in the browser. Only the reviewed names/ranks are sent when saving.
export async function recognizeResults(
  file: File,
  onProgress: (status: string) => void,
): Promise<{ text: string; entries: Entry[] }> {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const base = new URL(`${import.meta.env.BASE_URL}ocr/`, location.origin).href;
  const worker = await createWorker(["swe", "eng"], OEM.LSTM_ONLY, {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core`,
    langPath: `${base}lang`,
    cacheMethod: "none",
    workerBlobURL: false,
    logger(message) {
      if (message.status === "recognizing text")
        onProgress(`Läser resultatet… ${Math.round(message.progress * 100)} %`);
      else if (message.status === "loading language traineddata")
        onProgress("Hämtar språk för bildavläsning…");
      else onProgress("Förbereder bildavläsningen…");
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const { data } = await worker.recognize(file);
    return { text: data.text, entries: parseResults(data.text) };
  } finally {
    await worker.terminate();
  }
}
