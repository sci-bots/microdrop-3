require('!style-loader!css-loader!jsoneditor/dist/jsoneditor.min.css');
const JSONEditor = require('jsoneditor');
const generateName = require('sillyname');

const yo = require('yo-yo');
const UIPlugin = require('@microdrop/ui-plugin');

const MicrodropAsync = require('@microdrop/async/MicrodropAsync');

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
      this.editor.setSchema(MicrodropAsync.Device.OverlaySchema);
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
      this.editor.setSchema(MicrodropAsync.Device.OverlaySchema);
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

  textEntered(e) {
    if (e.key != 'Enter') return;
    // Setup canvas
    const canvas = document.getElementById("overlay-ui-plugin:canvas");
    const ctx = canvas.getContext("2d");
    ctx.save();

    const txt = e.srcElement.value;
    ctx.clearRect(0,0,canvas.width, canvas.height);

    // Get required fontsize to span canvas
    const prevFontSize = 30;
    ctx.font = `${prevFontSize}px Courier`;
    const prevWidth = ctx.measureText(txt).width;
    const newFontSize = (canvas.width * prevFontSize)/prevWidth;

    // Adjust font to match canvas width, and scale to match canvas height
    ctx.font = `${newFontSize}px Courier`;
    // const newHeight = ctx.measureText(txt).height;
    console.log(newFontSize, canvas.height, newFontSize/canvas.height);
    ctx.scale(1, 1.6*canvas.height/newFontSize);
    ctx.fillText(txt,0,newFontSize/1.6);
    ctx.restore();

    console.log("A key was pressed!!", );
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
        <input type="text" onkeydown=${this.textEntered.bind(this)} />
        <canvas id="overlay-ui-plugin:canvas" width="300" height="400"
        style="border:1px solid #d3d3d3;">
        </canvas>
        <button onclick=${this.submit.bind(this)}>Submit</button>
      </div>
    `);
  }
}

const OVERLAYS_SCHEMA = {
    type: "array",
    items: MicrodropAsync.Device.OverlaySchema
};

const SKELETON = () => {
  const props = MicrodropAsync.Device.OverlaySchema.properties;
  const skeleton = _.zipObject(_.keys(props), _.map(props, "default"));
  skeleton.electrodes = {electrode000: {scale: 0.5, intensity: 3}};
  skeleton.name = generateName();

  return skeleton;
};

module.exports = OverlayUIPlugin;
