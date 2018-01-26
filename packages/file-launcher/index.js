const path = require('path');
const fs = require('fs');
const {app, dialog, nativeImage, Menu, Tray} = require('electron')
const backbone = require('backbone');
const _ = require('lodash');
const mqtt = require('mqtt');

let eventObj = _.extend({}, backbone.Events);
let ready = false;

let tray = null

function openFile(filepath) {
  var handler = () => {
    var client  = mqtt.connect('mqtt://localhost:1884');

    client.on('connect', function () {
      var topic = 'microdrop/file-launcher/state/last-opened-file';

      fs.readFile(filepath, 'utf8', function (err, data) {
        if (err) throw err;
        client.publish(topic, data, (err) => {
          if (err) throw err;
          client.end();
        });
      });
    });
  };

  if (ready == false) eventObj.on('ready', handler.bind(this));
  if (ready == true) handler();
}

app.on('ready', () => {
  eventObj.trigger('ready'); ready = true;

  const filepath = _.filter(process.argv, (i) => _.includes(i, ".microdrop"))[0];
  if (filepath) {
    // dialog.showMessageBox({message: filepath});
    openFile(filepath);
  }
  else {
    let image = nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
    image = image.resize({width: 20, height: 20});
    tray = new Tray(image);
    const contextMenu = Menu.buildFromTemplate([
      {label: 'Item1', type: 'radio'},
      {label: 'Item2', type: 'radio'},
      {label: 'Item3', type: 'radio', checked: true},
      {label: 'Item4', type: 'radio'}
    ])
    tray.setToolTip('Microdrop')
    tray.setContextMenu(contextMenu)
  }
});


app.on('open-file', function(event, filepath){
  event.preventDefault();
  openFile(filepath);
});
