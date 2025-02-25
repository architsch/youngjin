const path = require('node:path');
const express = require('express');
require('dotenv').config();

const app = express();

// config

app.engine('.html', require('ejs').__express);
app.set('views', path.join(process.env.PWD, 'views'));
app.set('view engine', 'html');

// middleware

app.use(express.static(path.join(process.env.PWD, process.env.STATIC_PAGE_ROOT_DIR)));

// routes

app.get('/server/test', (req, res) => {
    res.render('test');
});

// start

app.listen(process.env.PORT, () => {
    console.log(`Listening to port ${process.env.PORT}.`);
});