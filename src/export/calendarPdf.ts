import type { PDFFont } from 'pdf-lib';
import { monthGrid, type YearMonth } from '../calendar/dates';
import type { Data, Employee } from '../data/schema';
import type { Labels, Locale } from '../i18n/labels';
import { compareEmployees } from '../schedule/order';
import { companyClosedReason } from '../schedule/rules';
import { shiftKey, toIsoDate, type DayPart } from '../schedule/shift';

// Calendar PDF: one month per landscape A4 page, drawn as vector text (selectable, sharp).
// pdf-lib is loaded lazily, so it is not part of the initial bundle.

/** Raw font files. Latin covers ASCII, Latin-ext covers Czech letters; each in regular and bold. */
export interface FontBytes {
  latinRegular: Uint8Array;
  latinExtRegular: Uint8Array;
  latinBold: Uint8Array;
  latinExtBold: Uint8Array;
}

export interface CalendarPdfInput {
  months: YearMonth[];
  data: Data;
  locale: Locale;
  labels: Labels;
  today: Date;
}

interface Face {
  latin: PDFFont;
  ext: PDFFont;
  hasLatin(cp: number): boolean;
  hasExt(cp: number): boolean;
}

const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const MARGIN = 28;

const hex = (value: string) => {
  const n = parseInt(value.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] as const;
};

const colors = {
  ink: '#0d1033',
  navy: '#000064',
  muted: '#5b5e7c',
  faint: '#a3a6bd',
  border: '#d5d7e8',
  header: '#e6e8f5',
  day: '#fffbdc',
  night: '#eceefb',
  closed: '#e9e9e9',
  outside: '#f6f7fb',
  danger: '#b3261e',
};

export async function buildCalendarPdf(input: CalendarPdfInput, fonts: FontBytes): Promise<Uint8Array> {
  const [{ PDFDocument, rgb }, fontkitModule] = await Promise.all([import('pdf-lib'), import('@pdf-lib/fontkit')]);
  const fontkit = (fontkitModule.default ?? fontkitModule) as unknown as {
    create(bytes: Uint8Array): { hasGlyphForCodePoint(cp: number): boolean };
  };
  const color = (value: string) => rgb(...hex(value));

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkitModule.default ?? fontkitModule);
  pdf.setTitle(input.labels.app.shortTitle);
  pdf.setCreator(input.labels.app.shortTitle);

  const embed = async (latin: Uint8Array, ext: Uint8Array): Promise<Face> => {
    const [pdfLatin, pdfExt] = await Promise.all([pdf.embedFont(latin, { subset: true }), pdf.embedFont(ext, { subset: true })]);
    const fkLatin = fontkit.create(latin);
    const fkExt = fontkit.create(ext);
    return {
      latin: pdfLatin,
      ext: pdfExt,
      hasLatin: (cp) => fkLatin.hasGlyphForCodePoint(cp),
      hasExt: (cp) => fkExt.hasGlyphForCodePoint(cp),
    };
  };
  const regular = await embed(fonts.latinRegular, fonts.latinExtRegular);
  const bold = await embed(fonts.latinBold, fonts.latinExtBold);

  /** Split text into runs, each drawn with the font file that has its glyphs. */
  const runs = (face: Face, text: string) => {
    const result: { font: PDFFont; text: string }[] = [];
    for (const ch of text) {
      const cp = ch.codePointAt(0) as number;
      const font = face.hasLatin(cp) ? face.latin : face.hasExt(cp) ? face.ext : face.latin;
      const printable = font === face.latin && !face.hasLatin(cp) ? '?' : ch;
      const last = result[result.length - 1];
      if (last && last.font === font) last.text += printable;
      else result.push({ font, text: printable });
    }
    return result;
  };
  const width = (face: Face, text: string, size: number) =>
    runs(face, text).reduce((sum, r) => sum + r.font.widthOfTextAtSize(r.text, size), 0);
  const fit = (face: Face, text: string, size: number, max: number) => {
    if (width(face, text, size) <= max) return text;
    let cut = text;
    while (cut.length > 1 && width(face, `${cut}…`, size) > max) cut = cut.slice(0, -1);
    return `${cut}…`;
  };

  const { labels, locale } = input;
  const fmtMonth = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const fmtWeekday = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const fmtDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  const employees = new Map<string, Employee>(input.data.employees.map((e) => [e.id, e]));
  const sortedEmployees = [...input.data.employees].sort(compareEmployees);
  const seats = input.data.company.seatsPerShift;

  const [W, H] = A4_LANDSCAPE;

  for (const { year, month } of input.months) {
    const page = pdf.addPage(A4_LANDSCAPE);
    const text = (face: Face, value: string, x: number, top: number, size: number, tint: string) => {
      let cursor = x;
      for (const run of runs(face, value)) {
        page.drawText(run.text, { x: cursor, y: H - top, size, font: run.font, color: color(tint) });
        cursor += run.font.widthOfTextAtSize(run.text, size);
      }
    };
    const box = (x: number, top: number, w: number, h: number, fill: string, border?: string) =>
      page.drawRectangle({ x, y: H - top - h, width: w, height: h, color: color(fill), ...(border ? { borderColor: color(border), borderWidth: 0.5 } : {}) });

    // Title
    const title = capitalize(fmtMonth.format(new Date(year, month, 1)));
    text(bold, title, MARGIN, MARGIN + 18, 20, colors.navy);
    const appTitle = labels.app.shortTitle;
    text(regular, appTitle, W - MARGIN - width(regular, appTitle, 9), MARGIN + 14, 9, colors.muted);

    // Grid geometry
    const grid = monthGrid(year, month);
    const colW = (W - 2 * MARGIN) / 7;
    const headerTop = MARGIN + 30;
    const headerH = 16;
    const footerH = 52;
    const rowsTop = headerTop + headerH;
    const rowH = Math.min(96, (H - MARGIN - footerH - rowsTop) / grid.weeks.length);

    box(MARGIN, headerTop, W - 2 * MARGIN, headerH, colors.header);
    for (let d = 0; d < 7; d++) {
      const label = fmtWeekday.format(new Date(2024, 0, 1 + d)).toLocaleUpperCase(locale);
      text(bold, label, MARGIN + d * colW + (colW - width(bold, label, 8)) / 2, headerTop + 11, 8, '#3b3e63');
    }

    const counts: Record<string, { day: number; night: number }> = {};

    grid.weeks.forEach((week, w) => {
      const top = rowsTop + w * rowH;
      week.forEach((cell, d) => {
        const x = MARGIN + d * colW;
        const date = toIsoDate(cell.date);
        box(x, top, colW, rowH, cell.outside ? colors.outside : '#ffffff', colors.border);
        text(bold, String(cell.day), x + 4, top + 10, 8, cell.outside ? colors.faint : colors.muted);

        const blockH = (rowH - 13) / 2;
        const fontSize = blockH >= 24 ? 8 : 7;
        (['day', 'night'] as const).forEach((part: DayPart, i) => {
          const key = shiftKey({ date, part });
          const list = input.data.assignments[key] ?? [];
          const closed = companyClosedReason(input.data, { date, part }) !== null;
          const bTop = top + 12 + i * blockH;
          const fill = cell.outside ? colors.outside : closed && list.length === 0 ? colors.closed : part === 'day' ? colors.day : colors.night;
          box(x + 1, bTop, colW - 2, blockH, fill);

          // Sun or moon icon
          const ix = x + 7;
          const iy = H - (bTop + 7.5);
          const tint = cell.outside ? colors.faint : colors.muted;
          if (part === 'day') {
            page.drawCircle({ x: ix, y: iy, size: 1.9, borderColor: color(tint), borderWidth: 0.7 });
            for (let r = 0; r < 8; r++) {
              const a = (Math.PI / 4) * r;
              page.drawLine({
                start: { x: ix + Math.cos(a) * 3, y: iy + Math.sin(a) * 3 },
                end: { x: ix + Math.cos(a) * 4.3, y: iy + Math.sin(a) * 4.3 },
                thickness: 0.6,
                color: color(tint),
              });
            }
          } else {
            page.drawCircle({ x: ix, y: iy, size: 3.4, color: color(tint) });
            page.drawCircle({ x: ix + 1.7, y: iy + 0.9, size: 3, color: color(fill) });
          }

          // Names, one line per seat
          const nameX = x + 15;
          const maxW = colW - 15 - 3;
          const lineH = fontSize + 1.5;
          const names = list.map((a) => ({ a, employee: employees.get(a.employeeId) }));
          names.forEach(({ a, employee }, line) => {
            const label = fit(bold, employee?.name ?? '', fontSize, maxW);
            const baseline = bTop + 8 + line * lineH;
            text(bold, label, nameX, baseline, fontSize, cell.outside ? colors.faint : colors.ink);
            if (!cell.outside) {
              const c = (counts[a.employeeId] ??= { day: 0, night: 0 });
              c[part]++;
            }
          });
          // Unassigned seats stay blank on paper; only a closed company is labelled.
          if (!cell.outside && closed) {
            for (let s = list.length; s < seats; s++) {
              text(regular, labels.calendar.closed, nameX, bTop + 8 + s * lineH, fontSize - 0.5, colors.muted);
            }
          }
        });
      });
    });

    // Footer: shifts per employee for this month, total (day/night)
    const footTop = rowsTop + grid.weeks.length * rowH + 14;
    text(bold, labels.calendar.monthTotals, MARGIN, footTop, 8, colors.ink);
    text(regular, `${labels.calendar.previewTotal} (${labels.calendar.day} / ${labels.calendar.night})`, MARGIN + width(bold, labels.calendar.monthTotals, 8) + 8, footTop, 8, colors.muted);
    let cx = MARGIN;
    let cy = footTop + 13;
    for (const e of sortedEmployees) {
      const c = counts[e.id] ?? { day: 0, night: 0 };
      const chip = `${e.name} ${c.day + c.night} (${c.day}/${c.night})`;
      const w = width(regular, chip, 8) + 14;
      if (cx + w > W - MARGIN) {
        cx = MARGIN;
        cy += 12;
      }
      text(regular, e.name, cx, cy, 8, colors.muted);
      const nameW = width(regular, `${e.name} `, 8);
      text(bold, String(c.day + c.night), cx + nameW, cy, 8, colors.ink);
      text(regular, ` (${c.day}/${c.night})`, cx + nameW + width(bold, String(c.day + c.night), 8), cy, 8, colors.muted);
      cx += w;
    }

    text(regular, fmtDate.format(input.today), W - MARGIN - width(regular, fmtDate.format(input.today), 7), H - MARGIN + 8, 7, colors.faint);
  }

  return pdf.save();
}

