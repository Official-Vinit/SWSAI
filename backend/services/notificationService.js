import { getSocketServer } from "../config/socket.js"
import Notification from "../models/Notification.js"

const toNotificationPayload = (notification) => ({
  _id: notification._id,
  message: notification.message,
  type: notification.type,
  read: notification.read,
  timestamp: notification.timestamp || notification.createdAt,
  createdAt: notification.createdAt,
  updatedAt: notification.updatedAt,
})

export const createNotification = async ({ message, type = "info", event, meta = {} }) => {
  const notification = await Notification.create({ message, type })
  const payload = {
    ...toNotificationPayload(notification),
    ...meta,
  }
  const io = getSocketServer()

  if (io && event) {
    io.emit(event, payload)
  }

  return payload
}

export const notifyBulkUploadComplete = ({ count, documents, notificationId }) =>
  createNotification({
    message: `${count} files uploaded successfully`,
    type: "success",
    event: "bulk-upload:complete",
    meta: {
      count,
      notificationId,
      documents,
    },
  })

export const notifyUploadFailed = ({ count, error, notificationId }) =>
  createNotification({
    message: `${count} file${count === 1 ? "" : "s"} failed to upload`,
    type: "error",
    event: "upload:failed",
    meta: {
      error,
      notificationId,
      count,
    },
  })
