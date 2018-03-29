const PhosphorWidgets = require('@phosphor/widgets');
const request = require('browser-request');
const yo = require('yo-yo');

const DEFAULT_LAYOUT = {
"main":{
  "type":"split-area",
  "orientation":"vertical",
  "children":[
    {"type":"split-area","orientation":"horizontal",
    "children":[
      {"type":"tab-area",
      "widgets":["device-ui-plugin"],
      "currentIndex":0},
      {"type":"tab-area",
      "widgets":["step-ui-plugin"],
      "currentIndex":0}],
      "sizes":[0.6,0.4]},
      {"type":"split-area","orientation":"horizontal",
      "children":[
        {"type":"tab-area","widgets":["selected-ui-plugin"],"currentIndex":0},
        {"type":"tab-area","widgets":["dropbot-ui-plugin"],"currentIndex":0}
      ],
      "sizes":[0.6,0.4]}
    ],
    "sizes":[0.7,0.3]
  }
};


function init() {
  // Add all window objects that extend UIPlugin to microdropPlugin list
  for (const [key, val] of Object.entries(window)){
    if (!val) continue;
    if (!val.prototype) continue;
    if (Object.getPrototypeOf(val).name == "UIPlugin") {
      window.microdropPlugins.set(key, val);
    }
  }

  // If microdropPlugins is not defined, alert the user to add a web plugin
  // via the plugin-manager webpage:
  if (!window.microdropPlugins) {
    alert(`
      No UI/Web Plugins found!
      Add them at "http://localhost:PORT/plugin-manager"
    `);
  }

  let focusTracker;

  function createDock(title) {
      var widget = new PhosphorWidgets.DockPanel();
      // widget.title.className = "dock hidden";
      return widget;
  }

  function setSizes(dockPanel, sizes) {
    function rec(splitLayout, [me, ...children]) {
      let childLayoutList = splitLayout.children.filter(
        (child) => child instanceof splitLayout.constructor
      );

      let childNum = 0;
      let num = 0;

      for(let child of children) {
        if(typeof(child) != 'number') {
          rec(childLayoutList[childNum++], child);
          child = child[0];
        }
        splitLayout.sizers[num++].sizeHint = child;
      }

      splitLayout.normalized = true;
    }

    rec(dockPanel.layout._root, sizes);
    dockPanel.update();
  }

  window.hasLaunched = false;
  window.panel = new PhosphorWidgets.DockPanel();
  window.pluginInstances = [];
  window.widgetMap = new Map();

  panel.spacing = 10;
  // dock = createDock("MicroDrop");

  panel.id = 'main';
  // dock.addWidget(panel);

  PhosphorWidgets.Widget.attach(panel, document.body);

  focusTracker = new PhosphorWidgets.FocusTracker();

  const setup = async () => {
    for (const [pluginName,pluginClass] of microdropPlugins) {
      // const dock = docks[pluginClass.position()];
      const widget = await pluginClass.Widget(panel, focusTracker, PhosphorWidgets);
      widgetMap.set(widget.title.label, widget);
      if (widget.plugin) pluginInstances.push(widget.plugin);
    }
    // dock.dispose();

    function restorePanels() {
      // Use first widget as anchor for latter added widgets
      let firstWidget = null;

      function getChildren(obj) {
        if (!obj) return;
        // Traverse the layout structure, replacing widgetNames with widgetObjects
        const children = obj.children;

        if ("widgets" in obj) {
          const widgetObjects = new Array();
          for (const title of obj.widgets){
            // Replace each widgetName with widgetObject
            let widget = widgetMap.get(title);
            if (!firstWidget) firstWidget = widget;
            widgetObjects.push(widget);
            // Delete from widgetMap, to keep track of new
            // widgets not saved in layout
            widgetMap.delete(title);
          }
          obj.widgets = widgetObjects;
        }
        // Continue traversal
        if (children == undefined) return;
        for (const child of children) {
          getChildren(child);
        }
      }

      // Fetch the layout, and replace widgetNames with widgetObjects
      const layout = JSON.parse(localStorage.getItem("microdrop:layout"));
      getChildren(layout.main);
      panel.restoreLayout(layout);

      // For any widgets, not mentioned in they layout, add them to the first
      // widget
      for (const [title, widget] of widgetMap) {
        panel.addWidget(widget,  {mode: "tab-after", ref: firstWidget});
      }
      return layout;
    }

    function savePanels() {
      // Save layout to local storage
      function getChildren(obj) {
        // Traverse layout, replacing widgetObject with widgetName to make
        // the layout JSON serializable
        const children = obj.children;
        if ("widgets" in obj) {
          const widgetNames = new Array();
          for (const widget of obj.widgets)
            widgetNames.push(widget.title.label);
          obj.widgets = widgetNames;
        }
        if (children == undefined) return;
        for (const child of children) {
          getChildren(child);
        }
      }
      // Fetch layout, serialize it, and then save to local storage
      const layout = panel.saveLayout();
      getChildren(layout.main);
      localStorage.setItem("microdrop:layout", JSON.stringify(layout));
      return layout;
    }

    panel.onUpdateRequest = (msg) => {
      // Trigger update event in children:
      for (const [i, plugin] of pluginInstances.entries()) {
        plugin.trigger("updateRequest", msg);
      }

      // Save layout everytime it is updated
      if (window.hasLaunched) {
        savePanels();
      } else {
        window.hasLaunched = true;
        if ("microdrop:layout" in window.localStorage)
          restorePanels()
        else {
          try {
            localStorage.setItem('microdrop:layout', JSON.stringify(DEFAULT_LAYOUT));
            restorePanels();
          } catch (e) {
            savePanels();
          }
        }

      }
    }

    window.onresize = () => {panel.update()};

  };

  setup();

}

module.exports = () => {
  request('/web-plugins.json', (er, b, c) => {
    const webPlugins = JSON.parse(c);

    const promises = [];
    const head = document.getElementsByTagName('head')[0];

    for (const [path, plugin] of Object.entries(webPlugins)) {
      if (plugin.state == 'disabled') continue;
      const name = plugin.data.name;
      const script = plugin.data.script;
      console.log({path, plugin});
      const tag = yo`
        <script type="text/javascript" src="/fetch-file?file=${path}/${script}"></script>
      `;

      head.appendChild(tag);
      promises.push(new Promise((resolve, reject) => {
        tag.onload = () => {
          resolve('loaded')
        };
        tag.onerror = () => {
          reject('failed to load');
          request('/reset', () => {
            localStorage.removeItem('microdrop:layout');
            window.location.reload();
          });
        }
      }));

    }

    Promise.all(promises).then((d) => {
      init();
    });

  });
};
