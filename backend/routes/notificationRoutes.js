import express from "express"
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js"

const router = express.Router()

router.get("/", listNotifications)
router.patch("/read-all", markAllNotificationsRead)
router.patch("/:id/read", markNotificationRead)

export default router
