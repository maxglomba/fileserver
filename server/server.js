// config
require ('./config/config.js');

//dependencias

const express = require('express');
const mongoose = require('mongoose');

const app = express();
const bodyParser = require('body-parser');


// middlewares

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}));
//parse application/json
app.use(bodyParser.json());

 //rutas
app.use(require('./routes/usuario'));
app.use(require('./routes/files'));

//conexion a la bbdd
mongoose.connect(process.env.urlDB, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true
}, (err, res) =>{
    if(err) throw err;
    console.log('Base de datos ONLINE');
});
 
app.listen(process.env.PORT, () =>{
    console.log('Escuchando puerto:', process.env.PORT);
});