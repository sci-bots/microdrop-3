if (!window.microdropPlugins) window.microdropPlugins = new Map();
if (!window.widgets) window.widgets = new Object();

// TODO: Find better method for inter-widget communication
window.eventHandler = new Object();
Object.assign(window.eventHandler, Backbone.Events);

eventHandler.on("plugin-loaded", (msg) => {
  // Load device view only when all dependent widges are loaded
  const name   = msg.name;
  const widget = msg.widget;
  const twoCanvas      = $(`<div id="two-canvas" style="position: absolute;"></div>`)[0];
  const container      = $(`<div id="container"></div>`)[0];
  const statsOutput    = $(`<div id="Stats-output"></div>`)[0];
  const controlHandles = $(`<svg id="controlHandles"></div>`)[0];
  window.widgets[name] = widget;

  if (!window.widgets.three) return;
  if (!window.widgets.dat) return;
  if (!window.widgets.electrode) return;

  container.appendChild(statsOutput);
  container.appendChild(controlHandles);
  document.body.appendChild(twoCanvas);
  document.body.appendChild(container);

  deviceView = new DeviceView(widgets.three, widgets.dat.gui);
  window.uicontroller = new UIController(deviceView);
});

class UIController extends MQTTClient {
  constructor(deviceView) {
    super("UIController");
    // TODO Bridge over DeviceUI into its own PluginController / MQTTClient
    this.deviceView = deviceView;
    this.device_ui_plugin = new DeviceUIPlugin(this.deviceView);
    this.device_ui_client = new MQTTClient("device-ui");
    this.device_ui_plugin.listen(this.device_ui_client.client);

    this.electrode_states = null;
    this.listen();
    this.render();
  }

  listen() {
    this.onStateMsg("device-model", "device", this.onDeviceUpdated.bind(this));
    this.onStateMsg("electrodes-model", "electrodes", this.onElectrodeStatesSet.bind(this));
    this.onPutMsg("routes", this.onRoutesUpdated.bind(this));
    // this.addGetRoute("microdrop/state/device", this.onDeviceUpdated.bind(this));
    // this.addGetRoute("microdrop/put/dmf-device-ui/state/electrodes", this.onElectrodeStatesSet.bind(this));
    // this.addGetRoute("microdrop/put/dmf-device-ui/state/routes", this.onRoutesUpdated.bind(this));
  }

  render() {
    this.deviceView.update();
    requestAnimationFrame(this.render.bind(this));
  }

  get name() {return "ui-controller"}
  get device() {return this.device_ui_plugin.device}
  set device(data) {
    const prevDevice = this.device;
    const prevElectrodeStates = this.electrodeStates;
    const prevRoutes = this.routesAsDataFrame;
    const device = new Device(data);
    this.device_ui_plugin.setDevice(device);
    window.device = device;
    // If no previous device, then load stored electrode and route states
    if (prevElectrodeStates) {
      this.electrodeStates = prevElectrodeStates;
    }
    if (prevRoutes) this.routesAsDataFrame = prevRoutes;
  }
  get electrodeStates() {return this._electrodeStates}
  set electrodeStates(electrodeStates) {
    this._electrodeStates = electrodeStates;
    if (this.device) {
      try {
        this.device_ui_plugin.applyElectrodeStates(this.electrodeStates);
      } catch (e) {
        console.error("Failed to apply electrode states");
        console.log(e);
      }
    }
  }

  get routesAsDataFrame() {return this._routesAsDataFrame}
  set routesAsDataFrame(df_routes) {
    this._routesAsDataFrame = df_routes;
    if (this.device) this.device_ui_plugin.setRoutes(this.routesAsDataFrame);
  }

  onDeviceUpdated(payload) {
    this.device = JSON.parse(payload);
  }
  onElectrodeStatesSet(payload) {
    console.log("Electrodes states set!!!!!");
    // TODO: Don't require mapping data to electrode_states key
    const data = JSON.parse(payload);
    this.electrodeStates = extractElectrodeStates({electrode_states: data});
  }
  onRoutesUpdated(payload) {
    const data = JSON.parse(payload);
    console.log("Drawing new routes...");
    console.log(data);
    if (data == null) return;
    const routesAsDataFrame = new DataFrame(data);
    this.routesAsDataFrame = routesAsDataFrame;
  }
}

class ThreeRenderer {
  static Widget(panel, dock, focusTracker) {
    const widget = new Widgets.ThreeRendererWidget();
    widget.title.label = "Device view";
    widget.title.closable = true;
    panel.addWidget(widget,  {mode: "tab-before", ref: dock});
    panel.activateWidget(widget);
    eventHandler.trigger("plugin-loaded", {name: "three", widget: widget});
    return widget;
  }
  static position() {
    /* topLeft, topRight, bottomLeft, or bottomRight */
    return "topLeft";
  }
}

class DatGui {
  static Widget(panel, dock, focusTracker) {
    const widget = new Widgets.DatGuiWidget({autoPlace: false});
    widget.title.label = "Options";
    widget.title.closable = true;
    panel.addWidget(widget,  {mode: "tab-before", ref: dock});
    panel.activateWidget(widget);

    eventHandler.trigger("plugin-loaded", {name: "dat", widget: widget});
    return widget;
  }
  static position() {
    /* topLeft, topRight, bottomLeft, or bottomRight */
    return "bottomRight";
  }
}

class ElectrodeSettings {
  static Widget(panel, dock, focusTracker) {
    const widget = new PhosphorWidgets.Widget();
    widget.addClass("content");
    widget.title.label = "Electrode Settings";
    widget.title.closable = true;
    panel.addWidget(widget,  {mode: "tab-before", ref: dock});
    panel.activateWidget(widget);
    eventHandler.trigger("plugin-loaded", {name: "electrode", widget: widget});
    return widget;
  }
  static position() {
    /* topLeft, topRight, bottomLeft, or bottomRight */
    return "topRight";
  }
}

class PlotWidget {
  static Widget(panel, dock, focusTracker){
    const data = new Object();
    data.x    = _.range(5);
    data.y    = _.range(5);
    data.type = "scatter";
    data.mode = "markers";

    const layout = new Object();
    layout.margin = {l: 40, r: 10, b: 40, t: 10};
    layout.xaxis  = {title: "time (s)"};
    layout.yaxis  = {title: "capacitance (F)"};

    const config = new Object();
    config.showLink = false;
    config.displaylogo = false;

    const widget = new PlotlyWidget({data: data, layout: layout, config: config});
    widget.title.label = "Plot";
    widget.title.closable = true;
    panel.addWidget(widget,  {mode: "tab-before", ref: dock});
    panel.activateWidget(widget);
    return widget;
  }
  static position() {
    return "bottomLeft";
  }
}

window.microdropPlugins.set("ThreeRenderer", ThreeRenderer);
window.microdropPlugins.set("DatGui", DatGui);
window.microdropPlugins.set("ElectrodeSettings", ElectrodeSettings);
window.microdropPlugins.set("PlotWidget", PlotWidget);
