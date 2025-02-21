const path = require('node:path');
const express = require('express');
require('dotenv').config();

const app = express();

// config

app.engine('.html', require('ejs').__express);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');

// middleware

app.use(express.static(path.join(__dirname, 'public')));

// routes

app.get('/server/test', (req, res) => {
  res.render('test');
});

// start

app.listen(process.env.PORT, () => {
  console.log(`Listening to port ${process.env.PORT}.`);
});