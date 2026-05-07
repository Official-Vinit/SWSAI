import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import "./App.css"

const API_URL = import.meta.env.VITE_API_URL

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

const createUploadItem = (file) => ({
  id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
  file,
  name: file.name,
  size: file.size,
  type: file.type || "application/pdf",
  status: "pending",
  progress: 0,
  message: "",
})

function App() {
  const [documents, setDocuments] = useState([])
  const [queue, setQueue] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [listError, setListError] = useState("")
  const inputRef = useRef(null)

  const completedCount = useMemo(
    () => queue.filter((item) => item.status === "complete").length,
    [queue]
  )

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

  useEffect(() => {
    const timer = window.setTimeout(fetchDocuments, 0)
    return () => window.clearTimeout(timer)
  }, [fetchDocuments])

  const updateQueueItem = (id, patch) => {
    setQueue((currentQueue) =>
      currentQueue.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  const uploadFile = (item) => {
    const formData = new FormData()
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

  const handleFiles = (fileList) => {
    const selectedFiles = Array.from(fileList || [])
    const pdfFiles = selectedFiles.filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
    )
    const skippedCount = selectedFiles.length - pdfFiles.length
    const uploadItems = pdfFiles.map(createUploadItem)

    if (!uploadItems.length) {
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

    setQueue((currentQueue) => [...uploadItems, ...currentQueue])
    uploadItems.forEach(uploadFile)

    if (skippedCount) {
      setQueue((currentQueue) =>
        currentQueue.map((item) =>
          item.id === uploadItems[0].id
            ? { ...item, message: `${skippedCount} non-PDF file skipped.` }
            : item
        )
      )
    }
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
      <section className="upload-section">
        <div className="section-title">
          <span>File Upload</span>
          <h1>Upload PDF documents</h1>
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
        <section className="queue-section">
          <div className="panel-heading">
            <h2>Upload progress</h2>
            <span>
              {completedCount} of {queue.length} complete
            </span>
          </div>

          <div className="upload-list">
            {queue.map((item) => (
              <article className="upload-card" key={item.id}>
                <div className="file-summary">
                  <div>
                    <h3>{item.name}</h3>
                    <p>
                      {formatBytes(item.size)} · {item.type || "PDF"}
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
