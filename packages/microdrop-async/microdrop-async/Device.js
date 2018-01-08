const Ajv = require('ajv');
const lo = require('lodash');

let fs, path;
try {
  fs = require('fs');
  path = require('path');
} catch (e) {};

const DEFAULT_TIMEOUT = 10000;
const ajv = new Ajv({useDefaults: true});

class Device {
  constructor(ms) {
    this.ms = ms;
  }

  async threeObject() {
    const LABEL = "<MicrodropAsync::Device::threeObject>";
    try {
      const response = await this.ms.getState("device-model", "three-object");
      return response;
    } catch (e) {
      throw(this.ms.dumpStack(LABEL, e));
    }
  }
  async putThreeObject(threeObject, timeout=DEFAULT_TIMEOUT) {
    /* Send three js group object to backend for physics manipulation */
    const LABEL = "<MicrodropAsync::Device::putThreeObject>";
    try {
      const msg = {
        __head__: {plugin_name: this.ms.name},
        "three-object": threeObject
      };
      const response = await this.ms.putPlugin(
        "device-model", "three-object", msg, timeout);
      return response;
    } catch (e) {
      throw(this.ms.dumpStack(LABEL, e));
    }
  }

  async getNeighbouringElectrodes(electrodeID, timeout=DEFAULT_TIMEOUT) {
    /* Get electrodes in all four directions */
    const LABEL = "<MicrodropAsync::Device::getNeighbouringElectrodes>";
    try {
      const msg = {
        __head__: {plugin_name: this.ms.name},
        electrodeId: electrodeID
      };
      const r = await this.ms.triggerPlugin(
        "device-model", "get-neighbouring-electrodes", msg, timeout
      );
      return r.response;
    } catch (e) {
      throw(this.ms.dumpStack(LABEL, e));
    }
  }

  async electrodesFromRoutes(routes, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Device::electrodesFromRoutes>";
    const msg = {};
    try {
      if (!lo.isArray(routes)) throw("routes should be array");
      lo.set(msg, "__head__.plugin_name", this.ms.name);
      lo.set(msg, "routes", routes);
      const payload = await this.ms.triggerPlugin("device-model",
        "electrodes-from-routes", msg, timeout);
      return payload.response;
    } catch (e) {
      throw(this.ms.dumpStack(LABEL, e));
    }
  }

  async electrodesFromRoute(route, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Device::electrodesFromRoute>";
    try {
      if (!lo.isPlainObject(route)) throw("route should be plain object");
      const validate = ajv.compile(this.ms.routes.RouteSchema);
      if (!validate(route)) throw(validate.errors);

      const seqs = await this.electrodesFromRoutes([route]);
      return seqs[0];
    } catch (e) {
      console.error("ERRR", e);
      throw(this.ms.dumpStack(LABEL, e));
    }
  }

  static get maps() {
    return ["jet", "hot", "cool", "spring", "summer", "autumn", "winter",
    "bone", "copper", "greys", "greens", "bluered", "rainbow", "portland",
    "blackbody", "earth", "electric", "viridis", "inferno", "magma", "plasma", "RdBu",
    "warm", "bathymetry", "chlorophyll", "density",
    "freesurface-blue", "freesurface-red", "oxygen", "par", "phase", "salinity",
    "temperature", "turbidity", "velocity-blue", "velocity-green"];
  }

  static get OverlaySchema() {
    return {
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
        colorMap: {type: "string",  default: "temperature", enum: Device.maps},
        numEdges: {type: "integer", default: 30, minimum: 3, maximum: 30},
        colorAll: {type: "boolean", default: true},
        shapeAll: {type: "boolean", default: false}
      },
      required: ["electrodes", "name", "type", "visible"]
    };
  }
}

module.exports = Device;
