const Users = require('../models/userModel')
const bcrypt = require('bcrypt') // Bcrypt uses the Blowfish cypher
const jwt = require('jsonwebtoken')
const sendMail = require('./sendMail')

const {google} = require('googleapis')
const {OAuth2} = google.auth
const fetch = require('node-fetch')

const {CLIENT_URL} = process.env

const client = new OAuth2(process.env.MAILING_SERVICE_CLIENT_ID)

const userCtrl = {
    register: async (req, res) => {
        try {
            const {name, email, password} = req.body
            
            if(!name || !email || !password)
                return res.status(400).json({msg: "Please fill in all fields."})

            if(!validateEmail(email))
                return res.status(400).json({msg: "Invalid Email."})

            const user = await Users.findOne({email})
            if(user) return res.status(400).json({msg: "This email already exists."})

            if(password.length < 6)
                return res.status(400).json({msg: "Password should be at least 6 characters long."})

            const passwordHash = await bcrypt.hash(password, 12)
            
            const newUser = {
                name, email, password: passwordHash
            }

            const activation_token = createActivationToken(newUser)

            const url = `${CLIENT_URL}/user/activate/${activation_token}`
            
            sendMail(email, url, "Verify your email")

            res.json({msg: "Register Success! Please check your email to get start"})
            
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    activeEmail: async (req, res) => {
        try {
            const {activation_token} = req.body
            const user = jwt.verify(activation_token, process.env.ACTIVATION_TOKEN_SECRET)

            const {name, email, password} = user

            const check = await Users.findOne({email})
            if(check) return res.status(400).json({msg: "This email already exists."})

            const newUser = new Users({
                name, email, password
            })

            await newUser.save()
            res.json({msg: "Account has been activated!"})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    login: async (req, res) => {
        try {
            const {email, password} = req.body
            

            if(!email) return res.status(400).json({msg: "Please fill in the email!"})

            const user = await Users.findOne({email})
            if(!user) return res.status(400).json({msg: "Not registerd as a user!"})

            if(email){
                if(!password) return res.status(400).json({msg: "Please fill in the password!"})
            }

            const isMatch = await bcrypt.compare(password, user.password)
            if(!isMatch) return res.status(400).json({msg: "Incorrect Password!"})

            const refresh_token = createRefreshToken({id: user._id})
            res.cookie('refreshtoken', refresh_token, {
                httpOnly: true,
                path: '/user/refresh_token',
                maxAge: 7*24*60*60*1000 // 7 days
            })

            res.json({msg: "Login Success!"})
        } catch (error) {
            return res.status(500).json({msg: err.message})
        }
    },
    getAccessToken: (req, res) => {
        try {
            const rf_token = req.cookies.refreshtoken
            if(!rf_token) return res.status(400).json({msg: "Expired, Please Login Again!"})

            jwt.verify(rf_token, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
                if(err) return res.status(400).json({msg: "Please Login!"})

                const access_token = createAccessToken({id: user.id})
                res.json({access_token})
            })
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    forgetPassword: async (req, res) => {
        try {
            const {email} = req.body
            const user = await Users.findOne({email})
            if(!user) return res.status(400).json({msg: "This email is not registerd!"})

            const access_token = createAccessToken({id: user._id})
            const url = `${CLIENT_URL}/user/reset/${access_token}`

            sendMail(email, url, "Reset Password")
            res.json({msg: "Please check entered email & Reset your password"})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    resetPassword: async (req, res) => {
        try {
            const {password} = req.body
            const passwordHash = await bcrypt.hash(password, 12)

            await Users.findOneAndUpdate({_id: req.user.id}, {
                password: passwordHash                                                  
            })

            res.json({msg: "Password Changed!"})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    getUserInfor: async (req, res) => {
        try {
            const user = await Users.findById(req.user.id).select('-password')

            res.json({user})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    getUsersAllInfor: async (req, res) => {
        try {
            const users = await Users.find().select('-password')

            res.json(users)
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    logout: async (req, res) => {
        try {
            res.clearCookie('refreshtoken', {path: '/user/refresh_token'})
            return res.json({msg: "Logged out."})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    updateUser: async (req, res) => {
        try {
            const {name,avatar} = req.body
            await Users.findOneAndUpdate({_id: req.user.id}, {
                name, avatar
            })

            res.json({msg: "Update Success!"})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    updateUsersRole: async (req, res) => {
        try {
            const {role} = req.body
            await Users.findOneAndUpdate({_id: req.params.id}, {
                role
            })
            res.json({msg: "Update Success!"})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    deleteUser: async (req, res) => {
        try {
            await Users.findByIdAndDelete({_id: req.params.id})

            res.json({msg: "Successfully Deleted!"})
        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    googleLogin: async (req, res) => {
        try {
            const {tokenId} = req.body
            const verify = await client.verifyIdToken({idToken: tokenId, audience: process.env.MAILING_SERVICE_CLIENT_ID})
            console.log(verify)
            
            const {email_verified, email, name, picture} = verify.payload

            const password = email + process.env.GOOGLE_SECRET

            const passwordHash = await bcrypt.hash(password, 12)

            if(!email_verified) return res.status(500).json({msg: "Email verification failed."})

            if(email_verified){
                const user = await Users.findOne({email})
                if(user){
                    const isMatch = await bcrypt.compare(password, user.password)
                    if(!isMatch) return res.status(400).json({msg: "Incorrect Password"})

                    const refresh_token = createRefreshToken({id: user._id})
                    res.cookie('refreshtoken', refresh_token, {
                        httpOnly: true,
                        path: '/user/refresh_token',
                        maxAge: 7*24*60*60*1000 // 7 days
                    })

                    res.json({msg: "Login Success!"})
                }else{
                    const newUser = new Users({
                        name, email, password: passwordHash, avatar: picture
                    })
                    await newUser.save()
                    
                    const refresh_token = createRefreshToken({id: newUser._id})
                    res.cookie('refreshtoken', refresh_token, {
                        httpOnly: true,
                        path: '/user/refresh_token',
                        maxAge: 7*24*60*60*1000 // 7 days
                    })
    
                    res.json({msg: "Login Success!"})
                }
            }

        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    },
    facebookLogin: async (req, res) => {
        try {
            const {accessToken, userID} = req.body

            const URL = `https://graph.facebook.com/v2.9/${userID}/?fields=id,name,email,picture&access_token=${accessToken}`

            const data = await fetch(URL).then(res => res.json()).then(res => {return res})
            
            const {email, name, picture} = data
            
            const password = email + process.env.FACEBOOK_SECRET

            const passwordHash = await bcrypt.hash(password, 12)

            const user = await Users.findOne({email})

            if(user){
                const isMatch = await bcrypt.compare(password, user.password)
                if(!isMatch) return res.status(400).json({msg: "Password is incorrect."})

                const refresh_token = createRefreshToken({id: user._id})
                res.cookie('refreshtoken', refresh_token, {
                    httpOnly: true,
                    path: '/user/refresh_token',
                    maxAge: 7*24*60*60*1000 // 7 days
                })

                res.json({msg: "Login success!"})
            }else{
                const newUser = new Users({
                    name, email, password: passwordHash, avatar: picture.data.url
                })

                await newUser.save()
                
                const refresh_token = createRefreshToken({id: newUser._id})
                res.cookie('refreshtoken', refresh_token, {
                    httpOnly: true,
                    path: '/user/refresh_token',
                    maxAge: 7*24*60*60*1000 // 7 days
                })

                res.json({msg: "Login success!"})
            }


        } catch (err) {
            return res.status(500).json({msg: err.message})
        }
    }
}

function validateEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

const createActivationToken = (payload) => {
    return jwt.sign(payload, process.env.ACTIVATION_TOKEN_SECRET, {expiresIn: '5m'})
}

const createAccessToken = (payload) => {
    return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '15m'})
}

const createRefreshToken = (payload) => {
    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {expiresIn: '7d'})
}


module.exports = userCtrl

