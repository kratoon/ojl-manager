import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import type { IncomingMessage } from 'node:http';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { dataSchema, emptyData } from '../src/data/schema';

const MAX_BYTES = 1_000_000;

function originAllowed(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin requests may omit it
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BYTES) {
        reject(new Error('too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Dev-server-only API that reads/writes the gitignored data/local.json (ADR-514da88).
 * It does not exist in the production build, so it never ships to GitHub Pages.
 */
export function localDataPlugin(): Plugin {
  const dir = join(process.cwd(), 'data');
  const local = join(dir, 'local.json');
  const sample = join(dir, 'sample.json');

  return {
    name: 'local-data-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/data', async (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(body));
        };
        try {
          if (!originAllowed(req)) return send(403, { error: 'forbidden origin' });
          if (req.method === 'GET') {
            const file = existsSync(local) ? local : existsSync(sample) ? sample : null;
            const raw = file ? JSON.parse(await readFile(file, 'utf8')) : emptyData;
            return send(200, dataSchema.parse(raw));
          }
          if (req.method === 'PUT') {
            const data = dataSchema.parse(JSON.parse(await readBody(req)));
            await mkdir(dir, { recursive: true });
            const tmp = `${local}.tmp`;
            await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
            await rename(tmp, local);
            return send(200, { ok: true });
          }
          return send(405, { error: 'method not allowed' });
        } catch {
          return send(400, { error: 'invalid request or data' });
        }
      });
    },
  };
}
