require('bootstrap/dist/css/bootstrap.min.css');
const d64 = require('d64');
const FileSaver = require('file-saver');
const msgpack = require('msgpack5')();
const request = require('browser-request');
const generateName = require('sillyname');
const yo = require('yo-yo');
const _ = require('lodash');
const MicropedeClient = require('@micropede/client');
const MicropedeAsync = require('@micropede/client/src/async');

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
    request('/version-manager-plugins', (e, r, body) => {
      if (e) throw(e);
      console.log({body});
      this.plugins = JSON.parse(body);
      console.log({plugins: this.plugins});

      this.renderPlugins();
    });
  }
  compareVersions(storage) {
    console.log({storage});
    let body = JSON.stringify(storage);
    const req = {method:'POST', url:'/validate-file', body: body, json:true};
    request(req, (e, res, body) => {
      if (e) throw(e);
      console.log({body});
      this.plugins = body;
      this.renderPlugins();
    });
  }
  uploadFile(callback) {
    let fileinput;

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

    fileinput = yo`<input type='file' onchange=${handler.bind(this)} />`;
    fileinput.click();
    fileinput = null;
  }
  async updateStateVersions() {
    await Promise.all(_.map(this.plugins, async (p) => {
      await this.client.dangerouslySetState("version", p.version, p.name);
    }));
  }
  downloadFile() {
    _.each(this.plugins, (p) => {
      if (p.storageVersion == undefined) return;
      let storageKey = `${APPNAME}!!retained!${APPNAME}/${p.name}/state/version`;
      let storageItem = this.storage[storageKey];
      if (storageItem == undefined) return;
      storageItem.payload = p.storageVersion;
    });

    const type = "application/json;charset=utf-8";
    const body = JSON.stringify(encodeStorage(this.storage));
    const blob = new Blob([body], {type});
    FileSaver.saveAs(blob, `${generateName()}.udrp`);
    console.log(decodeStorage(encodeStorage(this.storage)));
  }
  async performUpgrade(p) {
    request(`/perform-upgrade?name=${p.name}`, (e, res, body) => {
      if (e) throw(e);
      let updatedPlugin = JSON.parse(body);
      let plugin = _.find(this.plugins, {name: updatedPlugin.name});
      _.extend(plugin, updatedPlugin);
      this.renderPlugins();
    });
  }

  renderPlugins() {

    const inputChanged = (p, key, e) => {
      let url;

      if (key == "version") url = '/modify-plugin-version';
      if (key == "storageVersion") url = '/modify-storage-version';

      request(`${url}?name=${p.name}&val=${e.target.value}`, (e, r, body) => {
        if (e) throw(e);
        let updatedPlugin = JSON.parse(body);
        let plugin = _.find(this.plugins, {name: p.name});
        _.extend(plugin, updatedPlugin);
        this.renderPlugins();
      });
    }

    this.element.innerHTML = '';
    const navigation = yo`
    <nav class="navbar navbar-light bg-light justify-content-between">
      <a class="navbar-brand">Microdrop Version Info</a>
      <div style="float:right">
        <button class="btn btn-outline-secondary"
          onclick=${this.uploadFile.bind(this, this.compareVersions)}>Upload File</button>
        <button class="btn btn-outline-secondary"
          onclick=${this.updateStateVersions.bind(this)}>Update State Versions</button>
        <button class="btn btn-outline-secondary"
          onclick=${this.downloadFile.bind(this)}>Download</button>
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
            <th>Action</th>
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
                  onchange=${inputChanged.bind(this, p, "storageVersion")}
                  value="${p.storageVersion || ''}">
              </td>
              <td>
                ${p.needsUpdating ? yo`
                  <button
                    class="btn btn-secondary"
                    onclick=${this.performUpgrade.bind(this, p)}>
                    Perform upgrade
                  </button>
                ` : ''}
              </td>
              <td>
                <textarea rows="4" cols="50">
                  ${p.response}
                </textarea>
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
