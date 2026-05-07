import fs from "fs"
import Document from "../models/Document.js"

export const uploadDocuments = async (req, res, next) => {
  try {
    const files = req.files || []

    if (!files.length) {
      return res.status(400).json({ message: "Please upload at least one PDF file." })
    }

    const documents = await Document.insertMany(
      files.map((file) => ({
        originalName: file.originalname,
        storedName: file.filename,
        size: file.size,
        mimeType: file.mimetype,
        path: file.path,
      }))
    )

    return res.status(201).json({ documents })
  } catch (error) {
    return next(error)
  }
}

export const listDocuments = async (req, res, next) => {
  try {
    const documents = await Document.find().sort({ createdAt: -1 })
    return res.json({ documents })
  } catch (error) {
    return next(error)
  }
}

export const downloadDocument = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id)

    if (!document) {
      return res.status(404).json({ message: "Document not found." })
    }

    if (!fs.existsSync(document.path)) {
      return res.status(404).json({ message: "Stored file not found." })
    }

    return res.download(document.path, document.originalName)
  } catch (error) {
    return next(error)
  }
}
