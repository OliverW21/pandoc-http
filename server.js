const http = require('http');
const https = require('https');
const fs = require('fs-promise');
const mediaTypeConverter = require('./mediatype-converter');
const rawBody = require('raw-body');
const lignator = require('lignator');
const Stream = require('stream').Transform;

const spawn = require('child_process').spawn;

const pandocPath = process.env.PANDOC || 'pandoc';
const pdflatexPath = process.env.PDFLATEX || 'pdflatex';

const port = 80;

/**
 * Uses the pandoc command-line tool to convert the input file into the desired output format.
 *
 * @param {String} inputFile Path to the input File
 * @param {String} outputFile Path to the output file
 * @param {String} from Type of the input file
 * @param {String} to Desired type of the output file
 * @param {String} filters in valid JSON
 * @return {Promise} Resolves if conversion is successful, otherwise it reject with a corresponding error message.
 */
function pandoc(inputFile, outputFile, from, to, filters) {
    let args = []
    if(filters){
        filters = JSON.parse(filters);
        for(let filter of filters){
            args.push('--filter');
            args.push('./filters/' + filter + '.py');
        }
    }

    return new Promise((resolve, reject) => {
        args = args.concat(['-f', from, '-t', to, '-o', 'output/' + outputFile, inputFile]);
        console.log('Starting Pandoc with these Args: ');
        console.log(args);
        let pandoc = spawn(pandocPath, args);

        let error = '';
        pandoc.on('error', (err) => reject(err));

        pandoc.stderr.on('data', (data) => error += data);

        pandoc.on('close', (code) => {
            if (code !== 0) {
                let msg = 'Pandoc finished with exit code ' + code;
                if (error) {
                    msg += ':' + error;
                }
                reject(msg);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Start PdfLatex directly and generate a Pdf
 *
 * @param inputFile Inputfile name
 * @param outputFile Outputfile name
 * @returns {Promise}
 */
function pdflatex (inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        let args = ['-synctex=1','-interaction=nonstopmode','-output-directory=output','-jobname', outputFile.slice(0, -4), inputFile];
        console.log('Starting PDFLateX with these Args: ');
        console.log(args);
        let pdflatex = spawn(pdflatexPath, args);

        pdflatex.on('error', (err) => reject(err));

        pdflatex.stdout.on('data', function(data) {
            if(data.toString().includes('Error')){
                console.log(data.toString());
            }
        });

        pdflatex.on('close', (code) => {
            let msg = "PDFLateX close with code: " + code;
            fs.access(__dirname + '/output/' + outputFile, fs.F_OK, (e) => {
                if (e) {
                    console.log(msg + ' : ' + e);
                    reject('PDFLateX failed to create a file. Please check your input for invalid LateX!');
                } else {
                    resolve();
                }
            })
        });
    });
}

/**
 * Manages methods of converting the files.
 * Default is using Pandoc, LateX to PDF will use PDFLateX directly.
 * If we use PDFLateX directly we have to call it twice to enable a ToC.
 *
 * @param inputFile Inputfile Name
 * @param outputFile Outputfile Name
 * @param inputType
 * @param pandocOutputType
 * @param filters
 * @returns {Promise}
 */
function convert (inputFile, outputFile, inputType, pandocOutputType, filters) {
    if(inputType === 'latex' && pandocOutputType === 'pdf'){
        console.log('Using PdfLateX to convert Latex to PDF directly.');
        return new Promise((resolve, reject) => {
            pdflatex(inputFile, outputFile)
              .then(() => pdflatex(inputFile, outputFile))
              .then(() => resolve())
              .catch((err) => reject(err));
        });
    }else{
        return pandoc(inputFile, outputFile, inputType, pandocOutputType, filters);
    }
}

/**
 * Downloads a single Asset
 *
 * @param url Url to an Image
 * @param dest Path where it will be saved
 * @returns {Promise}
 */
function download (url, dest) {
    console.log('Downloading Asset from: ' + url + ' to ' + dest);

    let link = new URL(url);
    let client = (link.protocol.includes('https')) ? https : http;

    return new Promise((resolve, reject) => {
        client.request(url, function(response) {
            let data = new Stream();

            response.on('error', function () {
                reject();
            });

            response.on('data', function(chunk) {
                data.push(chunk);
            });

            response.on('end', function() {
                fs.writeFileSync(dest, data.read());
                resolve();
            });
        }).end();
    });
}

/**
 * Downloads all needed Assets to /assets/
 *
 * @param assetUrls Array of Objects that contain urls and names
 * @returns {Promise}
 */
function downloadAssets(assetUrls){
    return new Promise((resolve,reject) => {
        let requests = [];
        if(assetUrls){
            assetUrls = JSON.parse(assetUrls);
            for(let asset of assetUrls){
                requests.push(download(asset.url, './assets/' + asset.name));
            }
        }
        Promise.all(requests)
          .catch((err) => {
              console.log(err);
              reject('Download of one or more assets failed!');
          })
          .then(() => {
              resolve();
          });
    })
}

/**
 * Removes all files for the current request
 *
 * @param outputFile
 * @param inputFile
 * @returns Promise
 */
function removeRequestFiles (outputFile, inputFile) {
    // return new Promise((resolve, reject) => {
    //     let operations = []
    //
    //     operations.push(fs.unlink(inputFile))
    //
    //     const path = __dirname + '/output/'
    //     let regex = new RegExp(outputFile.slice(0, -4) + "\..*")
    //     fs.readdirSync(path)
    //       .filter(f => regex.test(f))
    //       .map(f => operations.push(fs.unlink(path + f)))
    //
    //     Promise.all(operations)
    //       .catch((err) => {
    //           console.log(err);
    //           reject('Something went wrong, could not remove all files.');
    //       })
    //       .then(() => {
    //           lignator.remove('assets', false);
    //
    //           resolve();
    //       });
    // })
}


/**
 * Handles incoming HTTP request. Only POST requests are accepted and the header fields accept and content-type must be
 * set. Otherwise the error code 400 is returned.
 *
 * For proper request, the request body is converted into the accepted output format.
 *
 * @param {Object} req HTTP request
 * @param {Object} res HTTP response
 */
function handleRequest(req, res) {
    console.log('Request received at [' + Date.toLocaleString() + ']')
    if (req.method !== 'POST' || !req.headers['content-type'] || !req.headers['accept']) {
        res.statusCode = 400;
        res.statusMessage = 'Bad Request';
        res.end('Only POST is supported');
    } else {
        let assetUrls = req.headers['asset-collection'];
        let filters = req.headers['filters'];
        let inputType = mediaTypeConverter(req.headers['content-type']);
        let outputMediaType = req.headers['accept'];
        let pandocOutputType = mediaTypeConverter(req.headers['accept']);
        console.log('Pandoc input type: ', inputType);
        console.log('Pandoc output type: ', pandocOutputType);

        let inputFile = 'in' + Date.now();
        let outputFile = 'out' + Date.now();

        // Pandoc only supports pdf via latex
        if (pandocOutputType === 'pdf') {
            outputFile += '.pdf';
            if(inputType === 'latex'){
                inputFile += '.tex';
            } else {
                pandocOutputType = 'latex';
            }
        }

        rawBody(req)
            .then((buffer) => fs.writeFile(inputFile, buffer))
            .then(() => downloadAssets(assetUrls))
            .then(() => convert(inputFile, outputFile, inputType, pandocOutputType, filters))
            .then(() => fs.readFile(__dirname + '/output/' + outputFile))
            .then((result) => {
                res.setHeader('Content-Type', outputMediaType);
                res.end(result);
                console.log('Success!');
            })
            .catch((err) => {
                console.error('Error during conversion: ', err);
                res.statusCode = 500;
                res.statusMessage = JSON.stringify('Internal Server Error. ' + err);
                res.end(res.statusMessage);
            })
            .then(() => console.log('Cleaning Up...'))
            .then(() => removeRequestFiles(outputFile, inputFile))
            .then(() => console.log('Ready to handle a new Request.'));
    }
}
let server = http.createServer(handleRequest);

let p = process.env.PORT || port;
server.listen(p, () => console.log('Server listening on port ' + p));
