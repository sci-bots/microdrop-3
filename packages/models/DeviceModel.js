const fs = require('fs');
const path = require('path');
const uuid = require('uuid/v4');
const {Console} = require('console');

const Ajv = require('ajv');
const THREE = require('three');
const _ = require('lodash');

const MicropedeAsync = require('@micropede/client/src/async.js');
const {MicropedeClient, DumpStack} = require('@micropede/client/src/client.js');
const SVGRenderer = require('@microdrop/device-controller/src/svg-renderer');
const {FindNeighbourInDirection, FindAllNeighbours} =
  require('@microdrop/device-controller/src/electrode-controls');

const APPNAME = 'microdrop';
const MQTT_PORT = 1884;

const ajv = new Ajv({useDefaults: true});
const console = new Console(process.stdout, process.stderr);
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled rejection (promise: ', event.promise, ', reason: ', event.reason, ').');
});
window.addEventListener('error', function(e) {
    console.error(e.message);
});


class DeviceModel extends MicropedeClient {
  constructor () {
    console.log("Initializing Device Model");
    super(APPNAME, 'localhost', MQTT_PORT);
    this.scene = null;
    this.group = null;
  }
  listen() {
    this.onStateMsg("device-model", "three-object", this.setThreeObject.bind(this));
    this.onTriggerMsg("get-neighbouring-electrodes", this.getNeighbouringElectrodes.bind(this));
    this.onTriggerMsg("electrodes-from-routes", this.electrodesFromRoutes.bind(this));
    this.onPutMsg("three-object", this.putThreeObject.bind(this));
    this.onPutMsg("overlay", this.putOverlay.bind(this));
    this.onPutMsg("overlays", this.putOverlays.bind(this));
    // this.bindStateMsg("three-object", "set-three-object");
    // this.bindStateMsg("overlays", "set-overlays");
  }
  get isPlugin() {return true}
  get channel() {return "microdrop/device"}
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
      return this.notifySender(payload, DumpStack(LABEL, e),
        "electrodes-from-routes", 'failed');
    }
  }

  getNeighbouringElectrodes(payload) {
    const LABEL = `<DeviceModel::getNeighbouringElectrodes>`; console.log(LABEL);
    try {
      if (!this.scene) throw("scene undefined");
      if (!this.group) throw("group undefined");
      if (!payload.electrodeId) throw("expected 'electrodeId' in payload");
      const electrodeId = payload.electrodeId;
      const neighbours = FindAllNeighbours(this.group, electrodeId);
      return this.notifySender(payload, neighbours,
        "get-neighbouring-electrodes");
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e),
        "get-neighbouring-electrodes", 'failed');
    }
  }


  async putOverlays(payload) {
    const LABEL = `<DeviceModel::putOverlays`; //console.log(LABEL);
    console.log(LABEL);
    try {
      for (const [i, overlay] of payload.entries()) {
        this.validateOverlay(overlay);
      }
      await this.setState('overlays', payload);
      return this.notifySender(payload, payload, "overlays");
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e), "overlays", 'failed');
    }
  }

  async putOverlay(payload) {
    const LABEL = `<DeviceModel::putOverlay>`;
    console.log(LABEL);
    const microdrop = new MicropedeAsync(APPNAME, 'localhost', MQTT_PORT);
    try {
      payload = this.validateOverlay(payload);

      let overlays;
      try {
        overlays = await microdrop.getState('device-model', "overlays", 500);
      } catch (e) {
        overlays = [];
      }
      const index = _.findIndex(overlays, {name: payload.name});
      if (index == -1) {
        overlays.push(payload);
      } else {
        overlays[index] = payload;
      }
      await this.setState('overlays', overlays);
      return this.notifySender(payload, overlays[index], "overlay");
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e), "overlay", 'failed');
    }
  }

  validateOverlay(overlay) {
    const validate = ajv.compile(OVERLAY_SCHEMA);
    if (!validate(overlay)) throw(validate.errors);
    return overlay;
  }

  async putThreeObject(payload) {
    const LABEL = `<DeviceModel::putThreeObject>`;
    console.log(LABEL);
    try {
      const threeObject = payload["three-object"] || payload["threeObject"];
      if (!threeObject) throw("expected 'three-object' in payload");
      await this.setState('three-object', threeObject);
      return this.notifySender(payload, 'success', "three-object");
    } catch (e) {
      console.error(LABEL, e);
      return this.notifySender(payload, DumpStack(LABEL, e), "three-object", 'failed');
    }
    return object;
  }

  // ** Overrides **
  onStart(payload) {
    this.trigger("plugin-started",__dirname);
  }
}

const maps = ["jet", "hot", "cool", "spring", "summer", "autumn", "winter",
"bone", "copper", "greys", "greens", "bluered", "rainbow", "portland",
"blackbody", "earth", "electric", "viridis", "inferno", "magma", "plasma", "RdBu",
"warm", "bathymetry", "chlorophyll", "density",
"freesurface-blue", "freesurface-red", "oxygen", "par", "phase", "salinity",
"temperature", "turbidity", "velocity-blue", "velocity-green"];

const OVERLAY_SCHEMA = {
  type: "object",
  properties: {
    electrodes: {
      type: "object",
      patternProperties: {
        "^(electrode[0-9]+)+$": {
          type: "object",
          properties: {
            scale: {type: "number", default: 0.5},
            intensity: {type: "integer", default: 3}
          }
        }
      }
    },
    name: {type: "string"},
    type: {type: "string", default: "colormap", enum: ["colormap", "shapemap", "both"]},
    visible: {type: "boolean", default: true},
    colorRange: {type: "integer", default:10, minimum: 10},
    shapeScale: {type: "number", default: 0.5, minimum: 0.1, maximum: 2},
    colorMap: {type: "string",  default: "temperature", enum: maps},
    numEdges: {type: "integer", default: 30, minimum: 3, maximum: 30},
    colorAll: {type: "boolean", default: true},
    shapeAll: {type: "boolean", default: false}
  },
  required: ["electrodes", "name", "type", "visible"]
};


module.exports = DeviceModel;

if (require.main === module) {
  try {
    console.log("STARTING DEVICE MODEL");
    model = new DeviceModel();
  } catch (e) {
    console.error('DeviceModel failed!', e);
  }
}
