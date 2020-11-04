


// ==============================
//           PUERTO
// ==============================
process.env.PORT = process.env.PORT || 3000;


// ==============================
//          ENTORNO
// ==============================
process.env.NODE_ENV = process.env.NODE_ENV || 'dev';

// ==============================
//          BBDD
// ==============================
let urlDB;

if( process.env.NODE_ENV === 'dev'){
    urlDB = 'mongodb://localhost:27017/udemy';
}else{
    urlDB = 'mongodb+srv://klacius:RgKORFHoSUNkcQQ2@cluster0.8fucz.mongodb.net/cafe';
}
process.env.urlDB = urlDB;

