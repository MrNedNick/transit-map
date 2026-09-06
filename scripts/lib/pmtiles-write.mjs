/**
 * A minimal PMTiles v3 writer.
 *
 * The official packers (`tippecanoe`, the `pmtiles` CLI) are Go and C++ tools,
 * so the archive is assembled here instead: header, root directory and tile
 * data, with tiles ordered along the Hilbert curve exactly as the spec asks.
 * Spec: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
 */
import { gzipSync } from 'node:zlib';

const HEADER_BYTES = 127;
const MAX_ROOT_BYTES = 16384 - HEADER_BYTES;

export const COMPRESSION = { none: 1, gzip: 2 };
export const TILE_TYPE = { mvt: 1, png: 2, jpeg: 3, webp: 4, avif: 5 };

function writeVarint(out, value) {
  let v = value;
  while (v >= 0x80) {
    out.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v & 0x7f);
}

/** Position of a tile on the Hilbert curve, with all lower zooms in front. */
export function zxyToTileId(z, x, y) {
  if (z > 26) throw new RangeError('zoom levels beyond 26 are not supported');
  let acc = 0;
  for (let t = 0; t < z; t++) acc += (1 << t) * (1 << t);

  let tx = x;
  let ty = y;
  let d = 0;
  for (let s = 2 ** z / 2; s > 0; s /= 2) {
    const rx = (tx & s) > 0 ? 1 : 0;
    const ry = (ty & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        tx = s - 1 - tx;
        ty = s - 1 - ty;
      }
      const swap = tx;
      tx = ty;
      ty = swap;
    }
  }
  return acc + d;
}

/**
 * Entries are `{ tileId, offset, length, runLength }`, sorted by tile id.
 * Offsets are stored as a delta against the previous entry whenever the tiles
 * are adjacent, which is what keeps a directory small.
 */
export function serializeDirectory(entries) {
  const out = [];
  writeVarint(out, entries.length);

  let lastId = 0;
  for (const entry of entries) {
    writeVarint(out, entry.tileId - lastId);
    lastId = entry.tileId;
  }
  for (const entry of entries) writeVarint(out, entry.runLength);
  for (const entry of entries) writeVarint(out, entry.length);
  for (let i = 0; i < entries.length; i++) {
    const previous = entries[i - 1];
    if (i > 0 && entries[i].offset === previous.offset + previous.length) {
      writeVarint(out, 0);
    } else {
      writeVarint(out, entries[i].offset + 1);
    }
  }
  return Buffer.from(out);
}

function writeHeader(fields) {
  const header = Buffer.alloc(HEADER_BYTES);
  header.write('PMTiles', 0, 'ascii');
  header.writeUInt8(3, 7);
  header.writeBigUInt64LE(BigInt(fields.rootOffset), 8);
  header.writeBigUInt64LE(BigInt(fields.rootLength), 16);
  header.writeBigUInt64LE(BigInt(fields.metadataOffset), 24);
  header.writeBigUInt64LE(BigInt(fields.metadataLength), 32);
  header.writeBigUInt64LE(BigInt(fields.leafOffset), 40);
  header.writeBigUInt64LE(BigInt(fields.leafLength), 48);
  header.writeBigUInt64LE(BigInt(fields.dataOffset), 56);
  header.writeBigUInt64LE(BigInt(fields.dataLength), 64);
  header.writeBigUInt64LE(BigInt(fields.addressedTiles), 72);
  header.writeBigUInt64LE(BigInt(fields.tileEntries), 80);
  header.writeBigUInt64LE(BigInt(fields.tileContents), 88);
  header.writeUInt8(1, 96); // clustered
  header.writeUInt8(COMPRESSION.gzip, 97);
  header.writeUInt8(fields.tileCompression, 98);
  header.writeUInt8(fields.tileType, 99);
  header.writeUInt8(fields.minZoom, 100);
  header.writeUInt8(fields.maxZoom, 101);
  header.writeInt32LE(Math.round(fields.bbox[0] * 1e7), 102);
  header.writeInt32LE(Math.round(fields.bbox[1] * 1e7), 106);
  header.writeInt32LE(Math.round(fields.bbox[2] * 1e7), 110);
  header.writeInt32LE(Math.round(fields.bbox[3] * 1e7), 114);
  header.writeUInt8(fields.centreZoom, 118);
  header.writeInt32LE(Math.round(fields.centre[0] * 1e7), 119);
  header.writeInt32LE(Math.round(fields.centre[1] * 1e7), 123);
  return header;
}

/**
 * `tiles` is a Map of tile id -> already-compressed tile body.
 * Identical bodies are stored once and addressed by several entries.
 */
export function packArchive({ tiles, metadata, minZoom, maxZoom, bbox, centre, centreZoom }) {
  const ids = [...tiles.keys()].sort((a, b) => a - b);

  const bodies = [];
  const entries = [];
  const seen = new Map();
  let offset = 0;

  for (const id of ids) {
    const body = tiles.get(id);
    const digest = body.toString('base64');
    const known = seen.get(digest);
    if (known) {
      entries.push({ tileId: id, offset: known.offset, length: known.length, runLength: 1 });
      continue;
    }
    const entry = { tileId: id, offset, length: body.length, runLength: 1 };
    seen.set(digest, entry);
    entries.push(entry);
    bodies.push(body);
    offset += body.length;
  }

  const data = Buffer.concat(bodies);
  const metadataBuffer = gzipSync(Buffer.from(JSON.stringify(metadata)), { level: 9 });
  const root = gzipSync(serializeDirectory(entries), { level: 9 });

  if (root.length > MAX_ROOT_BYTES) {
    throw new Error(
      `root directory is ${root.length} bytes, over the ${MAX_ROOT_BYTES} byte budget — ` +
        'this writer does not emit leaf directories, so the tileset needs fewer tiles',
    );
  }

  const rootOffset = HEADER_BYTES;
  const metadataOffset = rootOffset + root.length;
  const leafOffset = metadataOffset + metadataBuffer.length;
  const dataOffset = leafOffset;

  const header = writeHeader({
    rootOffset,
    rootLength: root.length,
    metadataOffset,
    metadataLength: metadataBuffer.length,
    leafOffset,
    leafLength: 0,
    dataOffset,
    dataLength: data.length,
    addressedTiles: entries.length,
    tileEntries: entries.length,
    tileContents: bodies.length,
    tileCompression: COMPRESSION.gzip,
    tileType: TILE_TYPE.mvt,
    minZoom,
    maxZoom,
    bbox,
    centre,
    centreZoom,
  });

  return {
    buffer: Buffer.concat([header, root, metadataBuffer, data]),
    stats: {
      addressed: entries.length,
      unique: bodies.length,
      rootBytes: root.length,
      dataBytes: data.length,
    },
  };
}
