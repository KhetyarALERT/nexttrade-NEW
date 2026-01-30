import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// This function handles WebSocket connections from the frontend
// It acts as a proxy to PumpPortal, managing subscriptions efficiently
Deno.serve(async (req) => {
  try {
    const upgrade = req.headers.get("upgrade") || "";
    
    // Handle standard HTTP GET for trending stats (REST fallback)
    if (req.method === 'GET' && !upgrade) {
         const base44 = createClientFromRequest(req);
         const url = new URL(req.url);
         const limit = parseInt(url.searchParams.get("limit") || "50");
         
         // Try to get from cache entity first
         try {
            const tokens = await base44.entities.MemeTokenCache.list('-trend_score', limit);
            return Response.json({ ok: true, data: tokens });
         } catch (e) {
            return Response.json({ ok: false, error: e.message });
         }
    }

    if (upgrade.toLowerCase() != "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

    // PumpPortal WebSocket connection
    const pumpWs = new WebSocket("wss://pumpportal.fun/api/data");
    
    // Subscription tracking
    const subscriptions = new Set();
    let isPumpOpen = false;

    clientSocket.onopen = () => {
      console.log("Client connected");
    };

    pumpWs.onopen = () => {
      console.log("Connected to PumpPortal");
      isPumpOpen = true;
      
      // Default subscriptions
      pumpWs.send(JSON.stringify({ method: "subscribeNewToken" }));
      pumpWs.send(JSON.stringify({ method: "subscribeMigration" }));
      
      // Resend any pending token subscriptions
      if (subscriptions.size > 0) {
        pumpWs.send(JSON.stringify({
          method: "subscribeTokenTrade",
          keys: Array.from(subscriptions)
        }));
      }
    };

    pumpWs.onmessage = (event) => {
      try {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(event.data);
        }
      } catch (e) {
        console.error("Error forwarding message:", e);
      }
    };

    pumpWs.onclose = () => {
      console.log("PumpPortal disconnected");
      isPumpOpen = false;
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close();
      }
    };

    clientSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle subscription requests from client
        if (data.method === "subscribeTokenTrade" && Array.isArray(data.keys)) {
          let hasNew = false;
          data.keys.forEach(key => {
            if (!subscriptions.has(key)) {
              subscriptions.add(key);
              hasNew = true;
            }
          });

          if (hasNew && isPumpOpen) {
            pumpWs.send(JSON.stringify({
              method: "subscribeTokenTrade",
              keys: Array.from(subscriptions) // PumpPortal allows array of keys
            }));
          }
        }
      } catch (e) {
        console.error("Client message error:", e);
      }
    };

    clientSocket.onclose = () => {
      console.log("Client disconnected");
      if (pumpWs.readyState === WebSocket.OPEN) {
        pumpWs.close();
      }
    };

    return response;
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
});