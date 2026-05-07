import express from "express"
import dotenv from "dotenv"
dotenv.config()
import cors from "cors"
import connectDb from "./config/db.js"
import documentRoutes from "./routes/documentRoutes.js"


const PORT = process.env.PORT || 5000
const app = express()

app.use(cors())
app.use(express.json())

app.use("/api/documents", documentRoutes)

app.use((error, req, res, next) => {
  console.error(error)
  res.status(400).json({ message: error.message || "Something went wrong." })
})

app.listen(PORT, () => {
  connectDb()
  console.log(`Server listening at port ${PORT}`)
})
