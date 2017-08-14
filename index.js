const connect = require('connect')
const mosca = require('mosca');
const serveStatic = require('serve-static');

let app, settings, server;

const onSetup = () => {
  console.log('Mosca server is up and running on port: ' + settings.port +
               ' and http port: ' + settings.http.port);
};

const onConnected = (client) => {
  console.log('client connected', client.id);
};

const onPublish = (packet, client) => {
  console.log('Published', packet.payload);
};

const http = new Object();
http.port   = 8083;
http.bundle = true;
http.static = "./";

const persistence = new Object();
persistence.factory = mosca.persistence.Memory;

settings = new Object();
settings.port = 1883;
settings.http = http;
settings.persistence = persistence;

server = new mosca.Server(settings);
server.on('clientConnected', onConnected);
server.on('published', onPublish);
server.on('ready', onSetup);

const dashboardSettings = new Object();
dashboardSettings.port = 3000;

app = connect();
app.use(serveStatic(__dirname+"/mqtt-admin"));
app.listen(dashboardSettings.port);
console.log("View dashboard on port " + dashboardSettings.port);
