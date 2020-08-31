/* BEGIN IMPORT 'GLOBAL' MODULES */
const express = require('express');
const router = express.Router();
/* END IMPORT 'GLOBAL' MODULES */

/* BEGIN IMPORT 'SPECIFIC' MODULES */
const NodeRSA = require('node-rsa');
const monk = require('monk');
const yup = require('yup');
var mimeDb = require("mime-db")
/* END IMPORT 'SPECIFIC' MODULES */

require('dotenv').config(); /* For usage of process.env */

/* Setting up MONGODB */
const db = monk(process.env.MONGO_URI);
const dbFiles = db.get('files'); /* Collection to store our files */

/* DEF SCHEMA FOR VALIDATION */
const encryptedSchema = yup.object().shape({
    key: yup.string().trim().required(),
    id: yup.string().trim().matches(/^[0-9a-fA-F]{24}$/),
})

router.post('/retrieveFile', async (req, res, next) => {
    /* CONT DEF SCHEMA FOR VALIDATION */
    const sheme = yup.object().shape({
        files: yup.array().of(encryptedSchema).required(),
    });

    try {
        const { files } = req.body;
        await sheme.validate({ files }); /* Validate request params with defined schema */

        let pFiles = await processFileHashes(files);
        res.json({ code: 1, files: pFiles });
    } catch (error) {
        next(error)
    }
});

router.post('/download', async (req, res, next) => {
    /* CONT DEF SCHEMA FOR VALIDATION */
    const scheme = yup.object().shape({
        file: encryptedSchema
    });
    const { file } = req.body;
    try {
        await scheme.validate({ file }); /* Validate request params with defined schema */
        let pFile = await processFileHashes([file]);

        res.attachment(/* If fileName not include '.' create default file */ !pFile.fileName.includes('.') ? `file.${mimeDb[pFile.fileMimeType].extensions[0]}` : pFile.fileName).send(pFile.fileData);
    } catch (error) {
        next(error)
    }
})

/* START /retrieveFile & /download backend */
/**
 * Find given files in db and decrypt them
 * @param {Array<object>} files Files to decrypt
 */
function processFileHashes(files) {
    return new Promise(async (res, rej) => {
        try {
            let processedFiles = [];
            for (let i = 0; i < files.length; i++) {
                const { key, id } = files[i];

                const dbFileResult = await dbFiles.findOne({
                    _id: id,
                });

                if (!dbFileResult) {
                    let error = new Error("Not found");
                    error.status = 404;
                    error.code = 404;
                    throw error;
                }

                const validKey = new NodeRSA(key);

                const fileData = Buffer.isBuffer(dbFileResult.data.buffer) ? validKey.decrypt(dbFileResult.data.buffer) : validKey.decrypt(dbFileResult.data);
                const fileName = Buffer.isBuffer(dbFileResult.details.fileName.buffer) ? validKey.decrypt(dbFileResult.details.fileName.buffer, 'utf8') : validKey.decrypt(dbFileResult.details.fileName, 'utf8');
                const fileMimeType = Buffer.isBuffer(dbFileResult.details.mimeType.buffer) ? validKey.decrypt(dbFileResult.details.mimeType.buffer, 'utf8') : validKey.decrypt(dbFileResult.details.mimeType, 'utf8');

                processedFiles.push({ fileData, fileName, fileMimeType })
            }
            res(processedFiles.length == 1 ? { ...processedFiles[0] } : processedFiles);
        } catch (error) {
            rej(error)
        }
    })
}
/* END /retrieveFile & /download backend */

module.exports = router;