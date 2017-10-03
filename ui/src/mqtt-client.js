const IsJsonString = (str) => {
  try { JSON.parse(str);} catch (e) {return false;}
  return true;
}

const decamelize = (str, sep='-') => {
  // https://github.com/sindresorhus/decamelize
  return str
    .replace(/([a-z\d])([A-Z])/g, '$1' + sep + '$2')
    .replace(/([A-Z]+)([A-Z][a-z\d]+)/g, '$1' + sep + '$2')
    .toLowerCase();
}

class MQTTClient {
  constructor(name="web-ui", base="microdrop") {
    _.extend(this, Backbone.Events);
    _.extend(this, crossroads.create());
    _.extend(this, MqttMessages);
    this.base = base;
    this.client = this.Client();
    this.subscriptions = new Array();

    // XXX: ignoreState variable used internally by crossroads
    this.ignoreState = true;
  }

  /* Old Route Methods (Depricating) */
  addGetRoute(topic, method) {
    // Replace content within curly brackets with "+" wildcard
    this.addRoute(topic, method);
    this.subscriptions.push(topic.replace(/\{(.+?)\}/g, "+"));
  }

  addPostRoute(topic, event, retain=false, qos=0, dup=false){
    // TODO: Have different front end clients post to different channels
    // const channel = "microdrop/"+this.name;
    this.on(event, (d) => this.sendMessage(this.channel+topic, d, retain, qos, dup));
  }

  sendMessage(topic, payload, retain=false, qos=0, dup=false){
    let hasHeader = true;

    // Check if message does not contain header
    if (typeof(payload) != "object" || payload === null) hasHeader = false;
    if (typeof(payload) == "object" && payload !== null){
      if (!("__head__" in payload)) hasHeader = false;
    }

    // Send warning if message does not contain header
    if (!hasHeader) {
      console.warn(
        `payload.__head__ returned undefined:
        Message for topic: ${topic} does not container header.`
       );
    }

    // Ensure client is connected
    if (this.client.isConnected() == false){
      console.error("Cannot send message, client is disconnected");
      return;
    }

    // Send message
    const message = this.Message(topic,payload,retain,qos,dup);
    this.client.send(message);
  }
  reconnect() {
    if (this.client.isConnected()) return;
    console.warn("Connection lost with broker, attempting to reconnect");
    this.client.connect({onSuccess: this.onConnect.bind(this)});
    setTimeout(()=>{this.reconnect()}, 1000);
  }
  // ** Getters and Setters **
  get name() {
    return encodeURI(decamelize(this.constructor.name));
  }

  get channel() {
    return  "microdrop/dmf-device-ui";
  }

  get clientId() {
    const time = new Date().toISOString().replace(">>", "");
    return `${this.name}>>web>>${time}`;
  }

  // ** Event Handlers **
  onConnect() {
    // MQTT Callback after establishing brocker connection
    console.log(`Subscriptions for ${this.name}:::`);
    console.log(this.subscriptions);
    for (var s of this.subscriptions) this.client.subscribe(s);
  }
  onConnectionLost(status) {
    console.error(`Connection lost for ${this.name}`);
    console.error(status.errorMessage);
    // this.reconnect();
  }
  onMessageArrived(msg) {
    const receiver = this.name + " : " + msg.destinationName;
    const payloadIsValid = IsJsonString(msg.payloadString);
    if (payloadIsValid)  this.parse(msg.destinationName, [msg.payloadString]);
    if (!payloadIsValid) console.error("Could not parse message for " + receiver);
  }

  // ** Initializers **
  Client() {
    const client = new Paho.MQTT.Client("localhost", 8083, this.clientId);
    client.onMessageArrived = this.onMessageArrived.bind(this);
    client.onConnectionLost = this.onConnectionLost.bind(this);
    client.connect({onSuccess: this.onConnect.bind(this)});
    return client;
  }

  Message(topic, msg, retain=false, qos=0, dup=false){
    const message = new Paho.MQTT.Message(JSON.stringify(msg));
    message.destinationName = topic;
    message.retain = retain;
    message.qos = qos;
    message.duplicate = dup;
    return message;
  }

}
