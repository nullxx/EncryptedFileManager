/* BEGIN IMPORT 'GLOBAL' MODULES */
const express = require('express');
const router = express.Router();
/* END IMPORT 'GLOBAL' MODULES */

/* BEGIN IMPORT 'SPECIFIC' MODULES */
const NodeRSA = require('node-rsa');
const monk = require('monk');
const yup = require('yup');
/* END IMPORT 'SPECIFIC' MODULES */

require('dotenv').config(); /* For usage of process.env */

/* Setting up MONGODB */
const db = monk(process.env.MONGO_URI);
const dbFiles = db.get('files'); /* Collection to store our files */

const mbFilesizeMax = 16; /* MONGODB LIMIT (https://docs.mongodb.com/manual/reference/limits/) */
const maxBytesFileSize = mbFilesizeMax * Math.pow(1024, 2);

router.post('/upload', async (req, res, next) => {
    /* DEF SCHEMA FOR VALIDATION */
    const schema = yup.object().shape({
        files: yup.object().nullable().required(),
    });

    try {
        const { files } = req;
        await schema.validate({ files }); /* Validate request params with defined schema */
        const rsaPrvKeyLength = parseInt(process.env.RSA_PUBLIC_KEY_LENGTH) || 512;

        const parsedFiles = parseFiles(files);

        let response = { code: 1, files: [] };
        response.files = await processFiles(parsedFiles, rsaPrvKeyLength);
        res.json(response);

    } catch (error) {
        next(error);
    }
});

/* BEGIN /post backend */
/**
 * Encryption of given files
 * @param {Array<object>} files Files to be encrypted
 * @param {number} rsaPrvKeyLength RSA private key length
 */
function processFiles(files, rsaPrvKeyLength) {
    return new Promise((res, rej) => {
        (async () => {
            let toReturn = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (file.size > maxBytesFileSize) {
                    toReturn.push({
                        error: {
                            message: `File '${file.name}' size is larger than ${mbFilesizeMax}MB (${file.size}B > ${maxBytesFileSize}B)`
                        }
                    })
                    continue;
                }
                try {
                    const key = new NodeRSA({ b: rsaPrvKeyLength });

                    const fileEncrypted = key.encrypt(file.data);
                    const fileHashEncrypted = key.encrypt(file.md5);
                    const mimeTypeEncrypted = key.encrypt(file.mimetype);
                    const fileNameEncrypted = key.encrypt(file.name);

                    // store in DB
                    const inserted = await dbFiles.insert({
                        data: fileEncrypted,
                        details: {
                            fileHash: fileHashEncrypted,
                            mimeType: mimeTypeEncrypted,
                            fileName: fileNameEncrypted
                        },
                        upload: {
                            date: new Date().getTime(),
                            availableDays: 30,
                        }
                    });

                    const fileResponse = {
                        key: key.exportKey(),
                        metaData: {
                            name: file.name
                        },
                        id: inserted._id
                    }
                    toReturn.push(fileResponse);
                } catch (error) {
                    if (error.code == 'ERR_OUT_OF_RANGE') {
                        toReturn.push({
                            error: {
                                message: `File '${file.name}' encoded size result is larger than ${mbFilesizeMax}MB.`
                            }
                        })
                    } else {
                        rej(error);
                    }
                }
            }
            res(toReturn)
        })()
    })
}
/**
 * Returns validated files
 * @param {Array<object>} files Files to be validated
 */
function parseFiles(files) {
    let finalFiles = [];
    Object.keys(files).forEach(function (i) {
        let step1File = files[i];
        if (Array.isArray(step1File)) {
            for (let j = 0; j < step1File.length; j++) {
                const step2File = step1File[j];
                if (validateSingleFile(step2File)) finalFiles.push(step2File);
            }
        } else {
            if (validateSingleFile(step1File)) finalFiles.push(step1File);
        }
    });
    return finalFiles;
}
/**
 * Checks if given file is not undefined || null & file size > 0
 * @param {File} file file to validate
 */
function validateSingleFile(file) {
    if (file && file.size > 0) {
        return true;
    }
    return false;
}
/* END /post backend */

module.exports = router;