export default async function handler(req, res) {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return res.status(500).json({ error: 'BACKEND_URL not configured' });
  }

  // req.url includes the full path as seen by Vercel routing.
  // Strip the leading /api prefix since we proxy to the backend root.
  // e.g. /api/gmail/ingest -> /api/gmail/ingest (backend route)
  //      /api/auth/google  -> /auth/google (backend route, rewritten by vercel.json)
  let backendPath = req.url;
  // /api/auth/* was rewritten from /auth/* — strip the leading /api so backend sees /auth/*
  if (backendPath.startsWith('/api/auth/')) {
    backendPath = backendPath.replace('/api/auth/', '/auth/');
  }

  const targetUrl = `${backendUrl}${backendPath}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'] || 'application/json',
        'authorization': req.headers['authorization'] || '',
      },
      redirect: 'manual',
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    // Forward redirects directly to the browser (e.g. /auth/google → Google OAuth)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) return res.redirect(response.status, location);
    }

    const contentType = response.headers.get('content-type') || '';
    res.status(response.status);
    res.setHeader('content-type', contentType);

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.json(data);
    } else {
      const text = await response.text();
      return res.send(text);
    }
  } catch (err) {
    return res.status(502).json({ error: 'Backend unreachable', detail: err.message });
  }
}
