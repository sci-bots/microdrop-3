Object.defineProperty(exports, "__esModule", {value: true});

require('bootstrap/dist/css/bootstrap.css');
require('font-awesome/css/font-awesome.css');

var _ = require('lodash');
var $ = require('jquery');
var MicroDropAsync = require('@microdrop/async/MicroDropAsync');
var Mustache = require('mustache');
var {Widget, Panel, FocusTracker} = require('@phosphor/widgets');
var {ILayoutRestorer} = require('@jupyterlab/application');
var {IFrame, InstanceTracker, Toolbar, ToolbarButton} = require('@jupyterlab/apputils');
var {ILauncher} = require('@jupyterlab/launcher');
var {MimeDocumentFactory} = require('@jupyterlab/docregistry');

var StateListener = require('./StateListener');

const MIME_TYPE = 'text/plain';
const MIME_TYPES = ['text/plain', 'text/microdrop+json', 'text/microdrop'];
const NAME = 'MicroDrop';

const DIRTY_CLASS = 'jp-mod-dirty';

class UIPluginLauncher extends MicroDropAsync.MqttClient {
  constructor(panel) {
    super("UIPluginLauncher");
    this.panel = panel;
    this.loaded = false;
    this.renderToolbar();
    if (this.panel.url)
      this.loadIframe(this.panel.url, this.panel.pluginName);
  }
  listen() {
    this.onStateMsg("web-server", "web-plugins", this.onWebPluginsChanged.bind(this));
    this.on("btn-clicked", this.onButtonClicked.bind(this));
  }
  loadIframe(url, name) {
    this.panel.node.innerHTML = "";
    delete this.toolbar;
    this.renderToolbar();
    this.iframe = new IFrame();
    this.iframe.url = url;
    this.panel.title.label = name;
    this.panel.addWidget(this.iframe);
    this.loaded = true;
  }
  onButtonClicked(data) {
    // TODO: Add subscription to get base microdrop url: (ex. localhost:3000)
    const url = `http://localhost:3000/${data.pluginView}`;
    this.panel.url = url;
    this.panel.pluginName = data.pluginName;
    this.loadIframe(url, data.pluginName);
    this.trigger("update");
  }
  onWebPluginsChanged(payload) {
    if (this.loaded) return;

    const webPlugins = _.values(payload);
    const views = new Array();
    for (const webPlugin of webPlugins) {
      const name = webPlugin.name;
      const view = `${webPlugin.name}/build/index.html`;
      views.push({name, view});
    }

    this.render(views);
    const btns =
      this.panel.node.getElementsByClassName("microdrop-ui-plugin-btn");
    for (const btn of btns)
      btn.addEventListener("click", () => this.trigger("btn-clicked", btn.dataset));
  }
  renderToolbar() {
    this.toolbar = new Toolbar();
    this.panel.addWidget(this.toolbar);

    const save = new ToolbarButton({
      className: "jp-SaveIcon",
      tooltip: 'Save',
      style: {height: "auto"},
      onClick: () => {_.noop()}});

    save.node.style.height = "auto";
    this.toolbar.insertItem(0, 'save', save);
  }
  render(data) {
    const output = Mustache.render(`
      <div class="container">
      {{#plugins}}
        <div class="row">
          <div class="col-md-4"><label class="mr-2">{{name}}</label></div>
          <div class="col-md-6">
            <input type="text" class="form-control form-control-sm mt-1" disabled value="{{view}}">
          </div>
          <div class="col-md-1">
            <button type="submit" class="btn btn-primary btn-sm mt-1 microdrop-ui-plugin-btn"
            data-plugin-name={{name}} data-plugin-view={{view}}>
              Launch
            </button>
          </div>
        </div>
      {{/plugins}}
      </div>
    `, {plugins: data});
    this.panel.node.innerHTML = output;
  }
}

module.exports = UIPluginLauncher;
