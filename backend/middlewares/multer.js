import multer from "multer"

const storage = multer.memoryStorage()

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
    fileSize: 15 * 1024 * 1024,
  },
})
