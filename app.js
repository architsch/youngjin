const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();

// config

app.engine(".html", require("ejs").__express);
app.set("views", path.join(process.env.PWD, "views"));
app.set("view engine", "html");

// middleware

app.use(express.static(path.join(process.env.PWD, process.env.STATIC_PAGE_ROOT_DIR)));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// database

const users = {}; // dummy database

// routes

app.get("/test", async (req, res) => {
    if (users["testuser"] == undefined)
        users["testuser"] = 1;
    else
        users["testuser"]++;

    const num = users["testuser"];
    console.log(`Count = ${num}`);
    res.send(`Hello, World! (${num})`);
});

// start

app.listen(process.env.PORT, () => {
    console.log(`Listening to port ${process.env.PORT}.`);
});