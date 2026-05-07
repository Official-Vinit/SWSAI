import mongoose from "mongoose"

const notificationSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["success", "error", "info"],
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
)

const Notification = mongoose.model("Notification", notificationSchema)

export default Notification
