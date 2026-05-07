import crypto from "crypto"
import Document from "../models/Document.js"
import {
  notifyBulkUploadComplete,
  notifyUploadFailed,
} from "../services/notificationService.js"

const buildStoredName = (originalName) =>
  `${Date.now()}-${crypto.randomUUID()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, "_")}`

const toDocumentResponse = (document) => ({
  _id: document._id,
  originalName: document.originalName,
  storedName: document.storedName,
  size: document.size,
  mimeType: document.mimeType,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
})

export const uploadDocuments = async (req, res, next) => {
  try {
    const files = req.files || []
    const notificationId = req.body?.notificationId || null

    if (!files.length) {
      return res.status(400).json({ message: "Please upload at least one PDF file." })
    }

    const documents = await Document.insertMany(
      files.map((file) => ({
        originalName: file.originalname,
        storedName: buildStoredName(file.originalname),
        size: file.size,
        mimeType: file.mimetype,
        data: file.buffer,
      }))
    )

    const responseDocuments = documents.map(toDocumentResponse)

    if (files.length > 3) {
      await notifyBulkUploadComplete({
        count: files.length,
        documents: responseDocuments,
        notificationId,
      })
    }

    return res.status(201).json({
      backgroundProcessing: files.length > 3,
      notificationId,
      documents: responseDocuments,
    })
  } catch (error) {
    if ((req.files || []).length > 3) {
      await notifyUploadFailed({
        count: req.files.length,
        error: error.message,
        notificationId: req.body?.notificationId || null,
      })
    }

    return next(error)
  }
}

export const listDocuments = async (req, res, next) => {
  try {
    const documents = await Document.find().select("-data").sort({ createdAt: -1 })
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

    if (!document.data) {
      return res.status(404).json({ message: "Stored file data not found." })
    }

    res.setHeader("Content-Type", document.mimeType)
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(document.originalName)}"`
    )
    res.setHeader("Content-Length", document.size)

    return res.send(document.data)
  } catch (error) {
    return next(error)
  }
}
