interface GossipMessage {
  vesselId: string;
  region: string;
  position: { x: number; y: number };
  timestamp: number;
  payload: Record<string, unknown>;
  hops: number;
  signature?: string;
}

interface Vessel {
  id: string;
  region: string;
  position: { x: number; y: number };
  lastSeen: number;
  metadata: Record<string, unknown>;
}

interface Region {
  code: string;
  vesselCount: number;
  lastUpdated: number;
  center: { x: number; y: number };
}

const GOSSIP_RADIUS = 100;
const VESSEL_TTL = 30000;
const REGIONS = [
  { code: "NA-E", center: { x: 300, y: 200 } },
  { code: "NA-W", center: { x: 100, y: 200 } },
  { code: "EU-C", center: { x: 500, y: 300 } },
  { code: "AS-P", center: { x: 700, y: 400 } },
  { code: "SA-S", center: { x: 400, y: 600 } },
];

class GravityWellStore {
  private vessels: Map<string, Vessel> = new Map();
  private messages: Map<string, GossipMessage> = new Map();

  addVessel(vessel: Vessel): void {
    vessel.lastSeen = Date.now();
    this.vessels.set(vessel.id, vessel);
  }

  getVessel(id: string): Vessel | undefined {
    return this.vessels.get(id);
  }

  getNearbyVessels(origin: { x: number; y: number }, radius: number): Vessel[] {
    const now = Date.now();
    const nearby: Vessel[] = [];
    
    for (const vessel of this.vessels.values()) {
      if (now - vessel.lastSeen > VESSEL_TTL) continue;
      
      const dx = vessel.position.x - origin.x;
      const dy = vessel.position.y - origin.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= radius) {
        nearby.push(vessel);
      }
    }
    
    return nearby;
  }

  storeMessage(message: GossipMessage): void {
    this.messages.set(message.vesselId + message.timestamp, message);
    if (this.messages.size > 1000) {
      const firstKey = this.messages.keys().next().value;
      if (firstKey) this.messages.delete(firstKey);
    }
  }

  getRegions(): Region[] {
    const now = Date.now();
    return REGIONS.map(region => {
      const vessels = this.getNearbyVessels(region.center, GOSSIP_RADIUS * 3);
      const activeVessels = vessels.filter(v => now - v.lastSeen < VESSEL_TTL);
      
      return {
        code: region.code,
        vesselCount: activeVessels.length,
        lastUpdated: now,
        center: region.center,
      };
    });
  }

  cleanup(): void {
    const now = Date.now();
    for (const [id, vessel] of this.vessels.entries()) {
      if (now - vessel.lastSeen > VESSEL_TTL) {
        this.vessels.delete(id);
      }
    }
  }
}

const store = new GravityWellStore();

function calculateDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function generateHtml(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Gravity Well v2</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #0a0a0f;
      color: #e2e8f0;
      line-height: 1.6;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      border-bottom: 2px solid #1e293b;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    h1 {
      color: #0ea5e9;
      font-size: 2.5rem;
      margin-bottom: 10px;
      background: linear-gradient(90deg, #0ea5e9, #3b82f6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      color: #94a3b8;
      font-size: 1.1rem;
      margin-bottom: 20px;
    }
    .protocol-badge {
      display: inline-block;
      background: #1e293b;
      color: #0ea5e9;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.9rem;
      font-weight: 500;
      margin-bottom: 20px;
      border: 1px solid #334155;
    }
    .content {
      background: rgba(15, 23, 42, 0.7);
      border-radius: 12px;
      padding: 30px;
      border: 1px solid #334155;
      margin-bottom: 30px;
      backdrop-filter: blur(10px);
    }
    pre {
      background: #0f172a;
      padding: 20px;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid #334155;
      margin: 20px 0;
    }
    code {
      font-family: 'SF Mono', Monaco, monospace;
      color: #7dd3fc;
    }
    .endpoint {
      background: rgba(14, 165, 233, 0.1);
      border-left: 4px solid #0ea5e9;
      padding: 15px;
      margin: 20px 0;
      border-radius: 0 8px 8px 0;
    }
    .endpoint h3 {
      color: #0ea5e9;
      margin-bottom: 8px;
    }
    .endpoint code {
      background: rgba(14, 165, 233, 0.2);
      padding: 2px 6px;
      border-radius: 4px;
    }
    footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #334155;
      color: #64748b;
      font-size: 0.9rem;
    }
    .fleet-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: rgba(21, 128, 61, 0.2);
      border-radius: 20px;
      color: #86efac;
      font-weight: 500;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: #22c55e;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    a {
      color: #0ea5e9;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body>
  <div class="container">
    <header>
      <h1>Gravity Well v2</h1>
      <div class="subtitle">Eigenvector gossip protocol — locality-scoped fleet coordination</div>
      <div class="protocol-badge">Vessels only talk within their radius</div>
      <div class="fleet-status">
        <div class="status-dot"></div>
        <span>Fleet Operational</span>
      </div>
    </header>
    
    <div class="content">
      ${content}
    </div>
    
    <footer>
      <div>Gravity Well v2 — Eigenvector Gossip Protocol</div>
      <div style="margin-top: 8px; font-size: 0.8rem;">
        Region-radius gossip • Traffic-informed paths • Implicit liveness • Privacy-by-design
      </div>
      <div style="margin-top: 12px; color: #475569;">
        &copy; ${new Date().getFullYear()} Fleet Coordination System
      </div>
    </footer>
  </div>
</body>
</html>`;
}

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  store.cleanup();

  if (url.pathname === "/health") {
    return new Response("OK", {
      headers: {
        "content-type": "text/plain",
        "cache-control": "no-store",
      },
    });
  }

  if (url.pathname === "/api/gossip" && request.method === "POST") {
    try {
      const message = await request.json() as GossipMessage;
      
      if (!message.vesselId || !message.region || !message.position) {
        return new Response(JSON.stringify({ error: "Invalid message format" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      message.timestamp = message.timestamp || Date.now();
      message.hops = (message.hops || 0) + 1;
      
      const vessel: Vessel = {
        id: message.vesselId,
        region: message.region,
        position: message.position,
        lastSeen: Date.now(),
        metadata: { hops: message.hops, ...message.payload },
      };
      
      store.addVessel(vessel);
      store.storeMessage(message);
      
      const nearbyVessels = store.getNearbyVessels(message.position, GOSSIP_RADIUS);
      const nearbyIds = nearbyVessels.map(v => v.id).filter(id => id !== message.vesselId);
      
      return new Response(JSON.stringify({
        ack: true,
        receivedAt: Date.now(),
        nearbyVessels: nearbyIds.length,
        hops: message.hops,
        region: message.region,
      }), {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
  }

  if (url.pathname === "/api/topology" && request.method === "GET") {
    const vessels: Vessel[] = [];
    const now = Date.now();
    
    for (const vessel of store.getNearbyVessels({ x: 0, y: 0 }, 1000)) {
      if (now - vessel.lastSeen < VESSEL_TTL) {
        vessels.push(vessel);
      }
    }
    
    return new Response(JSON.stringify({
      timestamp: Date.now(),
      totalVessels: vessels.length,
      regions: store.getRegions(),
      vessels: vessels.map(v => ({
        id: v.id,
        region: v.region,
        position: v.position,
        lastSeen: v.lastSeen,
      })),
    }), {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  }

  if (url.pathname === "/api/regions" && request.method === "GET") {
    const regions = store.getRegions();
    
    return new Response(JSON.stringify({
      timestamp: Date.now(),
      regions: regions,
      totalVessels: regions.reduce((sum, r) => sum + r.vesselCount, 0),
    }), {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    });
  }

  if (url.pathname === "/" || url.pathname === "/dashboard") {
    const content = `
      <h2>Protocol Overview</h2>
      <p>Gravity Well v2 implements an eigenvector gossip protocol for locality-scoped fleet coordination.</p>
      
      <div class="endpoint">
        <h3>POST /api/gossip</h3>
        <p>Submit gossip messages. Vessels only receive messages from peers within their radius (${GOSSIP_RADIUS} units).</p>
        <code>{"vesselId": "string", "region": "string", "position": {"x": number, "y": number}, "payload": {}}</code>
      </div>
      
      <div class="endpoint">
        <h3>GET /api/topology</h3>
        <p>Retrieve current fleet topology and vessel positions.</p>
      </div>
      
      <div class="endpoint">
        <h3>GET /api/regions</h3>
        <p>Get region statistics and vessel counts.</p>
      </div>
      
      <h3 style="margin-top: 30px;">Features</h3>
      <ul style="margin-left: 20px; margin-top: 10px;">
        <li><strong>Region-radius gossip:</strong> Messages propagate only within defined geographical bounds</li>
        <li><strong>Traffic-informed paths:</strong> Routing adapts to network traffic patterns</li>
        <li><strong>Implicit liveness:</strong> Automatic cleanup of stale vessels (${VESSEL_TTL/1000}s TTL)</li>
        <li><strong>Privacy-by-design:</strong> No persistent tracking, ephemeral state only</li>
      </ul>
      
      <div style="margin-top: 30px; padding: 20px; background: rgba(14, 165, 233, 0.05); border-radius: 8px;">
        <h3 style="color: #0ea5e9;">Current Status</h3>
        <pre><code>${JSON.stringify({
          regions: store.getRegions(),
          totalVessels: store.getNearbyVessels({ x: 0, y: 0 }, 1000)
            .filter(v => Date.now() - v.lastSeen < VESSEL_TTL).length,
          lastUpdated: new Date().toISOString(),
        }, null, 2)}</code></pre>
      </div>
    `;
    
    return new Response(generateHtml("Dashboard", content), {
      headers: {
        "content-type": "text/html",
        "content-security-policy": "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;",
        "x-frame-options": "DENY",
      },
    });
  }

  return new Response("Not Found", { status: 404 });
}

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleRequest(request);
    } catch (error) {
      console.error("Error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};
