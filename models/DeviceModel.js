const THREE = require('three');
const _ = require('lodash');
const uuid = require('uuid/v4');

const MicrodropAsync = require('@microdrop/async');
const SVGRenderer = require('@microdrop/device-controller/src/svg-renderer');
const {FindNeighbourInDirection, FindAllNeighbours} =
  require('@microdrop/device-controller/src/electrode-controls');

const PluginModel = require('./PluginModel');

const DIRECTIONS = {LEFT: "left", UP: "up", DOWN: "down", RIGHT: "right"};

class DeviceModel extends PluginModel {
  constructor () {
    super();
    this.microdrop = new MicrodropAsync();
    this.scene = null;
    this.group = null;
  }
  listen() {
    this.onStateMsg("device-model", "three-object", this.setThreeObject.bind(this));
    this.onTriggerMsg("load-device", this.onLoadDevice.bind(this));
    this.onTriggerMsg("get-neighbouring-electrodes", this.getNeighbouringElectrodes.bind(this));
    this.onTriggerMsg("electrodes-from-routes", this.electrodesFromRoutes.bind(this));
    this.onPutMsg("three-object", this.onPutThreeObject.bind(this));
    this.onPutMsg("device", this.onPutDevice.bind(this));
    this.bindPutMsg("device_info_plugin", "device", "put-device");
    this.bindStateMsg("device", "device-set");
    this.bindStateMsg("three-object", "set-three-object");
  }
  get name() {return "device-model" }
  get channel() {return "microdrop/device"}
  get device() {return this._device}
  set device(device) {this._device = device}
  get filepath() {return __dirname;}

  setThreeObject(threeObject) {
    const {scene, group} = SVGRenderer.ConstructScene(threeObject);
    this.scene = scene;
    this.group = group;
  }

  electrodesFromRoutes(payload) {
    /* Validate that a path is possible on the current device */
    const LABEL = `<DeviceModel::electrodesFromRoutes>`;
    try {
      let routes = payload.routes;
      let length = routes.length;

      // Validate input payload:
      if (!routes) throw("expecting routes in payload");
      if (!_.isArray(routes)) throw("routes should be array");

      // Create new uuid if only one route

      if (length == 1 && routes[0].uuid == undefined) {
        routes[0].uuid = uuid();
      }

      const electrodes = [];

      for (const [i, r] of routes.entries()) {
        // Validate route keys
        if (!r.start) throw(`expected key 'start' in route # ${i}`);
        if (!r.path) throw(`expected key 'path' in route # ${i}`);
        if (!r.uuid) throw(`expected key 'uuid' in route # ${i}`);
        if (!_.isString(r.start)) throw(`route[${i}].start should be a string`);
        if (!_.isArray(r.path)) throw(`route[${i}].path should be an array`);

        // Ensure that route is compatible with loaded device
        const uuid = r.uuid;
        let id = r.start;
        let dir;
        const ids = [id];
        for (const [i, dir] of r.path.entries()) {
          const n = FindNeighbourInDirection(this.group, id, dir);
          if (!n || _.isEmpty(n)) throw(`Failed to get step at index ${i}`);
          if (n.id == undefined)  throw(`missing key 'id' at step ${i}`);
          ids.push(n.id);
          id = n.id;
        }
        electrodes.push({ids, uuid});
      }
      return this.notifySender(payload, electrodes, "electrodes-from-routes");
    } catch (e) {
      e =  e.toString().split(",").join("\n");
      return this.notifySender(payload, [LABEL, e],
        "electrodes-from-routes", 'failed');
    }
  }

  getNeighbouringElectrodes(payload) {
    const LABEL = `<DeviceModel::getNeighbouringElectrodes>`;
    try {
      if (!this.scene) throw("scene undefined");
      if (!this.group) throw("group undefined");
      if (!payload.electrodeId) throw("expected 'electrodeId' in payload");
      const electrodeId = payload.electrodeId;
      const neighbours = FindAllNeighbours(this.group, electrodeId);
      return this.notifySender(payload, neighbours,
        "get-neighbouring-electrodes");
    } catch (e) {
      return this.notifySender(payload, [LABEL, e.toString()],
        "get-neighbouring-electrodes", 'failed');
    }
  }

  async onPutThreeObject(payload) {
    const LABEL = `<DeviceModel::onPutThreeObject>`;
    try {
      const threeObject = payload["three-object"] || payload["threeObject"];
      if (!threeObject) throw("expected 'three-object' in payload");
      this.trigger("set-three-object", threeObject);
      return this.notifySender(payload, 'success', "three-object");
    } catch (e) {
      return this.notifySender(payload, [LABEL, e.toString()], "three-object", 'failed');
    }
    return object;
  }

  async onPutDevice(payload) {
    const LABEL = `<DeviceModel#onPutDevice>`; console.log(LABEL);
    try {
      let device;
      // Validate payload
      if (payload.device){
        device = payload.device;
      } else {
        console.error(LABEL, "expected key: 'device' in payload");
        device = payload;
      }
      this.trigger("device-set", this.wrapData(null,device));
      await this.microdrop.electrodes.reset();
      return this.notifySender(payload, device, "device");
    } catch (e) {
      return this.notifySender(payload, [LABEL, e.toString()] , "device");
    }
  }

  onLoadDevice(payload) {
    const receiver = this.getReceiver(payload);
    const _this = this;
    let callback;
    callback = (response) => {
      this.off("device-set", callback);
      return this.notifySender(payload, response, 'load-device');
    };
    this.on("device-set", callback);
    this.trigger("put-device", this.wrapData(null,payload));
  }

  // ** Overrides **
  onStart(payload) {
    this.trigger("plugin-started",__dirname);
  }
}

module.exports = DeviceModel;
