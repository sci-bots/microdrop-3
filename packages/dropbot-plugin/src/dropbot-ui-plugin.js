const yo = require('yo-yo');
const _ = require('lodash');
const MicropedeAsync = require('@micropede/client/src/async.js');
const UIPlugin = require('@microdrop/ui-plugin');

const APPNAME = 'microdrop';

const KEYS = {
  'HV_Enabled': 'high voltage enabled'
};

const CheckBox = (text, callback, v=false) => {
  return yo`
    <div>
      <input type="checkbox" ${v ? 'checked' : ''} onchange=${callback.bind(this)}>
      <label>${text}</label>
    </div>
  `;
}

const StatusLabel = (text, cls="badge-secondary") => {
  return yo`
    <span class="badge ${cls}">${text}</span>
  `;
};

const Button = (text, handler, cls='btn-outline-secondary') => {
  return yo`
    <button class="btn-sm btn ${cls}" onclick=${handler.bind(this)}>
      ${text}
    </button>
  `
};

const InfoTable = (info, callbacks) => {
  return yo`
  <table>
    ${_.map(info, (v,k) => {
      if (k == KEYS.HV_Enabled) {
        v = CheckBox('', callbacks[KEYS.HV_Enabled], v);
      }
      return yo`
        <tr>
          <td>${k}</td>
          <td>${v}</td>
        </tr>`
      })}
  </table>
`;
}

class DropbotUIPlugin extends UIPlugin {
  constructor(element, focusTracker, ...args) {
    super(element, focusTracker, ...args);

    element.innerHTML = '';

    this.infoContainer = yo`<div></div>`;
    this.statusContainer = yo`<div></div>`;
    element.appendChild(yo`
      <div>
        ${this.statusContainer}
        ${Button('Create Serial Proxy', this.createProxy.bind(this))}
        ${Button('Measure Capacitance', this.measureCapacitance.bind(this))}
        ${Button('Measure Voltage', this.measureVoltage.bind(this))}
        ${this.infoContainer}
      </div>
    `);

    this.socket = new WebSocket("ws://localhost:8009");
    this.socket.onmessage = (event) => {
      const {topic, payload} = JSON.parse(event.data);
      const dropbotPlugin = _.find(payload, {name: '@microdrop/dropbot-plugin'});
      if (dropbotPlugin.pid) {
        this.statusContainer.innerHTML = '';
        this.statusContainer.appendChild(StatusLabel('running', 'badge-success'));
      } else {
        this.statusContainer.innerHTML = '';
        this.statusContainer.appendChild(StatusLabel('stopped', 'badge-danger'));
      }
    }

    this.socket.onopen = (event) => { this.socket.send("ping") };

  }

  async hvOutputChanged(e) {
    console.log("High Voltage Output Changed!!");
    console.log(e.target.checked);
  }

  async createProxy() {
    const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
    await microdrop.triggerPlugin('dropbot', 'connect-dropbot')
    console.log("I was called??", this);
  }

  async measureCapacitance() {
    const microdrop = new MicropedeAsync('microdrop', undefined, this.port);
    let info = await microdrop.getState('dropbot', 'info');
    info["last measured Capacitance"] = (await microdrop.triggerPlugin('dropbot', 'measure-capacitance')).response;
    this.updateInfo(info);
  }

  async measureVoltage() {
    const microdrop = new MicropedeAsync('microdrop', undefined, this.port);
    let info = await microdrop.getState('dropbot', 'info');
    info["last measured voltage"] = (await microdrop.triggerPlugin('dropbot', 'measure-voltage')).response;
    this.updateInfo(info);
  }

  updateInfo(info) {
    delete info.__head__;
    this.infoContainer.innerHTML = '';
    const callbacks = {
      [KEYS.HV_Enabled]: this.hvOutputChanged.bind(this)
    };
    this.infoContainer.appendChild(InfoTable(info, callbacks));
  }

  listen() {
    this.onStateMsg('dropbot', 'info', (payload, params) => {
      delete payload.__head__;
      this.updateInfo(payload);
    });
    console.log("Listening!");
  }
}

module.exports = DropbotUIPlugin;
