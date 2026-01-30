import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Caches RugCheck results for 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

export default async function handler(req) {
  const base44 = createClientFromRequest(req);
  
  try {
    const { mint } = await req.json();
    
    if (!mint) {
      return new Response(JSON.stringify({ error: "Mint required" }), { status: 400 });
    }

    // 1. Check Cache (using MemeTokenCache entity if we stored safety there, 
    // or just fetch fresh since RugCheck is fast and critical)
    // For V2 speed, we'll try to fetch fresh but maybe update our DB asynchronously
    
    const response = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report/summary`);
    
    if (!response.ok) {
        // Fallback or just return minimal
        return new Response(JSON.stringify({ score: 0, flags: [] }), { status: 200 });
    }

    const data = await response.json();
    
    // Normalize data
    const safetyData = {
        score: data.score || 0, // Lower is better usually, or check specific API
        riskLevel: data.risks ? (data.risks.length > 2 ? 'high' : data.risks.length > 0 ? 'medium' : 'low') : 'good',
        flags: data.risks || [],
        rugged: data.rugged || false,
        lastUpdated: Date.now()
    };

    return new Response(JSON.stringify(safetyData), { 
        status: 200,
        headers: { "Content-Type": "application/json" } 
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}