const mqtt = require('mqtt')

DEFAULT_TIMEOUT = 10000;

const NodeMixins = new Object();

NodeMixins.getMsg = function(buf) {
  if (!buf.toString().length) return false;
  try {
    const msg = JSON.parse(buf.toString());
    return msg;
  } catch (e) {
    return false;
  }
}

NodeMixins.newMessage = function(topic, timeout=DEFAULT_TIMEOUT) {
  const LABEL = "<MicrodropAsync::NodeMixins::newMessage>";
  return new Promise((resolve, reject) => {
    this.client.on("message", (t, buf) => {
      if (t != topic) return;
      const msg = this.getMsg(buf);
      if (msg) resolve(msg);
      if (!msg) reject(`<MicrodropAsync.Node>#newMessage Message Malformed`);
    });
    this.client.subscribe(topic);
    setTimeout(()=>{reject([LABEL, `Timeout (${timeout})`])}, timeout);
  });
}

NodeMixins.clearSubscriptions = function(timeout=DEFAULT_TIMEOUT) {
  const url = `mqtt://${this.host}:${this.port}`;
  const subscriptions = this.subscriptions;

  return new Promise((resolve, reject) => {
    // resolve(this.client);
    // this.subscriptions = [];
    this.client.end(true, () => {
      this.client = mqtt.connect(url);
      this.client.on('message', this.onMessage.bind(this));
      this.client.on('connect', () => {
        // Re-subscribe to awaiting subscriptions:
        for (const [i, sub] of subscriptions.entries()){
          this.client.subscribe(sub);
        }
        this.trigger("client-ready", null);
        resolve(this.client);
      });
    });
    setTimeout(() => {
      reject(`<MicrodropAsync.Node>#clearSubscriptions Timeout (${timeout})`)
    }, timeout);
  });
}

module.exports = NodeMixins;
