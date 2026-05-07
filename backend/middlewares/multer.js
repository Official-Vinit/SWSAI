import multer from "multer"
import fs from "fs"
import path from "path"

const uploadDir = path.resolve("public")
if(!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir,{recursive:true})
}

const storage =  multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null,uploadDir)
    },
    filename:(req,file,cb)=>{
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random()*1e9)}`
        cb(null,`${uniqueSuffix}-${file.originalname}`)
    }
})

export const upload = multer({storage})
