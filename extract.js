// api/extract.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  const { cookies } = req.body;
  
  if (!cookies) {
    return res.status(400).json({ error: 'Cookies required' });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    'Accept': 'text/html,application/xhtml+xml',
    'Cookie': cookies,
    'Referer': 'https://www.facebook.com/'
  };

  try {
    // Facebook mobile endpoint (Vercel friendly)
    const response = await fetch('https://m.facebook.com/', {
      headers,
      timeout: 10000
    });

    const html = await response.text();
    
    // EAAD6V7 patterns
    const patterns = [
      /EAAD6V7["']?\s*[:=]\s*["']([A-Za-z0-9]{100,})/g,
      /"EAAD6V7":"([^"]+)"/g,
      /EAA[^"']{100,}/g
    ];

    let token = null;
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        token = match[0].match(/[A-Za-z0-9]{100,}/)?.[0];
        break;
      }
    }

    if (token) {
      return res.json({ 
        success: true, 
        token,
        endpoint: 'm.facebook.com' 
      });
    }

    return res.json({ 
      success: false, 
      error: 'Token not found. Try fresh cookies.' 
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
