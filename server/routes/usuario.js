const express = require('express');

const bcrypt = require('bcrypt');
const _ = require('underscore');

const Usuario = require('../models/usuario');
const app = express();



app.get('/usuario/:id', function (req, res) {
    
    let desde = Number(req.query.desde) || 0;
    let hasta = Number(req.query.hasta) || 5;

    Usuario.find({estado: true}, 'nombre email img estado role google')
            .skip(desde)
            .limit(hasta)
            .exec( (err, usuarios) =>{
                if(err){
                    return res.status(400).json({
                        ok:false,
                        err
                    });
                }
                Usuario.countDocuments({estado: true}, (err, conteo) =>{
                    res.json({
                        ok:true,
                        usuarios,
                        cuantos: conteo
                    });
                })
               
            });

});

app.post('/usuario', function (req, res) {
    let body = req.body;
    let usuario = new Usuario({
        nombre: body.nombre,
        email: body.email,
        password: bcrypt.hashSync(body.password, 10),
        role: body.role
    });

    usuario.save((err, usuarioDB) =>{
        if(err){
            return res.status(400).json({
                ok:false,
                err
            });
        }
        res.json({
            ok:true,
            usuario:usuarioDB
        });

    });
   
});

app.put('/usuario/:id', function (req, res) {
    let id = req.params.id;
    let body = _.pick(req.body, ['nombre', 'email', 'img', 'role', 'estado']);
    Usuario.findByIdAndUpdate(id, body, {new:true, runValidators: true}, (err, usuarioDB) =>{
        if(err){
            return res.status(400).json({
                ok:false,
                err
            });
        }
        res.json({
            ok:true,
            usuario:usuarioDB
        });
    });
    // res.json({endpoint: 'put Usuario', body});

});
  
app.delete('/usuario/:id', function (req, res) {
    let id = req.params.id;

    Usuario.findByIdAndUpdate( id, {estado: false}, {new: true}, (err, usuarioBorrado) =>{
        if(err){
            return res.status(400).json({
                ok:false,
                err
            });
        }
        if(!usuarioBorrado){
            return res.status(400).json({
                ok:false,
                err: {
                    message: 'Usuario no encontrado'
                }
            });
        }
        res.json({
            ok:true,
            usuario:usuarioBorrado
        });
    });

});

module.exports = app; 