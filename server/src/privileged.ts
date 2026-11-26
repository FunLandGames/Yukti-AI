// Host-only capabilities for QWARA AI. Action code stays portable; anything
// that needs Node/Bun host modules (here: zlib for PDF stream inflation)
// lives behind these typed privileged contracts.

import { inflateSync } from "node:zlib";
import {
definePrivilegedContracts,
definePrivilegedHandlers,
z,
} from "@hatch/space-sdk";

export const privileged = definePrivilegedContracts({
  extractPdfText: {
    request: z.object({ dataBase64: z.string().max(8_000_000) }),
    response: z.object({ text: z.string() }),
  },
});

function extractTextFromPdf(dataBase64: string): string {
  const bytes = Buffer.from(dataBase64, "base64");
  const raw = bytes.toString("latin1");
  const chunks: string[] = [];
  const streamRe = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(raw)) !== null) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    const slice = bytes.subarray(start, end);
    try {
      const inflated = inflateSync(slice).toString("latin1");
      if (inflated.includes("BT")) chunks.push(inflated);
    } catch {
      /* not a flate stream — skip */
    }
    streamRe.lastIndex = end + 9;
  }
  const texts: string[] = [];
  for (const chunk of chunks) {
    const tjRe = /\((?:[^()\\]|\\.)*\)\s*(?:Tj|')|\[(?:[^\[\]\\]|\\.)*\]\s*TJ/g;
    let t: RegExpExecArray | null;
    while ((t = tjRe.exec(chunk)) !== null) {
      const inner = t[0];
      const parts = inner.match(/\((?:[^()\\]|\\.)*\)/g) ?? [];
      const line = parts
        .map((p) =>
          p
            .slice(1, -1)
            .replace(/\\([()\\])/g, "$1")
            .replace(/\\n/g, " ")
            .replace(/\\r/g, " "),
        )
        .join("");
      if (line.trim()) texts.push(line);
    }
  }
  return texts.join("\n").slice(0, 14000);
}

export const privilegedHandlers = definePrivilegedHandlers(privileged, {
  extractPdfText(args) {
    return { text: extractTextFromPdf(args.dataBase64) };
  },
});
