import express from "express"
import {
  createSystemNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js"

const router = express.Router()

router.get("/", listNotifications)
router.post("/", createSystemNotification)
router.patch("/read-all", markAllNotificationsRead)
router.patch("/:id/read", markNotificationRead)

export default router
