# SWSAI Document Upload System

SWSAI is a full-stack document upload application for uploading, storing, downloading, and tracking PDF documents. It supports single-file uploads, bulk uploads, per-file progress tracking, real-time bulk upload notifications, and a persistent notification center backed by MongoDB.

## Features

- Single PDF upload and bulk PDF upload
- Drag-and-drop and file picker support
- Per-file progress, status, size, and type display
- MongoDB-backed file storage using `Buffer`
- Uploaded document list with size, upload date, and download action
- Smart bulk upload behavior for more than 3 files
- Real-time notifications with Socket.IO
- Persistent notification center stored in MongoDB
- Unread notification badge
- Mark individual notifications as read
- Mark all notifications as read

## Tech Stack

**Frontend**

- React 19
- Vite
- Socket.IO Client
- Livvic font
- Plain CSS

**Backend**

- Node.js
- Express 5
- MongoDB Atlas
- Mongoose
- Multer
- Socket.IO

## Project Structure

```txt
SWSAI/
  backend/
    config/
      db.js
      socket.js
    controllers/
      documentController.js
      notificationController.js
    middlewares/
      multer.js
    models/
      Document.js
      Notification.js
    routes/
      documentRoutes.js
      notificationRoutes.js
    services/
      notificationService.js
    index.js
    package.json

  frontend/
    src/
      App.jsx
      App.css
      index.css
      main.jsx
    package.json
```

## How It Works

### Upload Flow

1. Users select or drop one or more PDF files.
2. The frontend validates PDF files before upload.
3. For 3 or fewer files, each file uploads individually and shows inline progress.
4. For more than 3 files, the frontend sends one bulk upload request and shows a background-processing banner.
5. The backend receives files through Multer memory storage.
6. Files are stored directly in MongoDB as binary buffers.
7. Metadata is stored with each document record.
8. Uploaded documents appear in the document table and can be downloaded.

### Bulk Notification Flow

1. When more than 3 files are uploaded, the frontend sends a `notificationId`.
2. The backend stores the files in MongoDB.
3. After successful processing, the backend creates a success notification in MongoDB.
4. The backend emits a `bulk-upload:complete` Socket.IO event.
5. The frontend receives the event, updates the upload queue, refreshes documents, and updates the notification center.

### Notification Center Flow

1. Notifications are stored in MongoDB with:
   - `message`
   - `type`
   - `timestamp`
   - `read`
2. The frontend fetches notifications from the backend on page load.
3. The header bell shows the unread count.
4. Users can mark a notification as read or mark all as read.
5. Notifications persist across page refreshes because they are fetched from MongoDB.

## Backend Setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=5000
MONGO_URL="your_mongodb_connection_string"
CLIENT_URL=http://localhost:5173
```

Start the backend:

```bash
npm run dev
```

The backend runs on:

```txt
http://localhost:5000
```

## Frontend Setup

```bash
cd frontend
npm install
```

Optional frontend environment file:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Start the frontend:

```bash
npm run dev
```

The frontend runs on:

```txt
http://localhost:5173
```

## API Reference

### Documents

#### List Documents

```txt
GET /api/documents
```

Returns uploaded document metadata. File buffers are excluded from this response.

#### Upload Documents

```txt
POST /api/documents/upload
```

Form data:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `documents` | File or File[] | Yes | PDF files to upload |
| `notificationId` | String | No | Used by bulk uploads to match Socket.IO events |
| `fileCount` | Number | No | Used for failure notification counts |

Limits:

- Maximum 20 files per request
- Maximum 15 MB per file
- PDF files only

#### Download Document

```txt
GET /api/documents/:id/download
```

Downloads a document from MongoDB.

### Notifications

#### List Notifications

```txt
GET /api/notifications
```

Returns:

```json
{
  "notifications": [],
  "unreadCount": 0
}
```

#### Create System Notification

```txt
POST /api/notifications
```

Body:

```json
{
  "message": "System maintenance scheduled",
  "type": "info"
}
```

Allowed notification types:

- `success`
- `error`
- `info`

#### Mark One Notification As Read

```txt
PATCH /api/notifications/:id/read
```

#### Mark All Notifications As Read

```txt
PATCH /api/notifications/read-all
```

## Socket.IO Events

### `bulk-upload:complete`

Emitted after a bulk upload completes successfully.

```json
{
  "_id": "notification_id",
  "message": "4 files uploaded successfully",
  "type": "success",
  "read": false,
  "timestamp": "2026-05-07T00:00:00.000Z",
  "count": 4,
  "notificationId": "client_batch_id",
  "documents": []
}
```

### `upload:failed`

Emitted when an upload fails.

```json
{
  "_id": "notification_id",
  "message": "4 files failed to upload",
  "type": "error",
  "read": false,
  "timestamp": "2026-05-07T00:00:00.000Z",
  "notificationId": "client_batch_id",
  "error": "Only PDF files are allowed."
}
```

### `notification:created`

Emitted when a system notification is created through the API.

## MongoDB Notes

This project stores PDF file data directly inside MongoDB documents as `Buffer` values. MongoDB has a 16 MB document size limit, so the backend caps file uploads at 15 MB per PDF.

For larger production documents, consider moving file bytes to object storage such as S3, Firebase Storage, or GridFS while keeping metadata in MongoDB.

If MongoDB Atlas rejects the connection, check:

- Atlas Network Access IP allowlist
- Username and password
- Cluster status
- `MONGO_URL` value in `backend/.env`

## Verification Commands

Backend syntax checks:

```bash
cd backend
node --check index.js
node --check controllers/documentController.js
node --check controllers/notificationController.js
node --check services/notificationService.js
```

Frontend checks:

```bash
cd frontend
npm run build
npm run lint
```

## Current Limitations

- Authentication and user-specific notifications are not implemented yet.
- Notifications are global to all connected clients.
- Files are stored directly in MongoDB and should stay below the configured 15 MB limit.
- Upload progress reflects network upload progress; server-side processing completion is confirmed by Socket.IO for bulk uploads.

## License

This project is currently private/internal. Add a license before public distribution.
