
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// This backend function acts as a WSS proxy to PumpPortal.
// It allows the frontend to connect to ONE endpoint and share the connection logic.
Deno.serve(async (req) => {
    try {
        const upgrade = req.headers.get("upgrade") || "";
        
        // Handle standard HTTP GET for trending stats (REST fallback)
        if (req.method === 'GET' && !upgrade) {
             const base44 = createClientFromRequest(req);
             const { limit = 50 } = Object.fromEntries(new URL(req.url).searchParams);
             const tokens = await base44.entities.MemeTokenCache.list('-trend_score', parseInt(limit));
             return Response.json({ ok: true, data: tokens });
        }

        if (upgrade.toLowerCase() != "websocket") {
             return new Response("Expected WebSocket", { status: 400 });
        }

        const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

        // Connect to PumpPortal
        const pumpWs = new WebSocket("wss://pumpportal.fun/api/data");

        clientSocket.onopen = () => console.log("Client connected to stream");
        
        pumpWs.onopen = () => {
             console.log("Upstream connected");
             // Subscribe to everything needed
             pumpWs.send(JSON.stringify({ method: "subscribeNewToken" }));
             pumpWs.send(JSON.stringify({ method: "subscribeMigration" }));
        };

        pumpWs.onmessage = (event) => {
             if (clientSocket.readyState === WebSocket.OPEN) {
                 clientSocket.send(event.data);
             }
        };

        pumpWs.onclose = () => clientSocket.close();
        clientSocket.onclose = () => pumpWs.close();

        return response;
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
});
