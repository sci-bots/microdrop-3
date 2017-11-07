const lo = require("lodash");

const WebMixins = require('./WebMixins');
const NodeMixins = require('./NodeMixins');

let MqttClient, environment;
try {
  MqttClient = require('@mqttclient/web');
  environment = 'web';
} catch (e) {
  MqttClient = require('@mqttclient/node');
  environment = 'node';
}
const Electrodes = require('./microdrop-async/Electrodes');
const Device = require('./microdrop-async/Device');
const Protocol = require('./microdrop-async/Protocol');
const PluginManager = require('./microdrop-async/PluginManager');
const Routes = require('./microdrop-async/Routes');
const Schema = require('./microdrop-async/Schema');
const Steps = require('./microdrop-async/Steps');

DEFAULT_TIMEOUT = 10000;

const payloadToJson = (payload) => {
  const LABEL = "<MicrodropAsync::payloadToJson>";
  // Convert payload to JSON
  let payloadJSON;
  if (environment == "web") {
    // XXX: Need to migrate WebMqttClient to accept only json payloads
    try {
      payloadJSON = JSON.parse(payload);
      console.warn(LABEL, "string payloads are being depricated");
      return payloadJSON;
    } catch (e) {
      return payload;
    }
  } else {
    return payload;
  }
};

class MicrodropAsync extends MqttClient {
    constructor(){
      super();
      this.environment = environment;
      if (environment == 'web') lo.extend(this, WebMixins);
      if (environment == 'node') lo.extend(this, NodeMixins);
      this.electrodes = new Electrodes(this);
      this.device = new Device(this);
      this.pluginManager = new PluginManager(this);
      this.protocol = new Protocol(this);
      this.routes = new Routes(this);
      this.schema = new Schema(this);
      this.steps = new Steps(this);
      this._name = this.generateId();
    }
    listen() {
      this.trigger("client-ready", null);
    }

    get name() {
      return this._name;
    }

    get filepath() {
      if (environment == 'web') return "web";
      if (environment == 'node') return __dirname;
    }

    generateId() {
      return `microdrop-async-${Date.now()}-${Math.ceil(Math.random()*100)}`;
    }

    clientReady(timeout=DEFAULT_TIMEOUT) {
      return new Promise ((resolve, reject) => {
        if (this.connected) {
          resolve(true);
        }else {
          this.on("client-ready", (e) => {
            resolve(true);
          });
        }
        setTimeout(() => {
          reject(`<MicrodropAsync::clientReady> Timeout (${timeout})`)},
            timeout );
      });
    }

    async triggerPlugin(receiver, action, val={}, timeout=DEFAULT_TIMEOUT) {
      const LABEL = `<MicrodropAsync::triggerPlugin> ${receiver}#${action}`;

      try {
        await this.clientReady();
        await this.clearSubscriptions();
        const result = await this.callAction(receiver, action,
          val, "trigger", timeout);
        return result;
      } catch (e) {
        throw(lo.flattenDeep([LABEL, e]));
      }
    }

    async putPlugin(receiver, property, val, timeout=DEFAULT_TIMEOUT) {
      const LABEL = `<MicrodropAsync::putPlugin> ${receiver}#${property}`;
      try {
        await this.clientReady(timeout);
        await this.clearSubscriptions(timeout);
        return (await this.callAction(receiver, property, val, "put",
          timeout));
      } catch (e) {
        throw(lo.flattenDeep([LABEL, e]));
      }
    }

    async getState(sender, property, timeout=DEFAULT_TIMEOUT) {
      const LABEL = "<MicrodropAsync::getState>";
      const topic = `microdrop/${sender}/state/${property}`;

      const getProp = () => {
        return new Promise((resolve, reject) => {
          let route;
          route = this.onStateMsg(sender, property, (payload) => {
            console.log(LABEL, "STATE UPDATE", sender, property);
            // Remove route:
            this.subscriptions = lo.pull(this.subscriptions, topic);
            try {
              this.removeRoute(route);
            } catch (e) {
              console.log(LABEL, "ROUTE:::", route, typeof(route));
              this.removeAllRoutes();
            }
            // Convert payload to JSON
            const payloadJSON = payloadToJson(payload);
            resolve (payloadJSON);
          });
          setTimeout(()=>{reject([LABEL, `Timeout (${timeout})`])}, timeout);
        });
      };

      try {
        await this.clientReady(timeout);
        await this.clearSubscriptions(timeout);
        const payload = await getProp();
        return payload;
      } catch (e) {
        throw([`<MicrodropAsync::getState> ${sender}#${property}`, e]);
      }
    }

    callAction(receiver, action, val, type="trigger", timeout=DEFAULT_TIMEOUT) {
      const LABEL =`<MicrodropAsync::callAction>`;

      return new Promise((resolve, reject) => {
        const topic = `microdrop/${type}/${receiver}/${action}`;
        let route;
        const sub = `microdrop/${receiver}/notify/${this.name}/${action}`;
        route = this.onNotifyMsg(receiver, action, (payload) => {

          // Remove route
          this.subscriptions = lo.pull(this.subscriptions, sub);
          try {
            this.removeRoute(route);
          } catch (e) {
            console.error(LABEL, "REMOVE ROUTE::", route, typeof(route));
            this.removeAllRoutes();
          }

          // Convert payload to JSON
          const  payloadJSON = payloadToJson(payload);

          // Resolve message
          if (payloadJSON.status) {
            if (payloadJSON.status == "failed")
              reject(lo.flattenDeep([LABEL, payloadJSON.response]));
          } else {
            console.warn([LABEL, "message did not contain status"]);
          }
          resolve(payloadJSON);
        });

        this.sendMessage(topic, val);
        setTimeout(() => {
          reject(lo.flattenDeep([LABEL, `Timeout (${timeout})`]));
        }, timeout);
      });
    }
}

module.exports = MicrodropAsync;
