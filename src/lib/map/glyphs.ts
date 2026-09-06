import maplibregl from 'maplibre-gl';
import TinySDF from '@mapbox/tiny-sdf';
import { PbfWriter } from 'pbf';

/**
 * MapLibre cannot draw a single label without a glyph server, and this project
 * deliberately talks to nothing. So the glyphs are made here, in the page:
 * TinySDF rasterises each character into a signed-distance field and the result
 * is encoded as the same protobuf a font server would have returned.
 *
 * The metrics below match MapLibre's own local-glyph path (`glyph_manager.ts`):
 * 24 px em, 3 px buffer, 8 px radius, and the baseline nudges that line
 * TinySDF up with server-generated fonts.
 */
export const GLYPH_PROTOCOL = 'localfont';
export const GLYPHS_URL = `${GLYPH_PROTOCOL}://{fontstack}/{range}.pbf`;

const FONT_FAMILY =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const TOP_ADJUSTMENT = 27.5;
const LEFT_ADJUSTMENT = 0.5;

const generators = new Map<string, TinySDF>();
const cache = new Map<string, ArrayBuffer>();

function generatorFor(fontstack: string): TinySDF {
  let generator = generators.get(fontstack);
  if (!generator) {
    generator = new TinySDF({
      fontSize: 24,
      buffer: 3,
      radius: 8,
      cutoff: 0.25,
      fontFamily: FONT_FAMILY,
      fontWeight: /bold/i.test(fontstack) ? '700' : '500',
    });
    generators.set(fontstack, generator);
  }
  return generator;
}

interface EncodedGlyph {
  id: number;
  bitmap: Uint8ClampedArray | null;
  width: number;
  height: number;
  left: number;
  top: number;
  advance: number;
}

function writeGlyph(glyph: EncodedGlyph, pbf: PbfWriter) {
  pbf.writeVarintField(1, glyph.id);
  if (glyph.bitmap && glyph.bitmap.length) {
    pbf.writeBytesField(2, new Uint8Array(glyph.bitmap.buffer, glyph.bitmap.byteOffset, glyph.bitmap.length));
  }
  pbf.writeVarintField(3, glyph.width);
  pbf.writeVarintField(4, glyph.height);
  pbf.writeSVarintField(5, glyph.left);
  pbf.writeSVarintField(6, glyph.top);
  pbf.writeVarintField(7, glyph.advance);
}

function buildRange(fontstack: string, start: number): ArrayBuffer {
  const generator = generatorFor(fontstack);
  const glyphs: EncodedGlyph[] = [];

  for (let id = start; id < start + 256; id++) {
    // Control characters have no shape and no advance.
    if (id < 0x20 || (id >= 0x7f && id <= 0x9f)) continue;
    const drawn = generator.draw(String.fromCodePoint(id));
    glyphs.push({
      id,
      bitmap: drawn.data,
      width: drawn.glyphWidth,
      height: drawn.glyphHeight,
      left: Math.round(drawn.glyphLeft + LEFT_ADJUSTMENT),
      top: Math.round(drawn.glyphTop - TOP_ADJUSTMENT),
      advance: Math.round(drawn.glyphAdvance),
    });
  }

  const pbf = new PbfWriter();
  pbf.writeMessage(1, (stack, writer) => {
    writer.writeStringField(1, stack.name);
    writer.writeStringField(2, stack.range);
    for (const glyph of stack.glyphs) writer.writeMessage(3, writeGlyph, glyph);
  }, { name: fontstack, range: `${start}-${start + 255}`, glyphs });

  const finished = pbf.finish();
  return finished.buffer.slice(finished.byteOffset, finished.byteOffset + finished.byteLength) as ArrayBuffer;
}

let registered = false;

export function registerGlyphProtocol() {
  if (registered) return;
  registered = true;

  maplibregl.addProtocol(GLYPH_PROTOCOL, async (params) => {
    // localfont://<fontstack>/<start>-<end>.pbf
    const path = params.url.slice(`${GLYPH_PROTOCOL}://`.length);
    const [fontstack, rangeFile] = path.split('/');
    const start = Number(rangeFile.split('-')[0]);

    const key = `${fontstack}:${start}`;
    let data = cache.get(key);
    if (!data) {
      data = buildRange(decodeURIComponent(fontstack), start);
      cache.set(key, data);
    }
    return { data };
  });
}
