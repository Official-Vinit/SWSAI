import express from "express"
import dotenv from "dotenv"
dotenv.config()
import cors from "cors"
import http from "http"
import connectDb from "./config/db.js"
import { initializeSocket } from "./config/socket.js"
import documentRoutes from "./routes/documentRoutes.js"
import notificationRoutes from "./routes/notificationRoutes.js"
import { notifyUploadFailed } from "./services/notificationService.js"


const PORT = process.env.PORT || 5000
const app = express()
const server = http.createServer(app)

app.use(cors({ origin: process.env.CLIENT_URL || "*" }))
app.use(express.json())

app.use("/api/documents", documentRoutes)
app.use("/api/notifications", notificationRoutes)

app.use(async (error, req, res, next) => {
  console.error(error)

  if (req.path === "/api/documents/upload" && !req.notificationCreated) {
    try {
      await notifyUploadFailed({
        count: Number(req.body?.fileCount) || req.files?.length || 1,
        error: error.message,
        notificationId: req.body?.notificationId || null,
      })
    } catch (notificationError) {
      console.error(notificationError)
    }
  }

  res.status(400).json({ message: error.message || "Something went wrong." })
})

const startServer = async () => {
  try {
    await connectDb()
    initializeSocket(server)

    server.listen(PORT, () => {
      console.log(`Server listening at port ${PORT}`)
    })
  } catch (error) {
    console.error(`Server startup failed: ${error.message}`)
    process.exit(1)
  }
}

startServer()
