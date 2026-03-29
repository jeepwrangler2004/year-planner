export default async function handler(req, res) {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return res.status(500).json({ error: 'BACKEND_URL not configured' });
  }

  const targetUrl = `${backendUrl}${req.url}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'] || 'application/json',
        'authorization': req.headers['authorization'] || '',
      },
      // Don't follow redirects — we want to forward them to the browser
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
