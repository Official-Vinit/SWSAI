import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadDir = path.resolve(__dirname, "..", "public", "uploads")
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_")
    cb(null, `${uniqueSuffix}-${safeName}`)
  },
})

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true)
    return
  }

  cb(new Error("Only PDF files are allowed."))
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: 20,
    fileSize: 25 * 1024 * 1024,
  },
})
