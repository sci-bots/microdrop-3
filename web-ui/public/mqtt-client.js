const IsJsonString = (str) => {
  try { JSON.parse(str);} catch (e) {return false;}
  return true;
}

class MQTTClient {
  constructor(name="web-ui") {
    _.extend(this, Backbone.Events);
    _.extend(this, crossroads.create());

    this.client = this.Client();
    this.subscriptions = new Array();

    // XXX: ignoreState variable used internally by crossroads
    this.ignoreState = true;
  }

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
    const message = this.Message(topic,payload,retain,qos,dup);
    this.client.send(message);
  }

  // ** Getters and Setters **
  get name() {
    return this.constructor.name;
  }

  get channel() {
    return  "microdrop/dmf-device-ui";
  }

  // ** Event Handlers **
  onConnect() {
    // MQTT Callback after establishing brocker connection
    console.log(`Subscriptions for ${this.name}:::`);
    console.log(this.subscriptions);
    for (var s of this.subscriptions) this.client.subscribe(s);
  }
  onConnectionLost() {
    console.warn("Connection lost with broker");
    this.client.connect({onSuccess: this.onConnect.bind(this)});
  }
  onMessageArrived(msg) {
    const receiver = this.name + " : " + msg.destinationName;
    console.log(receiver);

    const payloadIsValid = IsJsonString(msg.payloadString);

    if (payloadIsValid)  this.parse(msg.destinationName, [msg.payloadString]);
    if (!payloadIsValid) console.error("Could not parse message for " + receiver);
  }

  // ** Initializers **
  Client() {
    const client = new Paho.MQTT.Client("localhost", 8083, this.name);
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
