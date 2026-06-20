import type { NextApiRequest, NextApiResponse } from 'next';
import http from 'http';
import https from 'https';

const BACKEND = 'http://216.128.158.141';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path || '';
  const url = `${BACKEND}/api/${path}`;

  const forwardHeaders = ['content-type', 'content-length', 'accept'];
  const headers: Record<string, string> = {};
  for (const h of forwardHeaders) {
    const val = req.headers[h];
    if (val) headers[h] = Array.isArray(val) ? val[0] : val;
  }

  return new Promise<void>((resolve) => {
    const parsedUrl = new URL(url);
    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method,
      headers,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.status(proxyRes.statusCode || 500);
      if (proxyRes.headers['x-session-id']) {
        res.setHeader('x-session-id', proxyRes.headers['x-session-id']);
      }
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      res.status(502).json({ error: 'Backend unreachable' });
      resolve();
    });

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
