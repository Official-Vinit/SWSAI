import { getSocketServer } from "../config/socket.js"

export const notifyBulkUploadComplete = ({ count, documents, notificationId }) => {
  const io = getSocketServer()

  if (!io) {
    return
  }

  const timestamp = new Date().toISOString()

  io.emit("bulk-upload:complete", {
    message: `${count} files uploaded successfully`,
    count,
    notificationId,
    timestamp,
    documents,
  })
}
