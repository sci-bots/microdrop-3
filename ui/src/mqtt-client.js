const IsJsonString = (str) => {
  try { JSON.parse(str);} catch (e) {return false;}
  return true;
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
  // addSubscription(channel, method) {
  //   console.log("ADDING SUBSCRIPTION:::");
  //   console.log(channel);
  //   console.log(method);
  //   this.addRoute(channel, method);
  //   this.subscriptions.push(channel.replace(/\{(.+?)\}/g, "+"));
  // }
  // addBinding(channel, event, retain=false, qos=0, dup=false) {
  //   this.on(event, (d) => this.sendMessage(channel, d, retain, qos, dup));
  // }
  //
  // onStateMsg(sender, val, method) {
  //   this.addSubscription(`${this.base}/${sender}/state/${val}`, method);
  // }
  // bindStateMsg(val, event) {
  //   /* Notify plugins that state has successfully been modified */
  //   this.addBinding(`${this.base}/${this.name}/state/${val}`, event, true);
  // }
  // onStateErrorMsg(sender, val, method) {
  //   this.addSubscription(`${this.base}/${sender}/error/${val}`, method);
  // }
  // bindStateErrorMsg(val, event) {
  //   /* Notify plugins upon failure to change state */
  //   this.addBinding(`${this.base}/${this.name}/error/${val}`, event);
  // }
  // onPutMsg(val, method) {
  //   this.addSubscription(`${this.base}/put/${this.name}/${val}`, method);
  // }
  // bindPutMsg(receiver, val, event) {
  //   /* Request plugin to change the state of one of its variables */
  //   this.addBinding(`${this.base}/put/${receiver}/${val}`, event);
  // }
  // onNotifyMsg(topic, method) {
  //   this.addSubscription(`${this.base}/notify/${this.name}/${topic}`, method);
  // }
  // bindNotifyMsg(receiver, topic, event) {
  //   /* Similar to trigger; notify plugin regarding a particular topic */
  //   this.addBinding(`${this.base}/notify/${receiver}/${topic}`, event);
  // }
  // onStatusMsg(sender, method) {
  //   this.addSubscription(`${this.base}/status/${sender}`, method);
  // }
  // bindStatusMsg(event) {
  //   /* Broadcast plugin status */
  //   this.addBinding(`${this.base}/status/${this.name}`, event);
  // }
  // onTriggerMsg(action, method) {
  //   this.addSubscription(`${this.base}/trigger/${this.name}/${action}`, method);
  // }
  // bindTriggerMsg(receiver, action, event) {
  //   /* Trigger another plugin to perform an action */
  //   this.addBinding(`${this.base}/trigger/${receiver}/${action}`, event);
  // }
  // onSignalMsg(sender, topic, method) {
  //   this.addSubscription(`${this.base}/${sender}/signal/${topic}`, method);
  // }
  // bindSignalMsg(topic, event) {
  //   /* Signal other plugins about a topic (without knowledge of those plugins)*/
  //   this.addBinding(`${this.base}/${this.name}/signal/${topic}`, event);
  // }

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
    if (this.client.isConnected() == false){
      console.error("Cannot send message, client is disconnected");
      return;
    }
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
    return encodeURI(this.constructor.name.split(/(?=[A-Z])/).join('-').toLowerCase());
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
    this.reconnect();
  }
  onMessageArrived(msg) {
    const receiver = this.name + " : " + msg.destinationName;
    // console.log(receiver);

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
