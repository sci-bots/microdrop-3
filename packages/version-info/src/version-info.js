require('bootstrap/dist/css/bootstrap.min.css');
const d64 = require('d64');
const msgpack = require('msgpack5')();
const request = require('browser-request');
const yo = require('yo-yo');
const _ = require('lodash');
const MicropedeClient = require('@micropede/client');
const APPNAME = 'microdrop';

const decodeStorage = (storage) => {
  let items = _.pickBy(storage, (v,k)=>{
    return _.includes(k, `${APPNAME}!!`)
  });

  return _.mapValues(items, function (v) {
    v = msgpack.decode(d64.decode(v.substring(5)));
    if (v.payload) v.payload = JSON.parse(v.payload)
    return v;
  });
}

class VersionInfo {
  constructor(element) {
    this.element = element;
    this.plugins = [];
    request('/mqtt-ws-port', (er, response, body) => {
      const port = parseInt(body);
      let storageUrl = window.location.origin;
      const options = {storageUrl: storageUrl, resubscribe: false};
      let u = undefined;
      this.client = new MicropedeClient("microdrop", u, port, "VersionInfo", u, options);
      this.client.listen = () => {
        this.client.onStateMsg("{name}", "version", (version, params) => {
          let name = params.name;
          let plugin = _.find(this.plugins, {name});
          if (plugin == undefined) {
            this.plugins.push({name, version});
          } else {
            plugin.version = version;
          }
          this.renderPlugins();
        });
      }
    });
  }
  compareVersions(storage) {
    const rep = (s) => s.replace("microdrop/","").replace("/state/version", "");
    let versionsMsgs = _.filter(storage, (v,k)=>_.includes(k,"/version"));
    let versions = _.map(versionsMsgs, (msg) => {
      return {name: rep(msg.topic), version: msg.payload}
    });
    _.each(this.plugins, (p) => {
      // fileVersion
      let plugin = _.find(versions, {name: p.name});
      p.fileVersion = plugin.version;
    });
    this.renderPlugins();
  }
  uploadFile(callback) {
    const handler = (e) => {
      const f = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const storage = decodeStorage(JSON.parse(content));
        callback.bind(this)(storage);
      };
      reader.readAsText(f);
    }

    const fileinput = yo`<input type='file' onchange=${handler.bind(this)} />`;
    fileinput.click();
  }
  renderPlugins() {
    this.element.innerHTML = '';
    const navigation = yo`
    <nav class="navbar navbar-light bg-light justify-content-between">
      <a class="navbar-brand">Microdrop Version Info</a>
      <button class="btn btn-outline-secondary"
        onclick=${this.uploadFile.bind(this, this.compareVersions)}>Upload File</button>
    </nav>
    `;
    const table = yo`
      <table class="table">
        <thead>
          <tr>
            <th>Plugin Name</th>
            <th>Plugin Version</th>
            <th>File Version</th>
          </tr>
        </thead>
        <tbody>
          ${_.map(this.plugins, p => yo`
            <tr>
              <td>${p.name}</td>
              <td>${p.version}</td>
              <td>${p.fileVersion || ""}</td>
            </tr>
          `)}
        </tbody>
      </table>
    `;
    this.element.appendChild(navigation);
    this.element.appendChild(table);
  }
}

module.exports = VersionInfo;
module.exports.VersionInfo = VersionInfo;
