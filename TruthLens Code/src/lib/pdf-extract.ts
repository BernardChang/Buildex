// Client-only PDF / DOCX / TXT text extraction.
import mammoth from "mammoth";

export async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    return await file.text();
  }
  if (name.endsWith(".docx")) {
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value;
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return await extractPdf(file);
  }
  // Fallback: try as text
  return await file.text();
}

async function extractPdf(file: File): Promise<string> {
  // Dynamic import to keep pdfjs out of the SSR bundle.
  const pdfjs = await import("pdfjs-dist");
  // Use the bundled worker via Vite ?url import
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  (pdfjs.GlobalWorkerOptions as { workerSrc: string }).workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  const maxPages = Math.min(pdf.numPages, 60);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: unknown) => (typeof (item as { str?: string }).str === "string" ? (item as { str: string }).str : ""))
      .join(" ");
    parts.push(text);
  }
  return parts.join("\n\n");
}
