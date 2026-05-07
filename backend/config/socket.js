import { Server } from "socket.io"

let io

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
    },
  })

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`)

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`)
    })
  })

  return io
}

export const getSocketServer = () => io
