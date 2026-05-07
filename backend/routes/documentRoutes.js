import express from "express"
import {
  downloadDocument,
  listDocuments,
  uploadDocuments,
} from "../controllers/documentController.js"
import { upload } from "../middlewares/multer.js"

const router = express.Router()

router.get("/", listDocuments)
router.post("/upload", upload.array("documents", 20), uploadDocuments)
router.get("/:id/download", downloadDocument)

export default router
