import express from "express"
import dotenv from "dotenv"
dotenv.config()
import cors from "cors"
import http from "http"
import connectDb from "./config/db.js"
import { initializeSocket } from "./config/socket.js"
import documentRoutes from "./routes/documentRoutes.js"


const PORT = process.env.PORT || 5000
const app = express()
const server = http.createServer(app)

app.use(cors({ origin: process.env.CLIENT_URL || "*" }))
app.use(express.json())

app.use("/api/documents", documentRoutes)

app.use((error, req, res, next) => {
  console.error(error)
  res.status(400).json({ message: error.message || "Something went wrong." })
})

initializeSocket(server)

server.listen(PORT, () => {
  connectDb()
  console.log(`Server listening at port ${PORT}`)
})
