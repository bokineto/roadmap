const fs = require("fs")
const http = require("http")
const express = require("express")
const compression = require("compression")
const bodyParser = require("body-parser")
const fileUpload = require("express-fileupload")
const sharp = require("sharp")
const moment = require("moment")
const passport = require("passport")
const passport_local = require("passport-local")
const connect_ensure_login = require("connect-ensure-login")
const express_session = require("express-session")
const WebSocketServer = require("websocket").server
//const expressip = require('express-ip');
const uuid4 = require("uuid4")
const json2xls = require("json2xls")
const open = require("open")

const Mysql = require('./controller/db')
const sendEmail = require("./controller/email.send")
const templates = require("./controller/email.templates")

const { _MyCoords, _UserNameList, _DefaultLinksList, _FianlList } = require('./controller/global')

const { default: _default } = require("node-xlsx")

/*
npm i express compression body-parser express-fileupload sharp moment passport passport-local connect-ensure-login express-session uuid4 open
*/

var mapConnections = []

const DEFAULT_PATH = process.cwd()

const PORT = process.env.PORT || 3000

const config = {
    webServer: {
        hostname: "127.0.0.1",
        port: PORT,
    },
    users: [
        {
            username: "VeriArtiofficial@gmail.com",
            password: "vechain123",
        },
    ],
}

const webServer = express()

const appRouter = express.Router()

const appServer = http.createServer(webServer)

// Handle MainPart
;(async function main() {
    // Database Management
    await Mysql.init(DEFAULT_PATH)

    passport.use(
        new passport_local.Strategy(function (username, password, done) {
            let user = config.users.filter(function (u) {
                return u.username == username && u.password == password
            })[0]
            if (user != undefined) {
                return done(null, user)
            } else {
                return done(null, null)
            }
        })
    )

    passport.serializeUser(function (user, done) {
        done(null, user)
    })

    passport.deserializeUser(function (user, done) {
        done(null, user)
    })

    appRouter.get("/login", function (request, response) {
        if (request.isAuthenticated()) {
            response.redirect("/")
            return
        }

        var fpath = DEFAULT_PATH + "/template/login.html"

        response.type("text/html; charset=utf-8")

        fs.access(fpath, fs.F_OK, (err) => {
            if (err) {
                console.error(err)
                response.status(404).send("Not found") // HTTP status 404: NotFound
                return
            }
            response.sendFile(fpath)
        })
    })

    appRouter.post(
        "/login",
        passport.authenticate("local", {
            failureRedirect: "/login",
            successReturnToOrRedirect: "/",
        })
    )

    appRouter.post("/mylogin", async function (req, res) {
        let user = await _UserNameList.list.filter(function (u) {
            return u["userName"].toLowerCase() == req.body.userName.toLowerCase()
        })[0]
        if (!user) {
            user = [{'Please enter your node address' : req.body.userName, 'Discount' : 0, 'userType' : 2}]
            await Mysql.saveUserNameList(user)
            user = { 'userName': req.body.userName, 'discount': 100, 'userType': 2 }
        }

        let link = await _DefaultLinksList.list.filter(function (l) {
            return l["userType"] == user['userType']
        })[0]

        if (user)
            res.send({ user: user, link: link, final: _FianlList.list })
        else
            res.send(null)
    })

    appRouter.get("/logout", function (req, res) {
        req.logout()
        res.redirect("/login")
    })

    appRouter.post("/api", (request, response) => {
        const retError = {
            error_code: 80021,
            error_message: "Invalid data received.",
        }

        if (request.body && request.body.mapCoords) {
            response.json({ mapCoords: request.body.mapCoords })

            fs.writeFileSync(
                "./coords.json",
                JSON.stringify(request.body.mapCoords)
            )

            if (request.body.dataURL) {
                var image = request.body.dataURL.split(",")[1]
                var buf = Buffer.from(image, "base64")

                sharp(buf).toFile("./mapcoords.jpg", function (err, info) {
                    if (err) {
                        console.log("mapcoords: ", err)
                    } else {
                        // console.log(info);
                    }
                })
            }

            return
        }

        response.json(retError)
    })

    appRouter.get("/utils.js", async (request, response) => {
        var fpath = DEFAULT_PATH + "/lib/utils.js"

        var uuid = uuid4()

        response.type("text/javascript; charset=utf-8")

        fs.access(fpath, fs.F_OK, (err) => {
            if (err) {
                console.error(err)
                response.status(404).send("Not found") // HTTP status 404: NotFound
                return
            }

            var js = fs.readFileSync(fpath).toString()

            js = js.split("%SESSION%").join(uuid)
            js = js.split("%WSPORT%").join(PORT)

            response.send(js)
        })
    })

    appRouter.get("/coords.json", (request, response) => {
        var fpath = DEFAULT_PATH + "/coords.json"

        response.type("text/html; charset=utf-8")

        fs.access(fpath, fs.F_OK, (err) => {
            if (err) {
                console.error(err)
                response.redirect("/")
                return
            }
            response.sendFile(fpath)
        })
    })

    appRouter.get("/images/:image", (request, response) => {
        var fpath = DEFAULT_PATH + "/html/images/" + request.params.image

        try {
            var image = sharp(fpath)

            image
                .metadata()
                .then(function (metadata) {
                    response.type("image/" + metadata.format)

                    fs.access(fpath, fs.F_OK, (err) => {
                        if (err) {
                            console.error(err)
                            response.sendFile(
                                DEFAULT_PATH + "/tempimage/default.jpg"
                            )
                            return
                        }
                        response.sendFile(fpath)
                    })
                })
                .catch(function (err) {
                    console.log(err)
                    response.status(404).send("Not found") // HTTP status 404: NotFound
                })
        } catch (err) {
            console.log(err)
            response.status(404).send("Not found") // HTTP status 404: NotFound
            return
        }
    })

    appRouter.get("/assets/images/:image", (request, response) => {
        var fpath = DEFAULT_PATH + "/html/images/" + request.params.image

        try {
            var image = sharp(fpath)

            image
                .metadata()
                .then(function (metadata) {
                    response.type("image/" + metadata.format)

                    fs.access(fpath, fs.F_OK, (err) => {
                        if (err) {
                            console.error(err)
                            response.sendFile(
                                DEFAULT_PATH + "/tempimage/default.jpg"
                            )
                            return
                        }
                        response.sendFile(fpath)
                    })
                })
                .catch(function (err) {
                    console.log(err)
                    response.status(404).send("Not found") // HTTP status 404: NotFound
                })
        } catch (err) {
            console.log(err)
            response.status(404).send("Not found") // HTTP status 404: NotFound
            return
        }
    })

    appRouter.get("/assets/css/:file", (request, response) => {
        var fpath = DEFAULT_PATH + "/html/assets/css/" + request.params.file

        response.type("text/css")

        fs.access(fpath, fs.F_OK, (err) => {
            if (err) {
                console.error(err)
                response.status(404).send("Not found") // HTTP status 404: NotFound
                return
            }
            response.sendFile(fpath)
        })
    })

    appRouter.get("/assets/js/:file", (request, response) => {
        var fpath = DEFAULT_PATH + "/html/assets/js/" + request.params.file

        response.type("text/javascript; charset=utf-8")

        fs.access(fpath, fs.F_OK, (err) => {
            if (err) {
                console.error(err)
                response.status(404).send("Not found") // HTTP status 404: NotFound
                return
            }
            response.sendFile(fpath)
        })
    })

    appRouter.get("/", (request, response) => {
        var fpath = DEFAULT_PATH + "/template/login.html"

        response.type("text/html; charset=utf-8")

        fs.access(fpath, fs.F_OK, (err) => {
            if (err) {
                console.error(err)
                response.status(404).send("Not found") // HTTP status 404: NotFound
                return
            }
            response.sendFile(fpath)
        })
    })

    appRouter.get("/admin", (request, response) => {
        var fpath = DEFAULT_PATH + "/template/admin.html"

        response.type("text/html; charset=utf-8")

        fs.access(fpath, fs.F_OK, (err) => {
            if (err) {
                console.error(err)
                response.status(404).send("Not found") // HTTP status 404: NotFound
                return
            }
            response.sendFile(fpath)
        })
    })

    appRouter.get("/*", (request, response) => {
        var fpath = DEFAULT_PATH + "/html" + request.url

        response.type("text/html; charset=utf-8")

        fs.access(fpath, fs.F_OK, (err) => {
            if (err) {
                console.error(err)
                response.redirect("/")
                return
            }
            response.sendFile(fpath)
        })
    })

    webServer.use(
        bodyParser.json({
            parameterLimit: 100000,
            limit: "250mb",
            extended: true,
        })
    )

    webServer.use(
        bodyParser.urlencoded({
            parameterLimit: 100000,
            limit: "250mb",
            extended: true,
        })
    )

    webServer.use(
        fileUpload({
            createParentPath: true,
        })
    )

    webServer.use(
        express_session({
            secret: "secret here",
            resave: false,
            saveUninitialized: false,
        })
    )

    webServer.use(compression())

    webServer.use((req, res, next) => {
        res.append("Access-Control-Allow-Origin", ["*"])
        res.append("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE")
        res.append("Access-Control-Allow-Headers", "Content-Type")
        next()
    })

    webServer.use(passport.initialize())
    webServer.use(passport.session())

    webServer.use("/", appRouter)

    appServer.listen(config.webServer.port, () => {
        console.log(
            `webServer listening on ${config.webServer.hostname}:${config.webServer.port}.`
        )
    })

    // sockServer.listen(config.webServer.websocket, () => {
    //     console.log(
    //         `WebSocketServer is listening on port ${config.webServer.websocket}.`
    //     )
    // })
    wsServer = new WebSocketServer({ httpServer: appServer })

    if (process.env.NODE_ENV !== "production") {
        await open(
            "http://" + config.webServer.hostname + ":" + config.webServer.port
        )
    }

    wsServer.on("request", function (request) {
        var connection = request.accept(null, request.origin)

        var myConId = uuid4()

        console.log("Connection opened.")

        mapConnections[myConId] = connection

        connection.on("message", async function (message) {
            var self = this

            if (message.type === "utf8") {
                var data = message.utf8Data
                var obj = JSON.parse(data)
                var transEmail

                // Check the gmail account
                if (obj.hasOwnProperty("mail")) {
                    Mysql.saveCoords(obj)
                    transEmail = await sendEmail(
                        "VeriArtiofficial@gmail.com",
                        templates.confirm(obj)
                    )
                }

                // Insert the coords user select
                if (obj.hasOwnProperty("id")) {
                    var coordsFound = false
                    if (_MyCoords.hasOwnProperty('coord')) {
                        coordsFound = _MyCoords.coord.some(
                            (el) => el.index === obj.index
                        )
                    }
                    if (!coordsFound) {
                        _MyCoords.coord.push({ index: obj.index, coords: obj.coords, userName: obj.userName });
                    }
                }

                setTimeout(() => {
                    for (var x in mapConnections) {
                        mapConnections[x].sendUTF(
                            JSON.stringify({
                                id: obj.id,
                                selected: true,
                                index: obj.index,
                                coords: obj.coords,
                                timestamp: moment().format("x"),
                                myCoords: _MyCoords.coord,
                                transEmail: transEmail,
                            })
                        )
                    }
                }, 100);
            }
        })

        connection.on("close", function (connection) {
            var self = this

            console.log("Connection closed.")

            Mysql.migration()

            delete mapConnections[myConId]
        })
    })

    function writeCoordsToExcel(coords) {
        const filename = DEFAULT_PATH + "/docs/coords.xlsx";

        var xls = json2xls(coords)

        fs.writeFileSync(filename, xls, "binary", (err) => {
            if (err) {
                console.log("writeFileSync :", err)
            }
        })
    }
})()
