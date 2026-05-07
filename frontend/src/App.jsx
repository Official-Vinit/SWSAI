import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { io } from "socket.io-client"
import "./App.css"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api"
const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || API_URL.replace(/\/api\/?$/, "")
const BULK_UPLOAD_THRESHOLD = 3

const formatBytes = (bytes = 0) => {
  if (!bytes) return "0 B"

  const units = ["B", "KB", "MB", "GB"]
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** unitIndex

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

const formatDate = (date) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date))

const formatTime = (date) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date))

const createUploadItem = (file, batchId = null) => ({
  id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
  batchId,
  file,
  name: file.name,
  size: file.size,
  type: file.type || "application/pdf",
  status: "pending",
  progress: 0,
  message: "",
})

const normalizeNotification = (notification) => ({
  ...notification,
  timestamp: notification.timestamp || notification.createdAt,
})

function App() {
  const [documents, setDocuments] = useState([])
  const [queue, setQueue] = useState([])
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [liveToasts, setLiveToasts] = useState([])
  const [bulkBanner, setBulkBanner] = useState(null)
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false)
  const [isBulkExpanded, setIsBulkExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState("")
  const [notificationError, setNotificationError] = useState("")
  const inputRef = useRef(null)

  const completedCount = useMemo(
    () => queue.filter((item) => item.status === "complete").length,
    [queue]
  )
  const hasBulkQueue = queue.some((item) => item.batchId)
  const visibleQueue = hasBulkQueue && !isBulkExpanded ? queue.slice(0, 3) : queue

  const fetchDocuments = useCallback(async () => {
    setListError("")

    try {
      const response = await fetch(`${API_URL}/documents`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Could not load documents.")
      }

      setDocuments(data.documents || [])
    } catch (error) {
      setListError(error.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchNotifications = useCallback(async () => {
    setNotificationError("")

    try {
      const response = await fetch(`${API_URL}/notifications`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Could not load notifications.")
      }

      setNotifications((data.notifications || []).map(normalizeNotification))
      setUnreadCount(data.unreadCount || 0)
    } catch (error) {
      setNotificationError(error.message)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchDocuments()
      fetchNotifications()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [fetchDocuments, fetchNotifications])

  const addRealtimeNotification = useCallback((payload) => {
    const notification = normalizeNotification(payload)

    setNotifications((currentNotifications) => {
      const existingNotification = currentNotifications.find(
        (item) => item._id === notification._id
      )
      const withoutDuplicate = currentNotifications.filter(
        (item) => item._id !== notification._id
      )

      if (!notification.read && !existingNotification) {
        setUnreadCount((currentCount) => currentCount + 1)
      }

      return [notification, ...withoutDuplicate]
    })

    setLiveToasts((currentToasts) => [notification, ...currentToasts].slice(0, 3))
  }, [])

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    })

    socket.on("bulk-upload:complete", (payload) => {
      addRealtimeNotification(payload)
      setBulkBanner(null)
      setQueue((currentQueue) =>
        currentQueue.map((item) =>
          item.batchId && item.batchId === payload.notificationId
            ? { ...item, status: "complete", progress: 100 }
            : item
        )
      )
      fetchDocuments()
    })

    socket.on("upload:failed", (payload) => {
      addRealtimeNotification(payload)
      setBulkBanner(null)
      setQueue((currentQueue) =>
        currentQueue.map((item) =>
          item.batchId && item.batchId === payload.notificationId
            ? {
                ...item,
                status: "failed",
                message: payload.error || payload.message,
              }
            : item
        )
      )
    })

    socket.on("notification:created", addRealtimeNotification)

    return () => socket.disconnect()
  }, [addRealtimeNotification, fetchDocuments])

  const updateQueueItem = (id, patch) => {
    setQueue((currentQueue) =>
      currentQueue.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  const markBatch = (batchId, patch, options = {}) => {
    setQueue((currentQueue) =>
      currentQueue.map((item) => {
        if (item.batchId !== batchId) {
          return item
        }

        if (options.preserveComplete && item.status === "complete") {
          return item
        }

        return { ...item, ...patch }
      })
    )
  }

  const markNotificationRead = async (notificationId) => {
    const target = notifications.find((notification) => notification._id === notificationId)

    try {
      const response = await fetch(`${API_URL}/notifications/${notificationId}/read`, {
        method: "PATCH",
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Could not update notification.")
      }

      setNotifications((currentNotifications) =>
        currentNotifications.map((notification) =>
          notification._id === notificationId
            ? normalizeNotification(data.notification)
            : notification
        )
      )

      if (target && !target.read) {
        setUnreadCount((currentCount) => Math.max(currentCount - 1, 0))
      }
    } catch (error) {
      setNotificationError(error.message)
    }
  }

  const markAllNotificationsRead = async () => {
    try {
      const response = await fetch(`${API_URL}/notifications/read-all`, {
        method: "PATCH",
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || "Could not update notifications.")
      }

      setNotifications((data.notifications || []).map(normalizeNotification))
      setUnreadCount(0)
    } catch (error) {
      setNotificationError(error.message)
    }
  }

  const uploadFile = (item) => {
    const formData = new FormData()
    formData.append("fileCount", "1")
    formData.append("documents", item.file)

    updateQueueItem(item.id, { status: "uploading", progress: 0, message: "" })

    const request = new XMLHttpRequest()
    request.open("POST", `${API_URL}/documents/upload`)

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return

      updateQueueItem(item.id, {
        progress: Math.round((event.loaded / event.total) * 100),
      })
    }

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        updateQueueItem(item.id, { status: "complete", progress: 100 })
        fetchDocuments()
        return
      }

      let message = "Upload failed."
      try {
        message = JSON.parse(request.responseText).message || message
      } catch {
        message = request.statusText || message
      }

      updateQueueItem(item.id, { status: "failed", message })
    }

    request.onerror = () => {
      updateQueueItem(item.id, {
        status: "failed",
        message: "Unable to connect to the backend.",
      })
    }

    request.send(formData)
  }

  const uploadBulkFiles = (items, batchId) => {
    const formData = new FormData()
    formData.append("notificationId", batchId)
    formData.append("fileCount", String(items.length))
    items.forEach((item) => formData.append("documents", item.file))

    markBatch(batchId, { status: "uploading", progress: 0, message: "" })

    const request = new XMLHttpRequest()
    request.open("POST", `${API_URL}/documents/upload`)

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return

      markBatch(batchId, {
        progress: Math.round((event.loaded / event.total) * 90),
      })
    }

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        markBatch(
          batchId,
          {
            progress: 95,
            message: "Waiting for server confirmation...",
          },
          { preserveComplete: true }
        )
        return
      }

      let message = "Bulk upload failed."
      try {
        message = JSON.parse(request.responseText).message || message
      } catch {
        message = request.statusText || message
      }

      setBulkBanner(null)
      markBatch(batchId, { status: "failed", message })
    }

    request.onerror = () => {
      setBulkBanner(null)
      markBatch(batchId, {
        status: "failed",
        message: "Unable to connect to the backend.",
      })
    }

    request.send(formData)
  }

  const handleFiles = (fileList) => {
    const selectedFiles = Array.from(fileList || [])
    const pdfFiles = selectedFiles.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    )
    const skippedCount = selectedFiles.length - pdfFiles.length

    if (!pdfFiles.length) {
      if (skippedCount) {
        setQueue((currentQueue) => [
          {
            id: crypto.randomUUID(),
            name: "Unsupported files",
            size: 0,
            type: "-",
            status: "failed",
            progress: 0,
            message: "Only PDF files can be uploaded.",
          },
          ...currentQueue,
        ])
      }
      return
    }

    const isBulkUpload = pdfFiles.length > BULK_UPLOAD_THRESHOLD
    const batchId = isBulkUpload ? crypto.randomUUID() : null
    const uploadItems = pdfFiles.map((file) => createUploadItem(file, batchId))

    setQueue((currentQueue) => [...uploadItems, ...currentQueue])

    if (skippedCount) {
      setQueue((currentQueue) =>
        currentQueue.map((item) =>
          item.id === uploadItems[0].id
            ? { ...item, message: `${skippedCount} non-PDF file skipped.` }
            : item
        )
      )
    }

    if (isBulkUpload) {
      setBulkBanner({
        batchId,
        message: `Upload in progress — processing ${pdfFiles.length} files in background.`,
      })
      setIsBulkExpanded(false)
      uploadBulkFiles(uploadItems, batchId)
      return
    }

    uploadItems.forEach(uploadFile)
  }

  const handleInputChange = (event) => {
    handleFiles(event.target.files)
    event.target.value = ""
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    handleFiles(event.dataTransfer.files)
  }

  return (
    <main className="page-shell">
      <header className="app-header">
        <div>
          <p>Document workspace</p>
          <h1>Uploads</h1>
        </div>

        <div className="notification-menu">
          <button
            className="notification-button"
            type="button"
            aria-label="Open notifications"
            onClick={() => setIsNotificationPanelOpen((current) => !current)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2Z" />
              <path d="M9.5 20a2.5 2.5 0 0 0 5 0" />
            </svg>
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </button>

          {isNotificationPanelOpen && (
            <section className="notification-panel">
              <div className="notification-panel-header">
                <div>
                  <h2>Notifications</h2>
                  <p>{unreadCount} unread</p>
                </div>
                <button
                  className="text-button"
                  type="button"
                  onClick={markAllNotificationsRead}
                  disabled={!unreadCount}
                >
                  Mark all read
                </button>
              </div>

              {notificationError && <p className="notification-error">{notificationError}</p>}

              <div className="notification-list">
                {notifications.length === 0 && (
                  <p className="empty-state">No notifications yet.</p>
                )}

                {notifications.map((notification) => (
                  <article
                    className={`notification-item type-${notification.type}${
                      notification.read ? "" : " is-unread"
                    }`}
                    key={notification._id}
                  >
                    <div>
                      <strong>{notification.message}</strong>
                      <p>{formatTime(notification.timestamp)}</p>
                    </div>
                    {!notification.read && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => markNotificationRead(notification._id)}
                      >
                        Mark read
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </header>

      <div className="notification-stack">
        {bulkBanner && <div className="banner">{bulkBanner.message}</div>}
        {liveToasts.map((notification) => (
          <div className={`toast type-${notification.type}`} key={notification._id}>
            <strong>{notification.message}</strong>
            <span>{formatTime(notification.timestamp)}</span>
          </div>
        ))}
      </div>

      <section className="upload-section">
        <div className="section-title">
          <span>File Upload</span>
          <h2>Upload PDF documents</h2>
          <p>Choose one PDF or upload a batch. Each file is tracked separately.</p>
        </div>

        <div
          className={`drop-zone${isDragging ? " is-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            className="file-input"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={handleInputChange}
          />

          <div className="drop-copy">
            <div className="pdf-badge">PDF</div>
            <div>
              <h2>Drag files here</h2>
              <p>PDF only, up to 20 files per selection.</p>
            </div>
          </div>

          <button type="button" onClick={() => inputRef.current?.click()}>
            Browse files
          </button>
        </div>
      </section>

      {queue.length > 0 && (
        <section className={`queue-section${hasBulkQueue ? " is-minimal" : ""}`}>
          <div className="panel-heading">
            <div>
              <h2>Upload progress</h2>
              {hasBulkQueue && <p>Bulk uploads stay compact while processing.</p>}
            </div>
            <span>
              {completedCount} of {queue.length} complete
            </span>
          </div>

          <div className="upload-list">
            {visibleQueue.map((item) => (
              <article className="upload-card" key={item.id}>
                <div className="file-summary">
                  <div>
                    <h3>{item.name}</h3>
                    <p>
                      {formatBytes(item.size)} - {item.type || "PDF"}
                    </p>
                  </div>
                  <span className={`status status-${item.status}`}>
                    {item.status}
                  </span>
                </div>

                <div className="progress-line">
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <strong>{item.progress}%</strong>
                </div>

                {item.message && <p className="message">{item.message}</p>}
              </article>
            ))}
          </div>

          {hasBulkQueue && queue.length > 3 && (
            <button
              className="toggle-button"
              type="button"
              onClick={() => setIsBulkExpanded((current) => !current)}
            >
              {isBulkExpanded ? "Show less" : `Show all ${queue.length} files`}
            </button>
          )}
        </section>
      )}

      <section className="documents-section">
        <div className="panel-heading">
          <h2>Documents</h2>
          <span>{documents.length} uploaded</span>
        </div>

        {listError && <p className="table-message error">{listError}</p>}

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan="4">Loading documents...</td>
                </tr>
              )}

              {!isLoading && !documents.length && (
                <tr>
                  <td colSpan="4">No uploaded documents yet.</td>
                </tr>
              )}

              {!isLoading &&
                documents.map((document) => (
                  <tr key={document._id}>
                    <td>{document.originalName}</td>
                    <td>{formatBytes(document.size)}</td>
                    <td>{formatDate(document.createdAt)}</td>
                    <td>
                      <a
                        className="download-button"
                        href={`${API_URL}/documents/${document._id}/download`}
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default App
