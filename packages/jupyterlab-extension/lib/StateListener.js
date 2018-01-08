Object.defineProperty(exports, "__esModule", {value: true});

require('bootstrap/dist/css/bootstrap.css');
require('font-awesome/css/font-awesome.css');

var _ = require('lodash');
var $ = require('jquery');
var MicrodropAsync = require('@microdrop/async/MicrodropAsync');
var StaterSaverUI = require('@microdrop/state-saver');
var Mustache = require('mustache');
var {Widget, Panel, FocusTracker} = require('@phosphor/widgets');
var {ILayoutRestorer} = require('@jupyterlab/application');
var {IFrame, InstanceTracker, Toolbar, ToolbarButton} = require('@jupyterlab/apputils');
var {ILauncher} = require('@jupyterlab/launcher');
var {MimeDocumentFactory} = require('@jupyterlab/docregistry');

const MIME_TYPE = 'text/plain';
const MIME_TYPES = ['text/plain', 'text/microdrop+json', 'text/microdrop'];
const NAME = 'Microdrop';

const DIRTY_CLASS = 'jp-mod-dirty';


class StateListener extends StaterSaverUI {
  constructor(panel) {
    const widget = new Widget();
    super(widget.node);
    this.panel = panel;
    this.toolbar = new Toolbar();
    this.content = widget;
    this.panel.addWidget(this.toolbar);
    this.panel.addWidget(this.content);
    this._render = this.render.bind(this);
    this.ready = new Promise((resolve, reject) => {
      this.on('ready', () => {
        this.off('ready'); resolve(true);
      });
    });

    const save = new ToolbarButton({
      className: "jp-SaveIcon",
      tooltip: 'Save',
      style: {height: "auto"},
      onClick: this.save.bind(this)
    });

    this.toolbar.insertItem(0, 'save', save);
  }
  async isActive() {
    try {
      const microdrop = new MicrodropAsync();
      const activeFile = await microdrop.getState('state-listener', 'active-file', 200);
      const thisFile = _.get(this.panel, 'context.path');
      return activeFile == thisFile;
    } catch (e) {
      // XXX: Seems to odly timeout on page reload
      // console.error(e);
      return false;
    }
  }
  get hasFocus() { return true; }
  listen() {
    // Original
    this.bindStateMsg("steps", "set-steps");
    // this.onStateMsg("{pluginName}", "{val}", this.render.bind(this));
    this.draw();

    // Additional
    this.onStateMsg('{pluginName}', '{val}', this.onMsg.bind(this));
    this.bindStateMsg("active-file", "set-active-file");
    this.trigger("ready");
  }
  async load() {
    if (this.loaded) return;
    let state = JSON.parse(this.panel.model.value.text);
    // XXX: Ignore device-model.three-object until also used by viewer
    const ignore = ['device-model', 'state-listener.active-file'];
    state = _.omit(state, ignore);
    let missingRoutes = [];
    for (const [plugin,props] of Object.entries(state)) {
      const microdrop = new MicrodropAsync();
      // Get subscriptions for each plugin
      let subs;
      try { subs = await microdrop.getSubscriptions(plugin, 200);
      } catch (e) { subs = []; }
      for (const [k,v] of Object.entries(props)) {
        // Check if a put route exists for the given key
        if (_.includes(subs, `microdrop/put/${plugin}/${k}`)){
          let response;
          try {
            // XXX: Wrap message as object by default
            const msg = {};
            _.set(msg, k, v);
            response = await microdrop.putPlugin(plugin, k, msg, 1000);
          } catch (e) {
            // console.error(e);
          }
        } else {
          missingRoutes.push({plugin, k, v});
        }
      }
    }
    this.loaded = true;
  }
  async changeFile() {
    if (await this.isActive()) {
      this.panel.node.style.opacity = 1;
      this.panel.node.style.pointerEvents = 'auto';
      this._render = this.render.bind(this);
      this.load();
    } else {
      this.panel.node.style.opacity = 0.5;
      this.panel.node.style.pointerEvents = 'none';
      this._render = _.noop.bind(this);
      this.loaded = false;
    }
  }
  checkState() {
    // Check if working copy differs from saved copy
    const savedCopy = JSON.parse(this.panel.model.value.text);
    const workingCopy = this.json;
    let classname = this.panel.title.className;

    if (!_.isEqual(savedCopy, workingCopy)) {
      classname = _.concat(classname.split(' '), [DIRTY_CLASS]).join(' ');
      this.panel.model.dirty = true;
    } else {
      classname = _.without(classname.split(' '), DIRTY_CLASS).join(' ');
      this.panel.model.dirty = false;
    }
    this.panel.title.className = classname;
  }
  save() {
    this.panel.model.value.text = JSON.stringify(this.json);
    this.panel.context.save();
  }
  onMsg(payload, pluginName, val) {
    if (pluginName == 'web-server') return;
    this._render(payload, pluginName, val);
    this.checkState();
    if (pluginName == 'state-listener') {
      this.changeFile();
    }
    // _.set(this.json, `${pluginName}.${val}`, payload);
    // this.model.data[MIME_TYPE] = JSON.stringify(this.json);
  }
}

module.exports = StateListener;
