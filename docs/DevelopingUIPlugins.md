# Developing Web/UI Plugins

There are no library dependencies/requirements asides from MQTT in order to develop plugins. For developers new to MQTT, see https://eclipse.org/paho/clients/js/

However, you are free to use 
[mqtt-client.js](https://github.com/Lucaszw/microdrop-3.0/blob/master/ui/src/mqtt-client.js)
or
[ui-plugin.js (which inherits from mqtt-client.js)](https://github.com/Lucaszw/microdrop-3.0/blob/master/ui/src/ui-plugin.js) as parents for you UI Plugins.

An API for the various core microdrop plugins is coming soon, but in the meantime the various messaging topics for each protocol can be found through investiating the plugin's source which using [mqtt-messages.js](https://github.com/Lucaszw/microdrop-3.0/blob/master/ui/src/mqtt-messages.js) as reference.

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
