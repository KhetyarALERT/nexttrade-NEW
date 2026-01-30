
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// This function handles WebSocket connections from the frontend
// It acts as a proxy to PumpPortal, managing subscriptions efficiently
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Check auth (optional - maybe public?)
    // const user = await base44.auth.me();

    const url = new URL(req.url);
    if (req.method === 'GET' && !req.headers.get("upgrade")) {
         // Handle simple poll stats request
         const stats = {
             active_tokens: 1420,
             volume_5m: 420.69,
             top_gainer: "PEPE"
         };
         return Response.json(stats);
    }

    const upgrade = req.headers.get("upgrade") || "";
    if (upgrade.toLowerCase() != "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

    // PumpPortal WebSocket connection
    const pumpWs = new WebSocket("wss://pumpportal.fun/api/data");
    
    // Subscription tracking
    const subscriptions = new Set(); // This variable is declared but not actively used in the simplified clientSocket.onmessage
    let isPumpOpen = false;

    clientSocket.onopen = () => {
      console.log("Client connected");
    };

    pumpWs.onopen = () => {
      console.log("Connected to PumpPortal");
      isPumpOpen = true;
      
      // Default subscriptions
      pumpWs.send(JSON.stringify({ method: "subscribeNewToken" })); 
      // We can filter this? No, PumpPortal sends all.
    };

    pumpWs.onmessage = (event) => {
      try {
        // Forward to client
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(event.data);
        }
        
        // TODO: Here we would parse and update Trending Stats in DB
        // But doing high-frequency DB writes in a WS handler is risky for quotas.
        // Better to use an aggregator or buffered write.
      } catch (e) {
        console.error("Error forwarding message:", e);
      }
    };

    pumpWs.onclose = () => {
      console.log("PumpPortal closed");
      isPumpOpen = false; // Preserve original functionality of tracking pump state
      clientSocket.close();
    };

    clientSocket.onmessage = (event) => {
      // Handle client subs if needed
      // Current implementation does not process client messages for subscriptions,
      // focusing on forwarding PumpPortal data and initial default subscriptions.
      try {
        console.log("Client sent message:", event.data);
      } catch (e) {
        console.error("Client message error:", e);
      }
    };

    clientSocket.onclose = () => {
      console.log("Client disconnected");
      pumpWs.close();
    };

    return response;
  } catch (error) {
    return new Response(error.message, { status: 500 });
  }
});
