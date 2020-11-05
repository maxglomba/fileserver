const express = require('express');

const bcrypt = require('bcrypt');
const _ = require('underscore');
const fs = require('fs');
const fsextra = require('fs-extra')
const path = require('path');
const archiver = require('archiver');	//libreria para zips
const { rest, identity } = require('underscore');
const convertHTMLToPDF = require("pdf-puppeteer");
const pdf = require('pdf-creator-node');
const ip = require('ip');
const fetch = require('node-fetch');
const colors = require('colors');
const fork = require('child_process').fork;



// const Usuario = require('../models/usuario');
const app = express();
app.get('/files', function (req, res) {
    setTimeout( ()=>{
        res.json({endpoint: 'get files'});
    },3000);
   
});
app.post('/files', async function (req, res) {
        req.setTimeout(9999999);
        let body = req.body;
        let downloadedZip = false;
        let cantidad = Number(body.cantidad);
        let template;
        switch (body.template) {
            case 'REC':
                template = path.resolve( __dirname, '../private/templates/' + 'Recibos_MODELO.html');
                break;
            case 'CERT':
                template = path.resolve( __dirname, '../private/templates/' + 'Certificado de renta y cargo.html');
                break;
            default:
                template = path.resolve( __dirname, '../private/templates/' + 'Certificado de renta y cargo.html');
                break;
        }

        let htmlstr;
        let docsFolder = path.resolve( __dirname, '../../temp/documents/');
        fsextra.emptyDirSync(docsFolder);
        let downloadFolder = path.resolve( __dirname, '../../temp/download/');
        fsextra.emptyDirSync(downloadFolder);
        let objRes = {};
        // Inicializo variable para saber la cantidad de variables del archivo 
        let cantVar = 0;
        // Array con todas las variables que va a tener el archivo 
        let variables = [];
        let filesToDownload = [];
        if(fs.existsSync(template)){
            htmlstr = await fs.readFileSync(template, 'utf-8');

            let worker = fork('./server/pdfWorker.js');
            //genero todos los html
            for (let i = 0; i < cantidad; i++) {
                let docPath = path.resolve(docsFolder + '/doc-' + i + '.pdf');


                let htmlOldStrLength = 0;
                let cnt = 0;
                while (htmlstr.length !== htmlOldStrLength) {
                    cnt++;
                    
                    // La longitud del string HTML difiere de la longitud del string HTML del ultimo reemplazo.
                    // Quiere decir que debo seguir buscando &lt; y &gt; para reemplazar
                    //
                    // Compruebo con el if si no se encontro un &lt; Si no se encontro, quiere decir o bien que el HTML no tiene variables de reemplazo,
                    // o que si las tiene pero ya las limpiamos todas de HTML en medio
                    if (htmlstr.indexOf('&lt;') === -1) {
                            // Si es asi ya termino la limpieza del HTML. salgo del while
                        break;
                    }
                    // Guardo la longitud del string HTML a como esta ahora
                    htmlOldStrLength = htmlstr.length;
                    // En lugar de usar una regex con .match usamos el metodo substring e indexof de JS para obtener el texto entre los < y >
                    let indexOpeningVariable = htmlstr.indexOf('&lt;');
                    
                    let mySubString = htmlstr.substring(
                        indexOpeningVariable, 
                        indexOpeningVariable + htmlstr.substring(indexOpeningVariable).indexOf('&gt;') + 4	// Por que le sumo 4? Porque el objetivo es obtener la variable junto con los < y >
                    );
                
                    // Regex para limpiar los tags HTML que quedaron en el medio
                    let mySubString2 = mySubString.replace(/<\/?[^>]+(>|$)/g, '');
                    mySubString2 = mySubString2.trim();
                    
                    // Esta parte es la mas importante: Reemplazo los < y > del principio y el final por ##A## y ##C##
                    mySubString2 = '##A##' + mySubString2.substring(4).slice(0, -4) + '##C##';
                    // Compruebo si en el string intermedio quedaron simbolos &lt; Si es asi, los reemplazo por <
                    mySubString2 = mySubString2.replace(/&lt;/g, '<');
                    
                    // Guardo en "variables" el string resultante (en caso de existir)
                    if (mySubString2.trim()) {
                        variables.push(mySubString2.substring(5).slice(0, -5));
                    }
                    
                    // Reemplazo en el mismo string HTML la variable encontrada por la nueva variable,
                    // ya filtrada de tags molestos HTML en medio, y reemplazado los < y > por por ##A## y ##C##
                    htmlstr = htmlstr.replace(mySubString, mySubString2);
                    
                    cantVar++;

                }
                // Lo primero que tenemos que hacer es revisar todos los EV() que tenga el documento y reemplazarlos 
                // para poder tener esas variables disponibles 
                for (let k = 0; k < cantVar; k++){
                    if (variables[k].indexOf('EV(') >= 0){
                        let datosDeVariable = await obtenerVariableEV(variables[k], userDb, userCode, variablesReporte, client, userLevel);
                        
                        // Agrego la nueva variable al reporte!
                        variablesReporte[datosDeVariable.name] = datosDeVariable.data;

                        // Reemplazamos la variable o funcion por el valor correspondiente 
                        htmlstr = htmlstr.replace("##A##" + variables[k] + "##C##", ' ');
                    }
                }
                
                // Ahora que tenemos todas las variables, podemos ir reemplazando en el archivo 
                for (let j = 0; j < cantVar; j++){
                    // Por default (es decir si no existe va vacio )
                    let result = '';

                    if (variables[j].indexOf('(') >= 0){
                        try {
                            result = await obtenerValorFuncion(variables[j]);
                        } catch (e) {
                            console.error(e);
                            console.error(variables[j]);
                        }
                    } 

                    // Reemplazamos la variable o funcion por el valor correspondiente 
                    htmlstr = htmlstr.replace("##A##" + variables[j] + "##C##", result);
                }


                // Documento donde se va a guardar 
                let document = {
                    html: htmlstr,
                    data: {},
                    path: docPath,
                    fullPath: docPath
                };
                let pageHeight = '29.7cm';
                let pageWidth = '21cm';
                let pageBorders = {
                    top: '25mm',
                    right: '30mm',
                    bottom: '25mm',
                    left: '30mm'
                };
                // Opciones para el documento PDF
                const options = {
                    height: pageHeight,
                    width: pageWidth,
                    border: pageBorders
                };


                
                worker.on('message', async({}) => {
                    let filesCreated = await fs.readdirSync(docsFolder);
                    //chequeo si ya se crearon todos los archivos, sino vuelvo a llamar al worker sin data, asi envia los docs de cola a proceso, hasta que llegue a ser el mismo numero de docs que los solicitados
                    if(filesCreated.length < Number(cantidad)){
                        worker.send({});
                    }
                    //si ya llegue a la cantidad, voy a llamar al worker que va a crear el zip
                    if(filesCreated.length === Number(cantidad)){
                       
                        if(filesCreated.length === 1){
                            objRes = {
                                status:"OK",
                                name: filesCreated[0],
                                path:  docsFolder + '/' + filesCreated[0],
                                type: 'application/pdf'
                            };
                            let stat = fs.statSync(objRes.path);
                            let options = {
                                headers: {
                                'Content-Description': 'File Transfer',
                                'Content-Type': 'application/pdf',
                                'Content-type': 'application/octet-stream',
                                'Content-Type': 'application/force-download',
                                'Content-Disposition': 'attachment; filename=' + objRes.name + '; charset=utf-8',
                                'Content-Length': stat.size,
                                'X-Content-NameFile':  objRes.name,
                                'Access-Control-Allow-Headers': 'X-Content-NameFile',
                                'Access-Control-Expose-Headers': 'X-Content-NameFile'
                                }
                              };
                            return res.download(objRes.path, objRes.name, options)

                        }else if(filesCreated.length > 1){
                            
                            let ZipFolderName = 'zip-' + Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5);
                            let pathZipFile = path.resolve(__dirname, downloadFolder + "/" + ZipFolderName);
                            await fs.mkdirSync(pathZipFile);
                            //creo el zip y lo retorno para descargar
                            
                            let worker2 = fork('./server/zipWorker.js');
                           
                            worker2.on('message', ({ file }) => {
                                worker2.kill();
                                worker.kill();
                                console.log(colors.bgGreen("          === DESCARGANDO ZIP ===          ").black);
                                return res.download(file.path, file.name, file.options)
                            });
                            if(!downloadedZip){
                                 worker2.send({pathZipFile, nameFile:'Documentos-Generados.zip' , docsFolder});
                                 downloadedZip = true;
                            }
                           
                        }                       
                    }
                  
                });
               
                worker.send({document: document, options: options});

            }  
        }
});




const obtenerValorFuncion = (valorFuncion) =>{

    // Saco el cierre de ')' 
    let partes = valorFuncion.slice(0, -1);
    
    // separo el nombre de la funcion del sector de parametros
	let partes2 = [];
    partes2 = partes.split('(');
    
    let nombreFuncion = partes2[0];

    // Obtengo los parametros 
	let parametros = [];
	parametros = partes2[1].split(',');

    let resp = "aca reemplace la funcion " + nombreFuncion;
    resp = resp.toUpperCase();
    return resp;    

}



module.exports = app; 