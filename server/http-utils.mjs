import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

export function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  );
}

export function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

export function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8', headers = {}) {
  const body = String(text);
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    ...headers
  });
  res.end(body);
}

export async function readJsonBody(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('Request body exceeds the allowed size.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

export function serveStatic(req, res, publicDirectory) {
  const requestUrl = new URL(req.url, 'http://localhost');
  const requestedPath = decodeURIComponent(requestUrl.pathname);
  const fallback = requestedPath === '/' ? '/index.html' : requestedPath;
  const normalized = normalize(fallback).replace(/^(\.\.[/\\])+/, '');
  const candidate = resolve(join(publicDirectory, normalized));
  const publicRoot = resolve(publicDirectory);

  if (!candidate.startsWith(publicRoot)) return false;

  let filePath = candidate;
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    if (extname(requestedPath)) return false;
    filePath = join(publicRoot, 'index.html');
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;
  const extension = extname(filePath).toLowerCase();
  const cacheControl = filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600';
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
    'Cache-Control': cacheControl
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(filePath).pipe(res);
  return true;
}
