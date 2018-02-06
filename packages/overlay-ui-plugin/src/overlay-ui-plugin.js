require('!style-loader!css-loader!jsoneditor/dist/jsoneditor.min.css');
const JSONEditor = require('jsoneditor');
const generateName = require('sillyname');

const yo = require('yo-yo');
const UIPlugin = require('@microdrop/ui-plugin');

class OverlayUIPlugin extends UIPlugin {
  constructor(element, focusTracker) {
    super(element, focusTracker);
  }

  listen() {
    const options = {onChange: this.onChange.bind(this)};
    this.container = yo`<div></div>`;
    this.editor = new JSONEditor(this.container, options);
    this.overlays = {};
    this.view = "update";

    this.onStateMsg("device-model", "overlays", this.updateOverlays.bind(this));
    this.bindPutMsg("device-model", "overlay", "put-overlay");
    this.bindPutMsg("device-model", "overlays", "put-overlays");
    this.render();
  }

  updateOverlays(payload) {
    if (_.isEqual(payload, this.editor.get())) return;

    this.overlays = payload;
    if (this.view == "update") {
      this.editor.set(this.overlays);
      this.editor.setSchema(OVERLAY_SCHEMA);
    }
  }

  onChange() {
    if (this.view != "update") return;
    const obj = _.last(_.get(this.editor, "history.history"));
    if (!obj) return;

    if (obj.action == "editValue") {
      const index = _.get(obj, "params.node.parent.index");
    }
  }

  changeView(e) {
    this.view  = e.target.value;
    switch (this.view) {
      case "update":
      this.editor.set(this.overlays);
      this.editor.setSchema(OVERLAYS_SCHEMA);
      break;
      case "new":
      this.editor.set(SKELETON());
      this.editor.setSchema(OVERLAY_SCHEMA);
      break;
    }
  }

  submit(e) {
    switch (this.view) {
      case "update":
        this.trigger("put-overlays", this.editor.get());
        break;
      case "new":
        this.trigger("put-overlay", this.editor.get());
        break;
    }
  }
  render() {
    const name = `radios-${generateName()}`;

    this.element.innerHTML = "";
    this.element.appendChild(yo`
      <div>
        <input onclick=${this.changeView.bind(this)}
          name="${name}" type="radio" value="update" checked>
        <label>Update Overlays</label>

        <input onclick=${this.changeView.bind(this)}
          name="${name}" type="radio" value="new">
        <label>New Overlay</label>

        ${this.container}
        <button onclick=${this.submit.bind(this)}>Submit</button>
      </div>
    `);
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

const OVERLAYS_SCHEMA = {
  type: "array",
  items: OVERLAY_SCHEMA
};

const SKELETON = () => {
  const props = OVERLAY_SCHEMA.properties;
  const skeleton = _.zipObject(_.keys(props), _.map(props, "default"));
  skeleton.electrodes = {electrode000: {scale: 0.5, intensity: 3}};
  skeleton.name = generateName();

  return skeleton;
};

module.exports = OverlayUIPlugin;
module.exports.default = OverlayUIPlugin;
module.exports.OVERLAY_SCHEMA = OVERLAY_SCHEMA;
module.exports.OVERLAYS_SCHEMA = OVERLAYS_SCHEMA;
module.exports.maps = maps;
