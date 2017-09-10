// Disable alert messages in datatables:
$.fn.dataTable.ext.errMode = 'throw';

let focusTracker;

function createDock(title) {
    var widget = new PhosphorWidgets.Panel();
    widget.title.className = "dock hidden";
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

window.panel = new PhosphorWidgets.DockPanel();
// box.title.label = 'Demo';
// box.title.closable = true;
panel.spacing = 10;
const docks = new Object();
docks.topLeft     = createDock("top-left");
docks.bottomLeft  = createDock("bottom-left");
docks.topRight    = createDock("top-right");
docks.bottomRight = createDock("bottom-right");

panel.id = 'main';
panel.addWidget(docks.topLeft);
panel.addWidget(docks.bottomLeft, {mode: "split-bottom", ref: docks.topLeft});
panel.addWidget(docks.bottomRight, {mode: "split-right", ref: docks.bottomLeft});
panel.addWidget(docks.topRight, {mode: "split-right", ref: docks.topLeft});

// Set default sizes
// Tree structure [parent, left-subtree, right-subtree]
// for leafs dont surround in brackets
const defaultSize = [1.0, [.70,.67,.33],[.30,.6,.4]];
setSizes(panel, defaultSize);
PhosphorWidget.attach(panel, document.body);

focusTracker = new FocusTracker();
for (const [pluginName,pluginClass] of microdropPlugins) {
  const dock = docks[pluginClass.position()];
  const widget = pluginClass.Widget(panel, dock, focusTracker);
}

window.onresize = () => {panel.update()};
