const http = require('http');
const fs = require('fs-promise');
const mediaTypeConverter = require('./mediatype-converter');
const rawBody = require('raw-body');
const lignator = require('lignator');

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
 * @return {Promise} Resolves if conversion is successful, otherwise it reject with a corresponding error message.
 */
function pandoc(inputFile, outputFile, from, to) {
    return new Promise((resolve, reject) => {
        let args = ['-f', from, '-t', to, '-o', outputFile, inputFile];
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

function pdflatex (inputFile, outputFile) {
    return new Promise((resolve, reject) => {
        let args = ['-interaction=nonstopmode','-jobname', outputFile.slice(0, -4), inputFile];
        let pdflatex = spawn(pdflatexPath, args);

        pdflatex.on('error', (err) => reject(err));

        pdflatex.on('close', () => {
            resolve();
        });
    });
}

function convert (inputFile, outputFile, inputType, pandocOutputType) {
    if(inputType === 'latex' && pandocOutputType === 'pdf'){
        console.log('Using PdfLateX to convert Latex to PDF directly.')
        pdflatex(inputFile, outputFile)
          .then(() => {
              return pdflatex(inputFile, outputFile)
          });
    }else{
        return pandoc(inputFile, outputFile, inputType, pandocOutputType)
    }
}

function download (url, dest) {
    return new Promise((resolve, reject) => {
        let file = fs.createWriteStream(dest);
        let request = http.get(url, function(response) {
            response.pipe(file);
            file.on('finish', function() {
                file.close();
                resolve('success');
            });
        }).on('error', function(err) {
            fs.unlink(dest);
            reject('failed');
        });
    });
}

function downloadAssets(assetUrls){
    return new Promise((resolve,reject) => {
        let requests = [];
        for(let asset in assetUrls){
            requests.push(download(asset.url, './assets/' + asset.name))
        }
        Promise.all(requests)
          .catch(() => {
              reject('Download of one or more assets failed!');
          })
          .then(() => {
              resolve();
          })
    })
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
    if (req.method !== 'POST' || !req.headers['content-type'] || !req.headers['accept']) {
        res.statusCode = 400;
        res.statusMessage = 'Bad Request';
        res.end('Only POST is supported');
    } else {
        let assetUrls = JSON.parse(req.headers['Asset-Collection']);
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
            .then(() => convert(inputFile, outputFile, inputType, pandocOutputType))
            .then(() => fs.readFile(outputFile))
            .then((result) => {
                res.setHeader('Content-Type', outputMediaType);
                res.end(result);
                fs.unlink(outputFile);
            })
            .catch((err) => {
                res.statusCode = 500;
                res.statusMessage = 'Internal Server Error';
                res.end(res.statusMessage);
                console.error('Error during conversion: ', err);
            })
            .then(() => fs.unlink(inputFile))
            .then(() => lignator.remove('assets', false));
    }
}
let server = http.createServer(handleRequest);

let p = process.env.PORT || port;
server.listen(p, () => console.log('Server listening on port ' + p));
