require('bootstrap/dist/css/bootstrap.min.css');
const d64 = require('d64');
const FileSaver = require('file-saver');
const msgpack = require('msgpack5')();
const request = require('browser-request');
const generateName = require('sillyname');
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

const encodeStorage = (storage) => {
  return _.mapValues(storage, function (msg) {
    msg.payload = JSON.stringify(msg.payload);
    return `Buff:${d64.encode(msgpack.encode(msg).slice())}`;
  });
}

class VersionInfo {
  constructor(element) {
    this.element = element;
    this.plugins = [];
    this.storage = null;
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
            plugin = {
              name,
              version,
              get needsUpdating() {
                return this.version > (this.fileVersion || "0.0.0")
              }
            };

            this.plugins.push(plugin);
          } else {
            plugin.version = version;
          }
          this.renderPlugins();
        });
      }
    });
    console.log(this);
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
        this.storage = storage;
        callback.bind(this)(storage);
      };
      reader.readAsText(f);
    }

    const fileinput = yo`<input type='file' onchange=${handler.bind(this)} />`;
    fileinput.click();
  }
  async updateState() {
    await Promise.all(_.map(this.plugins, async (p) => {
      await this.client.dangerouslySetState("version", p.version, p.name);
    }));
  }
  updateFile() {
    _.each(this.plugins, (p) => {
      if (p.fileVersion == undefined) return;
      let storageKey = `${APPNAME}!!retained!${APPNAME}/${p.name}/state/version`;
      let storageItem = this.storage[storageKey];
      if (storageItem == undefined) return;
      storageItem.payload = p.fileVersion;
    });

    const type = "application/json;charset=utf-8";
    const body = JSON.stringify(encodeStorage(this.storage));
    const blob = new Blob([body], {type});
    FileSaver.saveAs(blob, `${generateName()}.udrp`);
    console.log(decodeStorage(encodeStorage(this.storage)));
  }
  renderPlugins() {

    const inputChanged = (p, key, e) => {
      p[key] = e.target.value;
      this.renderPlugins();
    }

    this.element.innerHTML = '';
    const navigation = yo`
    <nav class="navbar navbar-light bg-light justify-content-between">
      <a class="navbar-brand">Microdrop Version Info</a>
      <div style="float:right">
        <button class="btn btn-outline-secondary"
          onclick=${this.uploadFile.bind(this, this.compareVersions)}>Upload File</button>
        <button class="btn btn-outline-secondary"
          onclick=${this.updateState.bind(this)}>Update State</button>
        <button class="btn btn-outline-secondary"
          onclick=${this.updateFile.bind(this)}>Update File</button>
      </div>
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
            <tr class="${p.needsUpdating ? 'table-danger' : ''}">
              <td>${p.name}</td>
              <td>
                <input
                  onchange=${inputChanged.bind(this, p, "version")}
                  value="${p.version}">
              </td>
              <td>
                <input
                  onchange=${inputChanged.bind(this, p, "fileVersion")}
                  value="${p.fileVersion || ''}">
              </td>
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
