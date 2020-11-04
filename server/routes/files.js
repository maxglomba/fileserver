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
var ip = require('ip');
const fetch = require('node-fetch');



// const Usuario = require('../models/usuario');
const app = express();



app.get('/files/:id', function (req, res) {
    res.json({endpoint: 'get files'});
});

app.post('/files', async function (req, res) {

    if(process.env.PORT === '7070'){
       
       
        let body = req.body;
       
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

        if(fs.existsSync(template)){
            htmlstr = await fs.readFileSync(template, 'utf-8');

        
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

                
                // Creo el .pdf
                let createdPdf = await htmlToPdf(document, options);
                
                //await fs.writeFileSync(docPath, htmlstr,{encoding:'binary'});
            }
        }
        let filesCreated = await fs.readdirSync(docsFolder);
        if(filesCreated.length === 1){
            objRes = {
                status:"OK",
                name: filesCreated[0],
                path:  docsFolder + '/' + filesCreated[0],
                type: 'application/pdf'
            };
        }else if(filesCreated.length > 1){
            let ZipFolderName = 'zip-' + Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5);
            let pathZipFile = path.resolve(__dirname, downloadFolder + "/" + ZipFolderName);
            await fs.mkdirSync(pathZipFile);
            //creo el zip y lo retorno para descargar
            const createdZipFile = await createZipFile(pathZipFile + '/Documentos-Generados.zip', docsFolder);
            
            objRes = {
                status:"OK",
                name: 'Documentos-Generados.zip',
                path: pathZipFile + '/Documentos-Generados.zip',
                type: 'application/zip'
            };
        }else{
            return res.status(400).json({ok:'false', error:"No se genero ningun documento"});
        }

    
        let stat = await fs.statSync(objRes.path);
        const options = {
            headers: {
            'Content-Description': 'File Transfer',
            'Content-Type': objRes.type,
            'Content-type': 'application/octet-stream',
            'Content-Type': 'application/force-download',
            'Content-Disposition': 'attachment; filename=' + objRes.name + '; charset=utf-8',
            'Content-Length': stat.size,
            'X-Content-NameFile':  objRes.name,
            'Access-Control-Allow-Headers': 'X-Content-NameFile',
            'Access-Control-Expose-Headers': 'X-Content-NameFile'
            }
        };
    return res.json({path:objRes.path, name:objRes.name, options});
    }else{
        // res.json({url: "http://" + ip.address() + ":7070/files", body: req.body});
       let respuesta = await postData("http://" + ip.address() + ":7070/files", req.body);
       return res.download(respuesta.path, respuesta.name, respuesta.options);
    }
    
});





app.put('/files/:id', function (req, res) {
     res.json({endpoint: 'put files'});
});
  
app.delete('/files/:id', function (req, res) {
    res.json({endpoint: 'delete files'});
});

// Funcion auxiliar basada en promesas para generar el zip de certificados a descargar
function createZipFile(destinoRar, rutaCertificados){
	return new Promise( (resolve, reject) => { 
		// SI ya existe el archivo, lo borro 
        if( fs.existsSync(path.resolve(__dirname, destinoRar)) ){
            fs.unlinkSync(path.resolve(__dirname, destinoRar));
        }
		var output = fs.createWriteStream( path.resolve(__dirname, destinoRar) );
	
		let archive = archiver('zip', {
			zlib: {level: 9} // Nivel de compresion
		});
		
		// Eventos de archiver
		output.on('close', function() {
			resolve(0);
		});
		archive.on('warning', function(err) {
			reject(err);
		});
		archive.on('error', function(err) {
			reject(err);
		});
	 
		// pipe archive data to the file
		archive.pipe(output);
		
		// agrego los certificados al zip

		archive.directory( path.resolve(__dirname, rutaCertificados) , false);
		
		
		archive.finalize();
	});
}

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


// Funcion para crear PDF
const htmlToPdf = async(document, options) => {
	return new Promise( (resolve, reject) => {
		let fileName; 
		// let optionsPuppeter = {
		// 	path: document.fullPath,
		// 	width: options.width,
		// 	height: options.height,
		// 	margin: options.border
		// }
		// try{
		// 	await convertHTMLToPDF(document.html, (err, res)=>{
		// 	return ({
		// 		'status': 'OK',
		// 		'ruta': (document.fullPath ? document.fullPath : fileName),
		// 		'name': document.name
		// 	});

		// 	}, optionsPuppeter);

		// }catch(error){
		// 	console.error(error);
		//  	return ({
		// 		'status': 'ERROR',
		// 		error
		// 	});
		// }
		
		//Convierto los caracteres especiales del documento a entidades HTML
		let result = pdf.create(document, options)
			.then( res => {
				fileName = res.filename;
				
				return resolve({
					'status': 'OK',
					'ruta': (document.fullPath ? document.fullPath : fileName),
					'name': document.name
				});
			})
			.catch(error => {
				console.error(error);
				return reject(error);
			});
	});
}


// Ejemplo implementando el metodo POST:
async function postData(url = '', data = {}) {
    // Opciones por defecto estan marcadas con un *
    const response = await fetch(url, {
      method: 'POST', // *GET, POST, PUT, DELETE, etc.
      mode: 'cors', // no-cors, *cors, same-origin
      cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
      credentials: 'same-origin', // include, *same-origin, omit
      headers: {
        'Content-Type': 'application/json'
        // 'Content-Type': 'application/x-www-form-urlencoded',
      },
      redirect: 'follow', // manual, *follow, error
      referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      body: JSON.stringify(data) // body data type must match "Content-Type" header
    }).then(resp => resp.json())
    .catch(err => {error: err});

    return response; // parses JSON response into native JavaScript objects
  }

module.exports = app; 