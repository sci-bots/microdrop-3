/* Mixins for Mqtt Messages */
const MqttMessages = new Object();

MqttMessages.addSubscription = function(channel, method){
  this.addRoute(channel, method);
  this.subscriptions.push(channel.replace(/\{(.+?)\}/g, "+"));
}
MqttMessages.addBinding = function(channel, event, retain=false, qos=0, dup=false){
  this.on(event, (d) => this.sendMessage(channel, d, retain, qos, dup));
}
MqttMessages.onStateMsg = function(sender, val, method){
  this.addSubscription(`${this.base}/${sender}/state/${val}`, method);
}
MqttMessages.bindStateMsg = function(val, event) {
  /* Notify plugins that state has successfully been modified */
  this.addBinding(`${this.base}/${this.name}/state/${val}`, event, true);
}
MqttMessages.onStateErrorMsg = function(sender, val, method){
  this.addSubscription(`${this.base}/${sender}/error/${val}`, method);
}
MqttMessages.bindStateErrorMsg = function(val, event){
  /* Notify plugins upon failure to change state */
  this.addBinding(`${this.base}/${this.name}/error/${val}`, event);
}
MqttMessages.onPutMsg = function(val, method){
  this.addSubscription(`${this.base}/put/${this.name}/${val}`, method);
}
MqttMessages.bindPutMsg = function(receiver, val, event){
  /* Request plugin to change the state of one of its variables */
  this.addBinding(`${this.base}/put/${receiver}/${val}`, event);
}
MqttMessages.onNotifyMsg = function(topic, method){
  this.addSubscription(`${this.base}/notify/${this.name}/${topic}`, method);
}
MqttMessages.bindNotifyMsg = function(receiver, topic, event){
  /* Similar to trigger; notify plugin regarding a particular topic */
  this.addBinding(`${this.base}/notify/${receiver}/${topic}`, event);
}
MqttMessages.onStatusMsg = function(sender, method){
  this.addSubscription(`${this.base}/status/${sender}`, method);
}
MqttMessages.bindStatusMsg = function(event){
  /* Broadcast plugin status */
  this.addBinding(`${this.base}/status/${this.name}`, event);
}
MqttMessages.onTriggerMsg = function(action, method){
  this.addSubscription(`${this.base}/trigger/${this.name}/${action}`, method);
}
MqttMessages.bindTriggerMsg = function(receiver, action, event){
  /* Trigger another plugin to perform an action */
  this.addBinding(`${this.base}/trigger/${receiver}/${action}`, event);
}
MqttMessages.onSignalMsg = function(sender, topic, method){
  this.addSubscription(`${this.base}/${sender}/signal/${topic}`, method);
}
MqttMessages.bindSignalMsg = function(topic, event){
  /* Signal other plugins about a topic (without knowledge of those plugins)*/
  this.addBinding(`${this.base}/${this.name}/signal/${topic}`, event);
}

if (typeof module !== 'undefined' && module.exports) {
  // Check if being loaded from webpage, or as npm package
  module.exports = MqttMessages;
}
