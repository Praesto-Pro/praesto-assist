export function GET(request) {
  const destination = process.env.SERVICE_TERMS_URL;
  if (destination) {
    try { const url = new URL(destination); if (url.protocol === 'https:') return Response.redirect(url,302); } catch {}
  }
  return Response.redirect(new URL('/terms.html',request.url),302);
}
