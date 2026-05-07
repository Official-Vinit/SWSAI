import mongoose from "mongoose"

const connectDb = async () => {
  await mongoose.connect(process.env.MONGO_URL, {
    serverSelectionTimeoutMS: 10000,
  })
  console.log("MongoDB connected")
}

export default connectDb
