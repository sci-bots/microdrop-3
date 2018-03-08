const yo = require('yo-yo');
const _ = require('lodash');
const MicropedeAsync = require('@micropede/client/src/async.js');
const UIPlugin = require('@microdrop/ui-plugin');

const APPNAME = 'microdrop';

const StatusLabel = (text, cls="badge-secondary") => {
  return yo`
    <h3><span class="badge ${cls}">${text}</span></h3>
  `;
};

const CreateProxyButton = (handler) => {
  return yo`
    <button class="btn btn-outline-secondary" onclick=${handler.bind(this)}>
      Create Serial Proxy
    </button>
  `
};

class DropbotUIPlugin extends UIPlugin {
  constructor(element, focusTracker, ...args) {
    super(element, focusTracker, ...args);

    element.innerHTML = '';

    this.statusContainer = yo`<div></div>`;
    element.appendChild(yo`
      <div>
        ${this.statusContainer}
        ${CreateProxyButton(this.createProxy.bind(this))}
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

  async createProxy() {
    const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
    await microdrop.triggerPlugin('dropbot', 'connect-dropbot')
    console.log("I was called??", this);
  }

  listen() {
    console.log("Listening!");
  }
}

module.exports = DropbotUIPlugin;
