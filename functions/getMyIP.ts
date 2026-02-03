// Admin-only function to discover the outbound IP of Base44 functions
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // Require admin authentication - this exposes infrastructure info
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
    // Call multiple IP detection services for reliability
    const services = [
      'https://api.ipify.org?format=json',
      'https://httpbin.org/ip',
      'https://api.myip.com',
    ];
    
    const results = [];
    
    for (const url of services) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        results.push({ service: url, ip: data.ip || data.origin || JSON.stringify(data) });
      } catch (e) {
        results.push({ service: url, error: e.message });
      }
    }
    
    return Response.json({
      success: true,
      message: "Add this IP to your OKX API key whitelist",
      ips: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});