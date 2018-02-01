const PORT = 1884;
const APPNAME = 'microdrop';

const {spawn} = require('child_process');
const path = require('path');

const mqtt = require('mqtt');

const OPTIONS = {stdio: 'inherit', shell: true};

console.log("Launching Electron APP");
const broker = spawn(`electron app.js`, [], {shell: true, stdio: 'inherit', detached: true});

console.log("Launching Models");
const devicePath = path.resolve(__dirname, 'models/DeviceModel.js');
const elecPath = path.resolve(__dirname, 'models/ElectrodesModel.js');
const routesPath = path.resolve(__dirname, 'models/RoutesModel.js');

const c1 = spawn(`node ${devicePath}`, [], OPTIONS);
const c2 = spawn(`node ${elecPath}`, [], OPTIONS);
const c3 = spawn(`node ${routesPath}`, [], OPTIONS);

async function publishClose() {
  await new Promise((resolveTop, rejectTop) => {
    // console.log("connecting to client", `mqtt://localhost:${PORT}`);
    var client  = mqtt.connect(`mqtt://localhost:${PORT}`);
    client.on('connect', async function () {

      // console.log("attempting to close routes");
      await new Promise((resolve, reject) => {
        client.publish(`${APPNAME}/trigger/routes-model/exit`, '{}', (err) => {
          // console.log("closed routes-model");
          resolve();
        });
      });

      // console.log("attempting to close electrodes");
      await new Promise((resolve, reject) => {
        client.publish(`${APPNAME}/trigger/electrodes-model/exit`, '{}', (err) => {
          // console.log("closed electrodes-model");
          resolve();
        });
      });

      // console.log("attempting to close device");
      await new Promise((resolve, reject) => {
        client.publish(`${APPNAME}/trigger/device-model/exit`, '{}', (err) => {
          // console.log("closed device-model");
          resolve();
        });
      });
      client.end();

      resolveTop();
    })
  }).catch((err) => resolveTop(err));;
};

process.on('SIGINT', () => {
  publishClose().then((d) => {
    c1.kill('SIGINT');
    c2.kill('SIGINT');
    c3.kill('SIGINT');
    spawn("taskkill", ["/pid", broker.pid, '/f', '/t'], {detached: true});
    process.exit();
  });

  setTimeout(()=>{
    console.log("timed out waiting for child processes to close.")
    process.exit();
  }, 5000);
});
