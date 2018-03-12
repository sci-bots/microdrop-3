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
const ElectrodeControls =
  require('@microdrop/device-controller/src/electrode-controls');

const APPNAME = 'microdrop';
const DEFAULT_PPI = 96;

const ajv = new Ajv({useDefaults: true});
const console = new Console(process.stdout, process.stderr);
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled rejection (promise: ', event.promise, ', reason: ', event.reason, ').');
});
window.addEventListener('error', function(e) {
    console.error(e.message);
});

const DeviceSchema = {
  type: "object",
  properties: {
    "three-object": {
      type: "array",
      default: [],
      per_step: false,
      items: {
        id: {
          type: "string",
          pattern: "^electrode",
          set_with: "three-object"
        },
        translation: {
          type: "integer"
        },
        area: {
          type: "integer",
          set_with: 'three-object'
        }
      }
    },
    "ppi": {
      type: "integer",
      default: 96,
      per_step: false
    }
  }
};

class DeviceModel extends MicropedeClient {
  constructor (appname=APPNAME, host, port, ...args) {
    console.log("Initializing Device Model");
    super(appname, host, port, ...args);
    this.scene = null;
    this.group = null;
    this.port = port;
    this.schema = DeviceSchema;
    ElectrodeControls.SetConsole();
  }

  listen() {
    this.onStateMsg('device-model', 'ppi', this.setPPI.bind(this));
    this.onStateMsg("device-model", "three-object", this.setThreeObject.bind(this));
    this.onTriggerMsg("get-neighbouring-electrodes", this.getNeighbouringElectrodes.bind(this));
    this.onTriggerMsg("electrodes-from-routes", this.electrodesFromRoutes.bind(this));
    this.onTriggerMsg("get-area", this.getArea.bind(this));
    this.onPutMsg("three-object", this.putThreeObject.bind(this));
    this.onPutMsg("overlay", this.putOverlay.bind(this));
    this.onPutMsg("overlays", this.putOverlays.bind(this));
    this.onPutMsg('ppi', this.putPPI.bind(this));
    this.sendIpcMessage('device-model-ready');
  }

  get isPlugin() {return true}
  get channel() {return "microdrop/device"}
  get filepath() {return __dirname;}

  setThreeObject(threeObject) {
    if (this.scene != null) return;
    const {scene, group} = SVGRenderer.ConstructScene(threeObject);
    this.scene = scene;
    this.group = group;
  }

  setPPI(ppi) { this.ppi = ppi }
  async putPPI(payload, params) {
    /* Calculate the area for a given electrode*/
    const LABEL = 'device-model:putPPI';
    try {
      await this.setState('ppi', payload.ppi);
      return this.notifySender(payload, payload.ppi, 'ppi');
    } catch (e) {
      console.error(LABEL, e);
      return this.notifySender(payload, DumpStack(LABEL, e), 'ppi', 'failed');
    }
  }

  getArea(payload, params) {
    /* Calculate the area for a given electrode*/
    const LABEL = 'device-model:getArea';
    try {
      if (this.group == undefined ) throw `three js group objects not defined`;
      if (!payload.electrode) throw `missing electrode id`;
      const area = ElectrodeControls.GetArea(this.group, payload.electrode, this.ppi);
      return this.notifySender(payload, area, "get-area");
    } catch (e) {
      console.error(LABEL, e);
      return this.notifySender(payload, DumpStack(LABEL, e),
        "get-area", 'failed');
    }
  }

  electrodesFromRoutes(payload) {
    /* Validate that a path is possible on the current device */
    const LABEL = `<DeviceModel::electrodesFromRoutes>`; //console.log(LABEL);
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
          const n = ElectrodeControls.FindNeighbourInDirection(this.group, id, dir);
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
    const LABEL = `<DeviceModel::getNeighbouringElectrodes>`; //console.log(LABEL);
    try {
      if (!this.scene) throw("scene undefined");
      if (!this.group) throw("group undefined");
      if (!payload.electrodeId) throw("expected 'electrodeId' in payload");
      const electrodeId = payload.electrodeId;
      const neighbours = ElectrodeControls.FindAllNeighbours(this.group, electrodeId);
      return this.notifySender(payload, neighbours,
        "get-neighbouring-electrodes");
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e),
        "get-neighbouring-electrodes", 'failed');
    }
  }


  async putOverlays(payload) {
    const LABEL = `<DeviceModel::putOverlays`; //console.log(LABEL);
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
    // console.log(LABEL);
    const microdrop = new MicropedeAsync(APPNAME, 'localhost', this.port);
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

  updatePPIUsingElectrodeArea(threeObject, ppi, id) {
    let electrode = _.find(threeObject, {id});
    if (electrode == undefined) return ppi;

    let realArea = electrode.area;
    let expectedArea = ElectrodeControls.GetArea(this.group, electrode.id, ppi);
    if (realArea == expectedArea) return ppi;

    let expectedPPI = ppi;
    ppi = Math.sqrt(Math.abs((Math.pow(expectedPPI, 2) * expectedArea) / (realArea))) ;
    return ppi;
  }

  async putThreeObject(payload) {
    const LABEL = `<DeviceModel::putThreeObject>`;
    console.log(LABEL);
    try {
      const threeObject = payload["three-object"] || payload["threeObject"];
      if (!threeObject) throw("expected 'three-object' in payload");
      let ppi = payload.ppi ? payload.ppi : DEFAULT_PPI;

      await this.setState('ppi', ppi);

      // Initialize scene
      const {scene, group} = SVGRenderer.ConstructScene(threeObject);
      this.scene = scene;
      this.group = group;

      let ppiChanged = false;
      // Check if user changed electrode area, and update ppi accordingly
      if (payload.electrodeId != undefined) {
        let id = payload.electrodeId;
        ppi = this.updatePPIUsingElectrodeArea(threeObject, ppi, id);
        await this.setState('ppi', ppi);
        ppiChanged = true;
      }

      // Compute area for every electrode
      _.each(threeObject, (obj) => {
        if (obj.area && !ppiChanged) return;
        obj.area = ElectrodeControls.GetArea(this.group, obj.id, ppi);
      });

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
