import Notification from "../models/Notification.js"

export const listNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 })
    const unreadCount = await Notification.countDocuments({ read: false })

    return res.json({ notifications, unreadCount })
  } catch (error) {
    return next(error)
  }
}

export const markNotificationRead = async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    )

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." })
    }

    return res.json({ notification })
  } catch (error) {
    return next(error)
  }
}

export const markAllNotificationsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ read: false }, { read: true })
    const notifications = await Notification.find().sort({ createdAt: -1 })

    return res.json({ notifications, unreadCount: 0 })
  } catch (error) {
    return next(error)
  }
}
