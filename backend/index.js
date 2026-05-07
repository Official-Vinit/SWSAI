import express from "express"
import dotenv from "dotenv"
dotenv.config()
import connectDb from "./config/db.js"


const PORT = process.env.PORT || 5000
const app = express()

app.listen(PORT,()=>{
    connectDb()
    console.group(`Server listening at port ${PORT}`)
})