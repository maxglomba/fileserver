process.on('message', async({ pathZipFile, nameFile, docsFolder }) => {
	  let fs = require('fs');
      const createdZipFile = await createZipFile(pathZipFile + "/" + nameFile, docsFolder);
      let stat = fs.statSync(pathZipFile + "/" + nameFile);
			
      let options = {
        headers: {
        'Content-Description': 'File Transfer',
        'Content-Type': 'application/zip',
        'Content-type': 'application/octet-stream',
        'Content-Type': 'application/force-download',
        'Content-Disposition': 'attachment; filename=' + nameFile + '; charset=utf-8',
        'Content-Length': stat.size,
        'X-Content-NameFile':  nameFile,
        'Access-Control-Allow-Headers': 'X-Content-NameFile',
        'Access-Control-Expose-Headers': 'X-Content-NameFile'
        }
      };
      let objRes = {
        status:"OK",
        name: nameFile,
        path: pathZipFile + '/' + nameFile,
        type: 'application/zip',
        options
    };
  process.send({ file: objRes});
});

// Funcion auxiliar basada en promesas para generar el zip de certificados a descargar
function createZipFile(destinoRar, rutaDocs){
	let fs = require('fs');
	let path = require('path');
	let archiver = require('archiver');	//libreria para zips
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

		archive.directory( path.resolve(__dirname, rutaDocs) , false);
		
		
		archive.finalize();
	});
}