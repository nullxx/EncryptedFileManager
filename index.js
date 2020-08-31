/* BEGIN IMPORT 'GLOBAL' MODULES */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const expressFileUpload = require('express-fileupload');
/* END IMPORT 'GLOBAL' MODULES */

/* BEGIN IMPORT 'SPECIFIC' MODULES */
const restRouter = require('./routes/rest');
const operationsRouter = require('./routes/operations');
require('dotenv').config();
const app = express();
/* END IMPORT 'SPECIFIC' MODULES */

/* START OF EXPRESS MIDDLEWARE */
app.use(helmet());
app.use(morgan('tiny'));
app.use(cors());
app.use(expressFileUpload());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
/* END OF EXPRESS MIDDLEWARE */

/* START EXPRESS ROUTES */
app.use('/rest', restRouter);
app.use('/operate', operationsRouter);
/* END EXPRESS ROUTES */

// ERROR HANDLING
app.use((error, _req, res, _next) => {
    res.status(error.status || error.code || 500);
    let msg = null;
    switch (error.code) { /* TO CUSTOMIZE ERROR MESSAGES */
        default:
            msg = error.message;
    }
    res.json({
        code: 0,
        error: {
            message: msg,
            stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
            internalCode: error.code || undefined,
        }
    })
})


const port = parseInt(process.env.PORT || 3001);

app.listen(port, () => {
    console.log(`Listening at ${port}`);
})
