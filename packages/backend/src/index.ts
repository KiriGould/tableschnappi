import express from 'express'
import { createServer } from 'http'
import { Server as SocketIO } from 'socket.io'
import cors from 'cors'
import { seed } from './seed'
import { createRouter } from './routes'
import { createAssistantRouter } from './assistant'
import { store } from './store'

const app = express()
const httpServer = createServer(app)

const io = new SocketIO(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
})

app.use(cors())
app.use(express.json())

// Broadcast helper passed to routes so they can push realtime events
const emit = (event: string, data: unknown) => io.emit(event, data)

app.use('/api', createRouter(emit))
app.use('/api', createAssistantRouter())

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`)

  socket.on('subscribe:restaurant', (slug: string) => {
    const restaurant = store.getBySlug(slug)
    if (!restaurant) return

    socket.join(`restaurant:${restaurant.id}`)
    // Send initial state
    socket.emit('restaurant:state', {
      restaurant,
      tables: store.getRestaurantTables(restaurant.id),
      orders: store.getActiveOrders(restaurant.id),
    })
  })

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`)
  })
})

// Periodic timer updates (every 30s) for table countdowns
setInterval(() => {
  const now = Date.now()
  store.tables.forEach((table) => {
    if (table.session?.expectedEndTime) {
      const remaining = new Date(table.session.expectedEndTime).getTime() - now
      io.emit('table:timer', { tableId: table.id, remainingMs: remaining })
    }
  })
}, 30_000)

seed()

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`🍜 TableSchnappi backend running on http://localhost:${PORT}`)
  console.log(`   API: http://localhost:${PORT}/api`)
  console.log(`   Customer menu: http://localhost:5173/menu/sakura/1`)
  console.log(`   Staff dashboard: http://localhost:5173/staff`)
})
