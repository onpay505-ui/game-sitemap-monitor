import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS for the frontend
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    // Determine User-Agent
    const userAgent = 'GameSitemapMonitor/1.0 (Mozilla/5.0 compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/xml, text/xml, text/plain, */*'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      return res.status(response.status).send(`Target responded with ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    const text = await response.text();

    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    // Return the raw content
    res.status(200).send(text);

  } catch (error: any) {
    console.error('Proxy error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch target URL' });
  }
}