import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import http from 'http'

const API_BASE = process.env.TABLESCHNAPPI_API ?? 'http://tableschnappi-backend.tableschnappi.svc.cluster.local:3001/api'
const PORT = parseInt(process.env.PORT ?? '3000')

// ── Authorisation ─────────────────────────────────────────────────────────────
//
// Until now every caller got every tool, and the tool list WAS the only
// authorisation boundary. That meant anyone reaching this server directly —
// notably through the GenAI Studio playground, where the chart registers it
// cluster-wide — could call make_reservation with none of the checks the
// assistant applies. The confirmation gate, the required-field checks and the
// one-mutation-per-turn rule all live in the assistant (mlflow-proxy), not here.
//
// Roles are least-privilege by default: a caller that presents no role gets
// read-only, so an unauthenticated playground user can look but not book.
//
// In a real deployment the role should come from an authenticated identity —
// this cluster already runs the MCP gateway and Authorino in front of this
// service. The header is the demo-shaped equivalent of that; it is trusted
// only because everything in front of it is inside the cluster.
export type Role = 'readonly' | 'guest' | 'staff'

const ROLE_HEADER = 'x-tableschnappi-role'

/** Which roles may call each tool. Anything absent is readonly-safe. */
const TOOL_ROLES: Record<string, Role[]> = {
  // Reads — safe for anyone, including the playground.
  list_restaurants:            ['readonly', 'guest', 'staff'],
  get_restaurant_status:       ['readonly', 'guest', 'staff'],
  check_table_availability:    ['readonly', 'guest', 'staff'],
  get_wait_time:               ['readonly', 'guest', 'staff'],
  get_menu:                    ['readonly', 'guest', 'staff'],
  find_alternative_restaurant: ['readonly', 'guest', 'staff'],
  // Mutations — only a caller acting for a guest, or staff.
  make_reservation:            ['guest', 'staff'],
  modify_reservation:          ['guest', 'staff'],
}

function roleFromRequest(req: http.IncomingMessage): Role {
  const raw = req.headers[ROLE_HEADER]
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === 'guest' || value === 'staff' ? value : 'readonly'
}

function roleMayCall(role: Role, toolName: string): boolean {
  return (TOOL_ROLES[toolName] ?? ['readonly', 'guest', 'staff']).includes(role)
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

// ── Tool definitions ─────────────────────────────────────────────────────────

const VALID_SLUGS = ['sakura', 'koi']
const DEFAULT_SLUG = 'sakura'

const tools = [
  {
    name: 'list_restaurants',
    description: 'List all restaurants with current table availability. Call this first if you do not know which restaurant the user wants.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_restaurant_status',
    description: 'Full live status for a restaurant: tables, active orders, and wait time. Use slug "sakura" or "koi".',
    inputSchema: {
      type: 'object' as const,
      properties: { slug: { type: 'string', enum: ['sakura', 'koi'], description: 'Restaurant slug: "sakura" or "koi"' } },
      required: ['slug'],
    },
  },
  {
    name: 'check_table_availability',
    description: 'Check if tables are available right now for a given party size. ALWAYS call this before make_reservation. slug must be "sakura" or "koi".',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', enum: ['sakura', 'koi'] },
        party_size: { type: 'number', minimum: 1, maximum: 12, description: 'Number of guests (must be provided by user)' },
      },
      required: ['slug', 'party_size'],
    },
  },
  {
    name: 'get_wait_time',
    description: 'Get estimated wait time in minutes for a party size. slug must be "sakura" or "koi".',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', enum: ['sakura', 'koi'] },
        party_size: { type: 'number' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'make_reservation',
    description: 'Create a table reservation. IMPORTANT: You MUST collect all required fields from the user before calling this tool: customer_name (real name, not null), party_size (real number, not null), requested_time (real time, not null), slug ("sakura" or "koi"). Never call this with null or placeholder values.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', enum: ['sakura', 'koi'], description: 'Must be "sakura" or "koi"' },
        customer_name: { type: 'string', description: 'Full name of the customer — must be collected from the user' },
        party_size: { type: 'number', minimum: 1, maximum: 12, description: 'Number of guests — must be collected from the user' },
        requested_time: { type: 'string', description: 'Requested time e.g. "19:30" — must be collected from the user' },
        phone: { type: 'string' },
        email: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['slug', 'customer_name', 'party_size', 'requested_time'],
    },
  },
  {
    name: 'get_menu',
    description: 'Get the restaurant menu with prices, allergens, and prep times. slug must be "sakura" or "koi".',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', enum: ['sakura', 'koi'] },
        category: { type: 'string', enum: ['drinks', 'appetizers', 'mains', 'desserts'] },
      },
      required: ['slug'],
    },
  },
  {
    name: 'find_alternative_restaurant',
    description: 'Find nearby restaurants with shorter wait times when the requested one is full.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', enum: ['sakura', 'koi'] },
        party_size: { type: 'number' },
      },
      required: ['slug', 'party_size'],
    },
  },
  {
    name: 'modify_reservation',
    description: 'Modify an existing reservation. Look up by customer_name and update the specified fields.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', enum: ['sakura', 'koi'] },
        customer_name: { type: 'string', description: 'Name used in the original reservation — used to find it' },
        new_party_size: { type: 'number', description: 'New party size (if changing)' },
        new_requested_time: { type: 'string', description: 'New time (if changing)' },
        new_phone: { type: 'string', description: 'New phone (if changing)' },
      },
      required: ['slug', 'customer_name'],
    },
  },
]

// ── Tool executor ─────────────────────────────────────────────────────────────

function assertNotNull(value: unknown, fieldName: string): string {
  const s = String(value ?? '')
  if (!s || s === 'null' || s === 'undefined' || s === 'unknown') {
    throw new McpError(ErrorCode.InvalidParams, `"${fieldName}" must be provided by the user before calling this tool — do not use placeholder values.`)
  }
  return s
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  const rawSlug = args.slug as string | undefined
  const slug = (rawSlug && rawSlug !== 'null' && VALID_SLUGS.includes(rawSlug)) ? rawSlug : DEFAULT_SLUG

  switch (name) {
    case 'list_restaurants': {
      const restaurants = await apiGet<unknown[]>('/restaurants')
      const items = await Promise.all(
        (restaurants as Array<{ slug: string; name: string; nameJa: string; cuisine: string; address: string; priceRange: string }>).map(async r => {
          try {
            const w = await apiGet<{ estimatedWaitMinutes: number; freeTableCount: number; totalTableCount: number; message: string }>(`/restaurants/${r.slug}/wait`)
            return { ...r, waitMinutes: w.estimatedWaitMinutes, freeTableCount: w.freeTableCount, totalTableCount: w.totalTableCount, status: w.message }
          } catch { return { ...r, status: 'unavailable' } }
        })
      )
      return JSON.stringify(items, null, 2)
    }
    case 'get_restaurant_status': {
      const [restaurant, tables, orders, wait] = await Promise.all([
        apiGet(`/restaurants/${slug}`),
        apiGet<Array<{ id: string; number: number; seats: number; status: string; session?: { expectedEndTime: string; paymentStatus: string } }>>(`/restaurants/${slug}/tables`),
        apiGet<Array<{ id: string; tableNumber: number; totalAmount: number; paymentStatus: string }>>(`/restaurants/${slug}/orders`),
        apiGet<{ estimatedWaitMinutes: number; freeTableCount: number; totalTableCount: number; message: string; nextFreeAt?: string }>(`/restaurants/${slug}/wait`),
      ])
      return JSON.stringify({ restaurant, tables: tables.map(t => ({ number: t.number, seats: t.seats, status: t.status, minutesRemaining: t.session ? Math.max(0, Math.round((new Date(t.session.expectedEndTime).getTime() - Date.now()) / 60000)) : null })), activeOrders: orders.length, waitEstimate: wait }, null, 2)
    }
    case 'check_table_availability': {
      const partySize = (args.party_size as number) ?? 2
      const [tables, wait] = await Promise.all([
        apiGet<Array<{ number: number; seats: number; status: string }>>(`/restaurants/${slug}/tables`),
        apiGet<{ estimatedWaitMinutes: number; freeTableCount: number; message: string; nextFreeAt?: string }>(`/restaurants/${slug}/wait?partySize=${partySize}`),
      ])
      const available = tables.filter(t => t.status === 'free' && t.seats >= partySize)
      return JSON.stringify({ partySize, availableNow: available.length > 0, tablesForParty: available.map(t => ({ tableNumber: t.number, seats: t.seats })), estimatedWaitMinutes: wait.estimatedWaitMinutes, message: wait.message }, null, 2)
    }
    case 'get_wait_time': {
      const partySize = (args.party_size as number) ?? 2
      const wait = await apiGet<{ estimatedWaitMinutes: number; confidence: string; freeTableCount: number; totalTableCount: number; message: string; nextFreeAt?: string }>(`/restaurants/${slug}/wait?partySize=${partySize}`)
      return JSON.stringify(wait, null, 2)
    }
    case 'make_reservation': {
      const customerName = assertNotNull(args.customer_name, 'customer_name')
      const requestedTime = assertNotNull(args.requested_time, 'requested_time')
      const partySize = Number(args.party_size)
      if (!partySize || partySize < 1) {
        throw new McpError(ErrorCode.InvalidParams, '"party_size" must be a real number provided by the user — do not use null or 0.')
      }
      const reservation = await apiPost(`/restaurants/${slug}/reservations`, {
        customerName,
        partySize,
        requestedTime,
        phone: args.phone,
        email: args.email,
        notes: args.notes,
      })
      return JSON.stringify({ success: true, reservation }, null, 2)
    }
    case 'get_menu': {
      const menu = await apiGet<unknown[]>(`/restaurants/${slug}/menu`)
      const filtered = args.category ? (menu as Array<{ category: string }>).filter(m => m.category === args.category) : menu
      return JSON.stringify(filtered, null, 2)
    }
    case 'find_alternative_restaurant': {
      const partySize = (args.party_size as number) ?? 2
      const alternatives = await apiGet(`/restaurants/${slug}/alternatives?partySize=${partySize}`)
      return JSON.stringify(alternatives, null, 2)
    }
    case 'modify_reservation': {
      const customerName = assertNotNull(args.customer_name, 'customer_name')
      const reservations = await apiGet<Array<{ id: string; customerName: string; status: string }>>(`/restaurants/${slug}/reservations`)
      const matches = reservations.filter(r => r.customerName.toLowerCase() === customerName.toLowerCase() && r.status !== 'cancelled')
      if (matches.length === 0) return JSON.stringify({ success: false, error: `No active reservation found for "${customerName}"` })
      // Never silently pick one when the name is ambiguous — modifying the
      // wrong guest's booking is worse than refusing.
      if (matches.length > 1) {
        return JSON.stringify({
          success: false,
          error: `${matches.length} active reservations are under "${customerName}". Ask staff to make this change.`,
        })
      }
      const match = matches[0]
      const body: Record<string, unknown> = {}
      if (args.new_party_size) body.partySize = args.new_party_size
      if (args.new_requested_time) body.requestedTime = args.new_requested_time
      if (args.new_phone) body.phone = args.new_phone
      const res = await fetch(`${API_BASE}/restaurants/${slug}/reservations/${match.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
      const updated = await res.json()
      return JSON.stringify({ success: true, reservation: updated }, null, 2)
    }
    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
  }
}

// ── Server factory ─────────────────────────────────────────────────────────────

function createServer(role: Role): Server {
  const server = new Server(
    { name: 'tableschnappi', version: '1.0.0' },
    { capabilities: { tools: {} } }
  )

  // Discovery: only advertise what this caller may actually use.
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.filter(t => roleMayCall(role, t.name)),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    // Enforcement, deliberately separate from discovery. Filtering tools/list
    // only hides a tool; it does not stop anyone calling it. The September
    // assessment showed the model inventing tool names and invoking them, so
    // the check has to happen here, on the call itself.
    if (!roleMayCall(role, name)) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Tool "${name}" is not available to role "${role}".`,
      )
    }

    try {
      const result = await executeTool(name, (args ?? {}) as Record<string, unknown>)
      return { content: [{ type: 'text', text: result }] }
    } catch (err) {
      if (err instanceof McpError) throw err
      throw new McpError(ErrorCode.InternalError, `Tool "${name}" failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  return server
}

// ── HTTP server (Streamable HTTP transport) ───────────────────────────────────

const httpServer = http.createServer(async (req, res) => {
  // Health endpoint
  if (req.url === '/health' || req.url === '/readyz') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      tools: tools.length,
      // Visible so an operator can confirm the default really is least-privilege.
      toolsByRole: {
        readonly: tools.filter(t => roleMayCall('readonly', t.name)).length,
        guest:    tools.filter(t => roleMayCall('guest', t.name)).length,
        staff:    tools.filter(t => roleMayCall('staff', t.name)).length,
      },
    }))
    return
  }

  // MCP endpoint — each request gets its own stateless transport
  if (req.url === '/mcp' || req.url?.startsWith('/mcp')) {
    const server = createServer(roleFromRequest(req))
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })

    res.on('close', () => server.close().catch(() => {}))

    await server.connect(transport)
    await transport.handleRequest(req, res)
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

httpServer.listen(PORT, () => {
  console.error(`🍜 TableSchnappi MCP server (Streamable HTTP) on port ${PORT}`)
  console.error(`   Tools: ${tools.map(t => t.name).join(', ')}`)
  console.error(`   Roles: readonly (default, reads only) | guest | staff — via ${ROLE_HEADER}`)
  console.error(`   API:   ${API_BASE}`)
  console.error(`   MCP endpoint: /mcp`)
})
