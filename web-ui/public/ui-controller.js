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
    this.addGetRoute("microdrop/state/device", this.onDeviceUpdated.bind(this));
    this.addGetRoute("microdrop/put/dmf-device-ui/state/electrodes", this.onElectrodeStatesSet.bind(this));
    this.addGetRoute("microdrop/put/dmf-device-ui/state/routes", this.onRoutesUpdated.bind(this));
  }

  render() {
    this.deviceView.update();
    requestAnimationFrame(this.render.bind(this));
  }

  get device() {return this.device_ui_plugin.device}
  set device(data) {
    const prevDevice = this.device;
    const prevElectrodeStates = this.electrodeStates;
    const prevRoutes = this.routesAsDataFrame;
    const device = new Device(data);
    this.device_ui_plugin.setDevice(device);
    window.device = device;
    // If no previous device, then load stored electrode and route states
    if (prevElectrodeStates) this.electrodeStates = prevElectrodeStates;
    if (prevRoutes) this.routesAsDataFrame = prevRoutes;
  }
  get electrodeStates() {return this._electrodeStates}
  set electrodeStates(electrodeStates) {
    this._electrodeStates = electrodeStates;
    if (this.device) {
      try {
        this.device_ui_plugin.applyElectrodeStates(this.electrodeStates);
      } catch (e) { console.error("Failed to apply electrode states"); }
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
    // TODO: Don't require mapping data to electrode_states key
    const data = JSON.parse(payload);
    this.electrodeStates = extractElectrodeStates({electrode_states: data});
  }
  onRoutesUpdated(payload) {
    const data = JSON.parse(payload);
    if (data == null) return;
    const routesAsDataFrame = new DataFrame(data);
    this.routesAsDataFrame = routesAsDataFrame;
  }

}
