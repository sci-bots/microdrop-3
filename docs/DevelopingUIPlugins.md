# Developing Web/UI Plugins

There are no library dependencies/requirements asides from MQTT in order to develop plugins. For developers new to MQTT, see https://eclipse.org/paho/clients/js/

However, you are free to use 
[mqtt-client.js](https://github.com/Lucaszw/microdrop-3.0/blob/master/ui/src/mqtt-client.js)
or
[ui-plugin.js (which inherits from mqtt-client.js)](https://github.com/Lucaszw/microdrop-3.0/blob/master/ui/src/ui-plugin.js) as parents for you UI Plugins.

An API for the various core microdrop plugins is coming soon, but in the meantime the various messaging topics for each protocol can be found through investiating the plugin's source which using [mqtt-messages.js](https://github.com/Lucaszw/microdrop-3.0/blob/master/ui/src/mqtt-messages.js) as reference.

Plugins should be ES6 classes, and accept a dom node (elem), and a PhosphorJS FocusTracker object:
```javascript
  class SamplePlugin extends UIPlugin {
    constructor(elem, focusTracker) {
      ...
    }
```

## Available Libraries

Currently, plugins cannot access their own external libraries. However, the following libraries are exposed through [libDeviceUIPlugin.js](https://github.com/Lucaszw/webui.js/blob/master/src/libDeviceUIPlugin.js)

## Positioning Plugin

Your plugin class must include a static method called position() which returns either:

topLeft, topRight, bottomLeft, or bottomRight. This will determine where the plugin will be anchored on Microdrops UI.
```javascript
  static position() {
    /* topLeft, topRight, bottomLeft, or bottomRight */
    return "bottomLeft";
  }
```

## Publishing and Subscribing to MQTT Topics

Each plugin should contain it's own MQTT Client. 
See https://eclipse.org/paho/clients/js/ . If your plugin extends MQTTClient or UIPlugin, then a MQTTClient will be instantuated on super().

The default microdrop plugins all use the following hierarchy depending on the message:

State Messages (persistant storage of microdrop properties such as electrodes, routes, and devices):

**microdrop/{plugin-model/sender}/state/{model property}**

State Error Messages (triggered when microdrop drop property fails to update after put)

**microdrop/{plugin-model/sender}/error/{model property}**

Put Messages (Use for requesting a plugin to change one of its properties)

**microdrop/put/{sender}/{model property}**

Notify Messages (Send notification to another plugin)

**microdrop/notify/{sender}/{topic}**

Status Messages (A non-descriminate status message)

**microdrop/status/{sender}**

Trigger Message (Use to trigger actions between plugins)

**microdrop/trigger/{sender}/{action}**

Signal Message (A non-descriminate message w/ topic)

**microdorp/{sender}/signal/{topic}**

## Sample Web Plugin Skeleton:
```javascript
class SamplePlugin extends UIPlugin {
  constructor(elem, focusTracker) {
    super(elem, focusTracker, "SamplePlugin");
    this.ui = this.UI();
    this.listen();
  }
  
  listen() {
    // protocol-model, electrode-model, routes-model, device-model...
    this.onStateMsg("some-model", "some-property", this.onSomePropertyUpdated.bind(this));
    this.onSignalMsg("{plugin}", "some-signal", this.onSomeSignal.bind(this));
    this.bindPutMsg("some-model", "some-property", "put-some-property");
  }
  
  someMethod() {
    ...
    this.trigger("put-some-propert", this.wrapData("keyname",some_property));
  }
  wrapData(key, value) {
    const msg = new Object();
    msg.__head__ = this.DefaultHeader();
    msg[key] = value;
    return msg;
  }
  get ui() {return this._ui}
  set ui(ui) {
    if (this.ui) this.element.removeChild(this.ui);
    if (ui) this.element.appendChild(ui);
    this._ui = ui;
  }

  onSomePropertyUpdated(payload) {
    this.some_property = JSON.parse(payload);
    ...
  }
  
  onSomeSignal(payload, pluginName) { ...
  
  UI() {
    // Textfield:
    const node = $("<b>Hello World</b>")[0];
    return node;
  }

  static position() {
    /* topLeft, topRight, bottomLeft, or bottomRight */
    return "bottomLeft";
  }
}

if (!window.microdropPlugins) window.microdropPlugins = new Map();
window.microdropPlugins.set("SamplePlugin", SamplePlugin);
```
