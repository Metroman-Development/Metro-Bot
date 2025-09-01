const http = require('http');
const fs = require('fs');

const dataPath = './data/estadoRed.json';

const requestListener = function (req, res) {
  if (req.url === '/update' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      fs.writeFile(dataPath, body, 'utf8', (err) => {
        if (err) {
          res.writeHead(500);
          res.end('Error writing the file');
          return;
        }
        res.writeHead(200);
        res.end('File updated');
      });
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
};

const server = http.createServer(requestListener);
const port = 3001;
server.listen(port);

console.log(`JsonService running at http://localhost:${port}`);
