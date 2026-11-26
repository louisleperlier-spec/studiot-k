import 'server-only';
import { inflateRawSync } from 'node:zlib';

/**
 * Reads the text files of a small zip (TikTok exports its CSVs as a zip).
 * Supports stored and deflated entries, which is all TikTok and the OS "compress" menus produce.
 */
export function readZipTexts(buf: Buffer, accept = /\.csv$/i, maxBytes = 5_000_000): { name: string; text: string }[] {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Ce fichier n'est pas un zip lisible.");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out: { name: string; text: string }[] = [];
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    p += 46 + nameLen + extraLen + commentLen;
    const base = name.split('/').pop() ?? name;
    if (!accept.test(base) || base.startsWith('._') || usize > maxBytes) continue;
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    const raw = method === 0 ? data : method === 8 ? inflateRawSync(data) : null;
    if (raw) out.push({ name: base, text: raw.toString('utf8') });
  }
  return out;
}
