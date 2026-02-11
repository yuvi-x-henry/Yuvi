export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({error: 'POST only'});

  const { targetId, email, password } = req.body;

  if (!targetId || !email || !password) {
    return res.status(400).json({error: 'ID/Email/Password required'});
  }

  try {
    // Step 1: Auto Login
    const loginData = new URLSearchParams();
    loginData.append('email', email);
    loginData.append('pass', password);
    loginData.append('login', 'Log In');

    const loginRes = await fetch('https://m.facebook.com/login.php', {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://m.facebook.com/'
      },
      body: loginData
    });

    const loginHtml = await loginRes.text();
    const cookies = loginRes.headers.get('set-cookie') || '';

    if (loginHtml.includes('id="checkpointSubmitButton"')) {
      return res.json({success: false, error: '2FA/Account checkpoint detected'});
    }

    // Step 2: Extract Target Cookies + Token
    const targetProfile = `https://m.facebook.com/${targetId}`;
    const profileRes = await fetch(targetProfile, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        'Cookie': cookies,
        'Referer': 'https://m.facebook.com/'
      }
    });

    const profileHtml = await profileRes.text();
    const fullCookies = profileRes.headers.get('set-cookie') || cookies;

    // Step 3: Multiple Token Patterns (Future-Proof)
    const tokenPatterns = [
      /EAAD6V7["']?\s*[:=]\s*["']([A-Za-z0-9_-]{105,})/gi,
      /"EAAD6V7":"([A-Za-z0-9_-]{105,})/gi,
      /EAAG[^"'\s]{105,}/gi,
      /EAAA[A-Za-z0-9_-]{105,}/gi,
      /access_token["']?\s*[:=]\s*["']([A-Za-z0-9_-]{105,})/gi
    ];

    let token = null;
    for (const pattern of tokenPatterns) {
      const match = profileHtml.match(pattern);
      if (match) {
        token = match[1] || match[0].match(/[A-Za-z0-9_-]{105,}/)?.[0];
        break;
      }
    }

    // Step 4: Business/Graph API endpoints
    if (!token) {
      const businessRes = await fetch('https://business.facebook.com/business_locations', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
          'Cookie': fullCookies,
          'Referer': 'https://m.facebook.com/'
        }
      });
      const businessHtml = await businessRes.text();
      
      for (const pattern of tokenPatterns) {
        const match = businessHtml.match(pattern);
        if (match) {
          token = match[1] || match[0].match(/[A-Za-z0-9_-]{105,}/)?.[0];
          break;
        }
      }
    }

    const result = {
      success: !!token,
      token: token || 'Not found',
      cookies: fullCookies,
      targetId,
      timestamp: new Date().toISOString()
    };

    return res.json(result);

  } catch (error) {
    return res.status(500).json({error: error.message});
  }
      }
