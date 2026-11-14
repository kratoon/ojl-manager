import latinBold from '@fontsource/open-sans/files/open-sans-latin-700-normal.woff?url';
import latinRegular from '@fontsource/open-sans/files/open-sans-latin-400-normal.woff?url';
import latinExtBold from '@fontsource/open-sans/files/open-sans-latin-ext-700-normal.woff?url';
import latinExtRegular from '@fontsource/open-sans/files/open-sans-latin-ext-400-normal.woff?url';
import type { FontBytes } from './calendarPdf';

const load = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());

/** Fetches the font files used in the PDF (only when an export is requested). */
export async function loadPdfFonts(): Promise<FontBytes> {
  const [a, b, c, d] = await Promise.all([load(latinRegular), load(latinExtRegular), load(latinBold), load(latinExtBold)]);
  return { latinRegular: a, latinExtRegular: b, latinBold: c, latinExtBold: d };
}
