/* Mixins for Mqtt Messages */
const MqttMessages = new Object();

MqttMessages.addSubscription = function(channel, method){
  const route = this.addRoute(channel, method);
  const subscription = channel.replace(/\{(.+?)\}/g, "+");

  // Ensure client is connected before continuing
  if (!this.connected) {
    console.error(`<MqttMessages>:: ${this.name} ::Cannot add subscription. Client not connected`);
    return subscription;
  }

  // Ensure subscription doesn't already exist
  if (this.subscriptions.includes(subscription))
    return subscription;

  // If the client is ready, then subscribe immediately, otherwise add to list
  this.subscriptions.push(subscription);
  this.client.subscribe(subscription);
  return route;
}
MqttMessages.addBinding = function(channel, event, retain=false, qos=0, dup=false){
  return this.on(event, (d) => this.sendMessage(channel, d, retain, qos, dup));
}
MqttMessages.onStateMsg = function(sender, val, method){
  return this.addSubscription(`${this.base}/${sender}/state/${val}`, method);
}
MqttMessages.bindStateMsg = function(val, event, persist=true) {
  /* Notify plugins that state has successfully been modified */
  return this.addBinding(`${this.base}/${this.name}/state/${val}`, event, persist);
}
MqttMessages.onStateErrorMsg = function(sender, val, method){
  return this.addSubscription(`${this.base}/${sender}/error/${val}`, method);
}
MqttMessages.bindStateErrorMsg = function(val, event){
  /* Notify plugins upon failure to change state */
  return this.addBinding(`${this.base}/${this.name}/error/${val}`, event);
}
MqttMessages.onPutMsg = function(val, method){
  return this.addSubscription(`${this.base}/put/${this.name}/${val}`, method);
}
MqttMessages.bindPutMsg = function(receiver, val, event){
  /* Request plugin to change the state of one of its variables */
  return this.addBinding(`${this.base}/put/${receiver}/${val}`, event);
}
MqttMessages.onNotifyMsg = function(sender,topic, method){
  return this.addSubscription(`${this.base}/${sender}/notify/${this.name}/${topic}`, method);
}
MqttMessages.bindNotifyMsg = function(receiver, topic, event){
  /* Similar to trigger; notify plugin regarding a particular topic */
  return this.addBinding(`${this.base}/${this.name}/notify/${receiver}/${topic}`, event);
}
MqttMessages.onStatusMsg = function(sender, method){
  return this.addSubscription(`${this.base}/status/${sender}`, method);
}
MqttMessages.bindStatusMsg = function(event){
  /* Broadcast plugin status */
  return this.addBinding(`${this.base}/status/${this.name}`, event);
}
MqttMessages.onTriggerMsg = function(action, method){
  return this.addSubscription(`${this.base}/trigger/${this.name}/${action}`, method);
}
MqttMessages.bindTriggerMsg = function(receiver, action, event){
  /* Trigger another plugin to perform an action */
  return this.addBinding(`${this.base}/trigger/${receiver}/${action}`, event);
}
MqttMessages.onSignalMsg = function(sender, topic, method){
  return this.addSubscription(`${this.base}/${sender}/signal/${topic}`, method);
}
MqttMessages.bindSignalMsg = function(topic, event){
  /* Signal other plugins about a topic (without knowledge of those plugins)*/
  return this.addBinding(`${this.base}/${this.name}/signal/${topic}`, event);
}

if (typeof module !== 'undefined' && module.exports) {
  // Check if being loaded from webpage, or as npm package
  module.exports = MqttMessages;
}
