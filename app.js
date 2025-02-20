const path = require('node:path');
const express = require('express');
const session = require('express-session');

const app = express();

// config

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// middleware

app.use(express.static(path.join(__dirname, 'public')));

// start

app.listen(process.env.PORT, () => {
  console.log(`Listening to port ${process.env.PORT}.`);
});