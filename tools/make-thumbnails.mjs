/**
 * 生成地图用的小尺寸立绘副本（无第三方依赖：自己解码 / 缩放 / 编码 PNG）。
 *
 * 用法：node tools/make-thumbnails.mjs [目标高度，默认 192]
 *
 * 卡片用原图（800x955），地图头像只需要几十像素，用缩略图能省掉大部分流量。
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SOURCE_DIR = join(ROOT, 'assets', 'characters');
const TARGET_DIR = join(SOURCE_DIR, 'token');
const targetHeight = Number.parseInt(process.argv[2] ?? '192', 10);

function decodePng(buffer) {
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  let palette = null;
  let trns = null;
  while (pos < buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString('ascii', pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8) throw new Error('只支持 8 位色深');
      if (data[12] !== 0) throw new Error('不支持隔行扫描');
      colorType = data[9];
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + length;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (channels === undefined) throw new Error('不支持的颜色类型 ' + colorType);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[offset];
    offset += 1;
    const line = Buffer.from(raw.subarray(offset, offset + stride));
    offset += stride;
    for (let i = 0; i < stride; i += 1) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v = (v + pr) & 0xff;
      }
      line[i] = v;
    }
    for (let x = 0; x < width; x += 1) {
      const si = x * channels;
      const di = (y * width + x) * 4;
      if (colorType === 6) {
        out[di] = line[si];
        out[di + 1] = line[si + 1];
        out[di + 2] = line[si + 2];
        out[di + 3] = line[si + 3];
      } else if (colorType === 2) {
        out[di] = line[si];
        out[di + 1] = line[si + 1];
        out[di + 2] = line[si + 2];
        out[di + 3] = 255;
      } else if (colorType === 3) {
        const index = line[si];
        out[di] = palette[index * 3];
        out[di + 1] = palette[index * 3 + 1];
        out[di + 2] = palette[index * 3 + 2];
        out[di + 3] = trns && index < trns.length ? trns[index] : 255;
      } else if (colorType === 0) {
        out[di] = out[di + 1] = out[di + 2] = line[si];
        out[di + 3] = 255;
      } else {
        out[di] = out[di + 1] = out[di + 2] = line[si];
        out[di + 3] = line[si + 1];
      }
    }
    prev = line;
  }
  return { width, height, pixels: out };
}

/** 面积平均缩放；按预乘 alpha 平均，避免半透明边缘发黑。 */
function downscale(image, targetH) {
  const scale = targetH / image.height;
  const targetW = Math.max(1, Math.round(image.width * scale));
  const out = Buffer.alloc(targetW * targetH * 4);
  const blockW = image.width / targetW;
  const blockH = image.height / targetH;
  for (let y = 0; y < targetH; y += 1) {
    for (let x = 0; x < targetW; x += 1) {
      const x0 = Math.floor(x * blockW);
      const x1 = Math.min(image.width, Math.max(x0 + 1, Math.floor((x + 1) * blockW)));
      const y0 = Math.floor(y * blockH);
      const y1 = Math.min(image.height, Math.max(y0 + 1, Math.floor((y + 1) * blockH)));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const i = (sy * image.width + sx) * 4;
          const alpha = image.pixels[i + 3] / 255;
          r += image.pixels[i] * alpha;
          g += image.pixels[i + 1] * alpha;
          b += image.pixels[i + 2] * alpha;
          a += alpha;
          n += 1;
        }
      }
      const di = (y * targetW + x) * 4;
      if (a <= 0) continue;
      out[di] = Math.round(r / a);
      out[di + 1] = Math.round(g / a);
      out[di + 2] = Math.round(b / a);
      out[di + 3] = Math.round((a / n) * 255);
    }
  }
  return { width: targetW, height: targetH, pixels: out };
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = -1;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(image) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc(image.height * (image.width * 4 + 1));
  for (let y = 0; y < image.height; y += 1) {
    const rowStart = y * (image.width * 4 + 1);
    raw[rowStart] = 0;
    image.pixels.copy(raw, rowStart + 1, y * image.width * 4, (y + 1) * image.width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

if (!existsSync(TARGET_DIR)) mkdirSync(TARGET_DIR, { recursive: true });

for (const file of readdirSync(SOURCE_DIR)) {
  if (!file.endsWith('.png')) continue;
  const source = decodePng(readFileSync(join(SOURCE_DIR, file)));
  const thumb = encodePng(downscale(source, targetHeight));
  writeFileSync(join(TARGET_DIR, basename(file)), thumb);
  process.stdout.write(
    file +
      ': ' +
      source.width +
      'x' +
      source.height +
      ' -> ' +
      Math.round(thumb.length / 1024) +
      ' KB\n',
  );
}
