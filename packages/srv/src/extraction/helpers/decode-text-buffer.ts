export interface DecodedTextBuffer {
  text: string;
  encoding: "utf-8" | "utf-8-bom" | "utf-16le" | "utf-16be";
}

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

function decodeUtf16Be(buffer: Buffer): string {
  const swapped = Buffer.from(buffer);
  swapped.swap16();
  return swapped.toString("utf16le");
}

/**
 * Text uploads can come from bank portals as UTF-16LE CSV files. Decoding those
 * bytes as UTF-8 produces replacement chars plus raw control chars (`\u0005`),
 * which then break structured AI JSON responses.
 */
export function decodeTextBuffer(buffer: Buffer): DecodedTextBuffer {
  if (buffer.length >= 2) {
    const first = buffer[0];
    const second = buffer[1];

    if (first === 0xff && second === 0xfe) {
      return {
        text: stripBom(buffer.toString("utf16le")),
        encoding: "utf-16le",
      };
    }

    if (first === 0xfe && second === 0xff) {
      return {
        text: stripBom(decodeUtf16Be(buffer)),
        encoding: "utf-16be",
      };
    }
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  ) {
    return {
      text: stripBom(buffer.toString("utf-8")),
      encoding: "utf-8-bom",
    };
  }

  return {
    text: buffer.toString("utf-8"),
    encoding: "utf-8",
  };
}
