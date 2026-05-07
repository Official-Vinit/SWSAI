import mongoose from "mongoose"

const connectDb = async()=>{
    try{
        await mongoose.connect(process.env.MONGO_URL)
        console.log("MongoDb connected")
    }catch(error){
        console.log(`MongoDB error: ${error}`)
    }
}

export default connectDb;