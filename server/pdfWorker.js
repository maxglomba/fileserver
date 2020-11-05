let cola = [];
let procesando = [];
let limit = 1;
let lastLogMsg;
let openMsg = false;
process.on('message', async ( data ) => {
	const colors = require('colors');
	if(!openMsg){
		console.log(colors.yellow("INICIANDO SERVICIO DE COLA DE DOCUMENTOS..."));
		openMsg = true;
	}

	let document = data.document;
	let options = data.options;
	//si viene con data lo agrego a la cola
	if(document && options){
		let id =  Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 20);
		cola.push({document, options, id});
	}
	//indo de actual de la cola
	let logMsg = 'Proceso cola - Cola:'+ cola.length+ " Procesando: "+ procesando.length;
	if(logMsg !== lastLogMsg){
		console.log(colors.bgGrey('- PROCESO DE COLA - ').bold + colors.yellow(' Cola: ') + cola.length+ colors.yellow(" Procesando: ")+ procesando.length );
		lastLogMsg = logMsg;
	}
	
	//si existen documentos en cola, y estamos menos que el limite de archivos establecidos
	if(procesando.length < limit && cola.length > 0){
		//paso de cola a proceso un documento
		procesando.push(cola[0]);
		cola.splice(0,1);
		//creo el pdf
		let docResolve = await htmlToPdf(procesando[procesando.length-1].document, procesando[procesando.length-1].options, procesando[procesando.length-1].id);
		//cuando resuelva la creacion lo elimino del array de procesos
		if(docResolve){
			procesando = procesando.filter( doc => doc.id !== docResolve);
			if(cola.length === 0 && procesando.length === 0){
				console.log(colors.bgRed('             === COLA VACIA ===            ').bold);
			}
			process.send({});
		}
	
	}
	
 
});

// Funcion para crear PDF
const htmlToPdf = async(document, options, id) => {
	//let pdf = require('pdf-creator-node');
	let convertHTMLToPDF = require("pdf-puppeteer");
	let optionsPuppeter = {
		path: document.fullPath,
		width: options.width,
		height: options.height,
		margin: options.border
	}
	try{
		await convertHTMLToPDF(document.html, (pdf) => { return({res:'done'})}, optionsPuppeter);
		return id;
	}catch(error){
		console.error(error);
		return ({
			'status': 'ERROR',
			error
		});
	}


		
};