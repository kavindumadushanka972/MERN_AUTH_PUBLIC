require('dotenv').config() // to process .env file
const express = require('express') // Express, is a back end web application framework for Node. js
const mongoose = require('mongoose') // to interact with mongodb database
const cors = require('cors') /**
 * CORS is shorthand for Cross-Origin Resource Sharing. It is a mechanism to allow or restrict requested resources on a web server depend on where the HTTP request was initiated.

This policy is used to secure a certain web server from access by other website or domain. For example, only the allowed domains will be able to access hosted files in a server such as a stylesheet, image, or a script.

For example, while you are still in the development stage - if you are using a frontend library such as React, your front end application will be served on http://localhost:3000. Meanwhile, your Express server might be running on a different port such as http://localhost:2020.

Because of this, you'll need to allow CORS between those servers.
 */
const cookieParser = require('cookie-parser') // module for parsing cookies
const fileUpload = require('express-fileupload') // to upload files
const path = require('path')

const app = express()
app.use(express.json())
app.use(cors())
app.use(cookieParser())
app.use(fileUpload({
    useTempFiles: true
}))

// Router
app.use('/user', require('./routers/userRouter'))
app.use('/api', require('./routers/upload'))

// connect to MongoDB
const URI = process.env.MONGODB_URL
mongoose.connect(URI, {
    useCreateIndex: true,
    useFindAndModify: false,
    useNewUrlParser: true,
    useUnifiedTopology: true
}, err => {
    if(err) throw err;
    console.log("Connected to mongodb")
})

if(process.env.NODE_ENV === 'production'){
    app.use(express.static('client/build'))
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'))
    })
}

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
    console.log('Server is running on port', PORT)
})
