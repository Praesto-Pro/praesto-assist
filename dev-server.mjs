import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const routes = {
  '/api/create-checkout':'./api/create-checkout.js',
  '/api/stripe-webhook':'./api/stripe-webhook.js',
  '/api/checkout-status':'./api/checkout-status.js',
  '/api/terms':'./api/terms.js',
  '/api/privacy':'./api/privacy.js'
};
const contentTypes = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.json':'application/json' };
const server = http.createServer(async (req,res) => {
  const origin = `http://${req.headers.host || `localhost:${PORT}`}`;
  const url = new URL(req.url,origin);
  try {
    if (routes[url.pathname]) {
      const module = await import(new URL(routes[url.pathname],import.meta.url));
      const chunks=[];
      for await (const chunk of req) { chunks.push(chunk); if (Buffer.concat(chunks).length > 300000) throw new Error('Request too large'); }
      const body = Buffer.concat(chunks);
      const request = new Request(url,{method:req.method,headers:req.headers,...(req.method!=='GET' && req.method!=='HEAD'?{body}:{} )});
      const response = await (module[req.method] ? module[req.method](request) : Response.json({error:'Method not allowed'},{status:405}));
      res.writeHead(response.status,Object.fromEntries(response.headers));
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(root,'.' + pathname);
    if (!file.startsWith(root + path.sep) || /(^|\/)\.|(^|\/)api\b|(^|\/)lib\b|(^|\/)docs\b|(^|\/)tests\b/.test(pathname)) { res.writeHead(404); return res.end('Not found'); }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('Not a file');
    res.writeHead(200,{ 'Content-Type':contentTypes[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    return res.end(await readFile(file));
  } catch (error) { res.writeHead(404); res.end('Not found'); }
});
server.listen(PORT,()=>console.log(`Praesto Assist preview: http://localhost:${PORT}`));
