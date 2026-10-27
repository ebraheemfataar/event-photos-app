import path from "node:path";
import { expect, test } from "@playwright/test";
import { COMPRESSION_OPTIONS } from "../lib/compressOptions";

// Guards the privacy promise "we remove location from your photos": runs the
// real compression library in a real browser, with the app's options, on a
// JPEG carrying a GPS EXIF block, and checks no EXIF survives.

const LIB = path.join(
  __dirname,
  "..",
  "public",
  "vendor",
  "browser-image-compression@2.0.2.js"
);

type Result = { inputHasExif: boolean; outputHasExif: boolean; outputType: string; outputSize: number };

test("compression strips EXIF / GPS metadata", async ({ page }) => {
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ path: LIB });

  const result: Result = await page.evaluate(async (options) => {
    // --- helpers -----------------------------------------------------------
    const hasExif = (bytes: Uint8Array) => {
      // Walk JPEG markers until start-of-scan, looking for APP1 "Exif".
      let i = 2;
      while (i + 4 < bytes.length && bytes[i] === 0xff) {
        const marker = bytes[i + 1];
        if (marker === 0xda) break;
        const len = (bytes[i + 2] << 8) | bytes[i + 3];
        const tag = String.fromCharCode(...bytes.slice(i + 4, i + 8));
        if (marker === 0xe1 && tag === "Exif") return true;
        i += 2 + len;
      }
      return false;
    };

    // Minimal little-endian TIFF: IFD0 → GPS IFD (lat ref "N", lat 33° 55' 0").
    const tiff = new Uint8Array(80);
    const v = new DataView(tiff.buffer);
    tiff.set([0x49, 0x49, 0x2a, 0x00]);
    v.setUint32(4, 8, true);
    v.setUint16(8, 1, true); // IFD0: 1 entry
    v.setUint16(10, 0x8825, true); // GPSInfo pointer
    v.setUint16(12, 4, true);
    v.setUint32(14, 1, true);
    v.setUint32(18, 26, true);
    v.setUint32(22, 0, true);
    v.setUint16(26, 2, true); // GPS IFD: 2 entries
    v.setUint16(28, 0x0001, true); // GPSLatitudeRef = "N"
    v.setUint16(30, 2, true);
    v.setUint32(32, 2, true);
    tiff.set([0x4e, 0x00, 0x00, 0x00], 36);
    v.setUint16(40, 0x0002, true); // GPSLatitude, 3 rationals at offset 56
    v.setUint16(42, 5, true);
    v.setUint32(44, 3, true);
    v.setUint32(48, 56, true);
    v.setUint32(52, 0, true);
    [33, 1, 55, 1, 0, 1].forEach((n, k) => v.setUint32(56 + k * 4, n, true));

    const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
    const app1Len = 2 + exifHeader.length + tiff.length;
    const app1 = new Uint8Array([0xff, 0xe1, app1Len >> 8, app1Len & 0xff, ...exifHeader, ...tiff]);

    // --- build a GPS-tagged JPEG ------------------------------------------
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1200;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, 1600, 1200);
    g.addColorStop(0, "#FF5A1F");
    g.addColorStop(1, "#2B2BFF");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1600, 1200);
    const plain = new Uint8Array(
      await (await new Promise<Blob>((r) => canvas.toBlob((b) => r(b!), "image/jpeg", 0.92))).arrayBuffer()
    );
    const tagged = new Uint8Array(plain.length + app1.length);
    tagged.set(plain.slice(0, 2)); // SOI
    tagged.set(app1, 2);
    tagged.set(plain.slice(2), 2 + app1.length);
    const input = new File([tagged], "party.jpg", { type: "image/jpeg" });

    // --- run the library with the app's options ---------------------------
    type Lib = (file: File, opts: object) => Promise<File>;
    const imageCompression = (window as unknown as { imageCompression: Lib }).imageCompression;
    const output = await imageCompression(input, { ...options, useWebWorker: false });
    const outBytes = new Uint8Array(await output.arrayBuffer());

    return {
      inputHasExif: hasExif(tagged),
      outputHasExif: hasExif(outBytes),
      outputType: output.type,
      outputSize: output.size,
    };
  }, COMPRESSION_OPTIONS);

  expect(result.inputHasExif, "fixture should carry EXIF").toBe(true);
  expect(result.outputType).toBe("image/jpeg");
  expect(result.outputSize).toBeGreaterThan(0);
  expect(result.outputHasExif, "EXIF/GPS must be stripped").toBe(false);
});

test("app options never preserve EXIF", () => {
  expect(COMPRESSION_OPTIONS.preserveExif).toBe(false);
});
