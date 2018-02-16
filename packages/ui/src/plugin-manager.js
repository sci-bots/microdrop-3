const yo = require('yo-yo');
const request = require('browser-request');
const {MicropedeClient} = require('@micropede/client/src/client.js');
const MicropedeAsync = require('@micropede/client/src/async.js');

const APPNAME = 'microdrop';
const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 8083;

const DEFAULT_CONTAINER = yo`<div style="min-width: 460px;"></div>`;

class PluginManager extends MicropedeClient {
  constructor(port=DEFAULT_PORT, container=undefined) {
    super(APPNAME, DEFAULT_HOST, port);
    this.container = DEFAULT_CONTAINER;
    document.body.appendChild(this.container);
    request('/plugins.json', (a, b, c) => this.render(JSON.parse(c)));
  }

  listen() {
    this.onStateMsg('web-server', 'plugins', (d) => {
      request('/plugins.json', (a, b, c) => this.render(JSON.parse(c)));
    });
  }

  async toggleState(plugin, e) {
    if (plugin.state == 'enabled' || plugin.state == 'disabled')
      plugin.state = (plugin.state == 'enabled') ? 'disabled' :  'enabled';
    else
      plugin.state = (plugin.state == 'running') ? 'stopped' : 'running';
    const micropede = new MicropedeAsync(this.appName, this.host, this.port);
    const data = await micropede.triggerPlugin('web-server', 'update-plugin-state', plugin);
    this.render(data.response);
    localStorage.removeItem("microdrop:layout");
  }

  async browse(input, e) {
    const micropede = new MicropedeAsync(this.appName, this.host, this.port);
    const data = await micropede.triggerPlugin(this.appName, 'browse', {}, -1);
    input.value = data.response;
    await this.addPath(input, e);
  }

  async addPath(input, e) {
    const micropede = new MicropedeAsync(this.appName, this.host, this.port);
    const data = await micropede.triggerPlugin('web-server', 'add-plugin-path', {path: input.value});
  }

  async removePlugin(d) {
    const micropede = new MicropedeAsync(this.appName, this.host, this.port);
    const data = await micropede.triggerPlugin('web-server', 'remove-plugin-path', d);
  }

  async render(plugins) {
    console.log({plugins})
    this.container.innerHTML = '';
    const lists = {};

    const input = yo`<input style='${STYLES.input}; ${STYLES.addInput}'/>`;

    const header = yo`
    <li style='${STYLES.li} text-align:center;' >
        <div style='${STYLES.clearfix} margin: 0 auto;'>
          ${input}
          <button style='${STYLES.button}; background: rgb(218, 218, 218);'
            onclick=${this.browse.bind(this, input)}>
            Browse
          </button>
          <button style='${STYLES.button}; margin-left: 5px;'
            onclick=${this.addPath.bind(this, input)}>
            Add Path
          </button>
      </div>
    </li>
    `;

    const renderList = (plugins) => _.map(plugins, (d,p) => {
      return yo`<li style='${STYLES.li}'>
        <div style='${STYLES.clearfix} margin: 0 auto;'>
          <div style='width:160px; display: inline-block'>${d.name}</div>
          <input style='${STYLES.input};margin-right: 5px;' value='${p}' />
          ${this.statusButton(d)}
          <button onclick=${this.removePlugin.bind(this, d)}
            style='
              ${STYLES.button};
              background-color: #FF9800;
              margin-left: 5px;'>
            Remove
          </button>
        </div>
      </li>`
    });

    const list = yo`
      <div>
        <ul style='${STYLES.ul};'>
          ${header}
          ${renderList(plugins.webPlugins)}
          ${renderList(plugins.processPlugins)}
        </ul>
      </div>
    `;
    this.container.appendChild(list);
  }

  statusButton(d) {
    const green = '#4CAF50';
    const red = '#f44336';

    let background, msg;
    if (d.state == 'enabled') {
      background = red; msg = 'disable';
    }
    if (d.state == 'disabled') {
      background = green; msg = 'enable';
    }
    if (d.state == 'running') {
      background = red; msg = 'stop';
    }
    if (d.state == 'stopped') {
      background = green; msg = 'start';
    }

    const button = yo`
      <button style='${STYLES.button}; background: ${background}'
      onclick=${this.toggleState.bind(this, d)}>
        ${msg}
      </button>`;

    return button;
  }

};


const STYLES = {
  clearfix: `
    content: "";
    clear: both;
    display: table;
  `,
  ul: `
    padding: 0;
    list-style: none;
  `,
  li: `
    background: white;
    border: 1px solid rgb(240, 240, 240);
    padding: 3px;
  `,
  button: `
    border: none;
    border-radius: 5px;
    color: white;
    background-color: #3F51B5;
    width: 80px;
  `,
  input: `
    font-size: 12px;
    width: 293px;
    border-radius: 5px;
    border: 1px solid #d2d2d2;
    box-shadow: none;
    background: none;
  `,
  addInput: `
  padding: 4px;
  margin-right: 5px;
  `
}

module.exports = PluginManager;
