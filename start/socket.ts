// start/socket.ts
import { Server as SocketIOServer } from 'socket.io'

let io: SocketIOServer

export function setupWebSocket(server: any) {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*', // Cambia esto según tu frontend
    },
  })

  io.on('connection', (socket) => {
    console.log('🔌 Cliente conectado:', socket.id)

    // Recibe un mensaje y lo retransmite
    socket.on('mensaje', (data) => {
      console.log('📨 Mensaje recibido:', data)
      socket.broadcast.emit('mensaje', data)
    })

    socket.on('disconnect', () => {
      console.log('❌ Cliente desconectado:', socket.id)
    })
  })
}

export { io }
