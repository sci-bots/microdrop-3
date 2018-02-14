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

var StateListener = require('./StateListener.js');
var UIPluginLauncher = require('./UIPluginLauncher.js');

const MIME_TYPE = 'text/microdrop';
const MIME_TYPES = ['text/microdrop', 'text/microdrop+json'];
const NAME = 'MicroDrop';

const DIRTY_CLASS = 'jp-mod-dirty';

class MyFactory extends MimeDocumentFactory {
  get readOnly(){
    return false;
  }
}

exports.default = [{
  id: 'microdrop-ui-plugin',
  autoStart: true,
  requires: [ILauncher, ILayoutRestorer],
  activate: function(app, launcher, restorer) {
    const command = 'microdrop-ui-plugin:open';
    let launchTracker = new InstanceTracker({ namespace: 'microdrop:launcher' });
    let docTracker = new InstanceTracker({ namespace: 'microdrop:document' });

    const manager = app.serviceManager;
    const registry = app.docRegistry;
    const filetype = {
      name: NAME,
      mimeTypes: MIME_TYPES,
      extensions: ['.txt', '.microdrop']
    };

    const createPanel = (id=null, url=null, name='UI Plugin Launcher') => {
      const panel = new Panel();
      if (!id) id = `${Date.now()}:${Math.random()*1000}`;
      panel.id = id;
      panel.url = url;
      panel.pluginName = name;
      panel.title.label = name;
      panel.title.closable = true;
      return panel;
    }

    const rendererFactory = {
        safe: true,
        mimeTypes: MIME_TYPES,
        createRenderer: function (options) {
          let loaded = false;
          console.log("Creating Renderer", {options, docTracker});

          // Setup Panel:
          let panel = createPanel();
          panel.model = options.resolver.model;
          panel.context = options.resolver;
          panel.url = 'http://localhost:3000/state-saver/build/index.html';

          const key = "currentWidget.context.contentsModel.path";

          // Method called when file is opened
          panel.renderModel = async (model) => {
            if (loaded) return;
            loaded = true;

            panel.node.setAttribute("tabIndex", -1);
            panel.node.style.outline = "0px";
            panel.title.className += ` ${DIRTY_CLASS}`;

            const stateListener = new StateListener(panel);

            stateListener.on("activateRequest", () => {
              panel.node.tabIndex = -1;
              panel.node.focus();
              setActiveFile();
            });

            const setActiveFile = () => {
              const filename = _.get(docTracker, key);
              stateListener.ready.then((d) => {
                stateListener.trigger("set-active-file", filename);
              });
            };

            panel.onActivateRequest = () => {
              panel.node.tabIndex = -1;
              panel.node.focus();
              setActiveFile();
            };

            if (_.get(docTracker, key)) { setActiveFile(); }
            return undefined;
          };

          return panel;
        }
    };

    docTracker.currentChanged.connect((t,w)=> {
      if (!w.layout) return;
      const widgets = w.layout.widgets;
      const panel = _.find(widgets, (d) => d.constructor.name == "Panel");
      panel.onActivateRequest();
    });

    app.rendermime.addFactory(rendererFactory, 0);
    app.docRegistry.addFileType(filetype);
    const factory = new MyFactory({
      dataType: 'string',
      rendermime: app.rendermime,
      name: NAME,
      primaryFileType: app.docRegistry.getFileType(NAME),
      fileTypes: [NAME],
      defaultFor: [NAME]
    });
    factory.readOnly = false;
    registry.addWidgetFactory(factory);


    // Track Mime Renderer
    factory.widgetCreated.connect((sender, widget) => {
      manager.ready.then( () => {
        docTracker.add(widget);
        docTracker.save(widget);
      });
    });

    // Define fcn to launch plugins
    const launch = (...args) => {
      const panel = createPanel(...args);
      app.shell.addToMainArea(panel);
      app.shell.activateById(panel.id);
      launchTracker.add(panel);
      const launcher = new UIPluginLauncher(panel);
      launcher.on("update", () => {launchTracker.save(panel)});
      return panel;
    };

    const callback = () => {
      return manager.ready.then( () => {
        return launch();
      });
    };

    app.commands.addCommand(command, {
      label: "Load UI Plugin",
      execute: (args) => {
        return manager.ready.then( () => {
          return launch(args.id, args.url, args.pluginName);
        });
      }
    });

    restorer.restore(launchTracker, {
      command,
      args: (p) =>  {
        if (p.constructor.name == "MimeDocument") return;

        // if (p.constructor.name == "MimeDocument") return;
        // console.log({id: p.id, url: p.url, pluginName: p.pluginName});
        return {id: p.id, url: p.url, pluginName: p.pluginName}
      },
      name: (p) => {
        return p.id;
      }
    });

    restorer.restore(docTracker, {
      command: 'docmanager:open',
      args: (w) =>  {
        if (w.constructor.name != "MimeDocument") return;
        return { path: w.context.path, factory: NAME }
      },
      name: (w) => {
        return w.id;
      }
    });

    launcher.add({
      displayName: "UI Plugin Launcher",
      category: "MicroDrop",
      rank: 0,
      callback: callback
    });
  }
}];
