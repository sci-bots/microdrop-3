const yo = require('yo-yo');
const MicropedeAsync = require('@micropede/client/src/async.js');
const APPNAME = 'microdrop';

const StepMixins = {};

 StepMixins.changeSteps = async function () {
  const obj = _.last(this.editor.history.history);
  const action = obj.action;
  const index = obj.params.index;

  const microdrop = new MicropedeAsync(APPNAME);
  const steps = await microdrop.getState("state-saver-ui", "steps");

  if (action == "removeNodes") {
    steps.splice(index,1);
  }

  this.trigger("set-steps", steps);
}

StepMixins.keypressed = async function (e) {
  /* Change loaded step when interacting with keyboard */
  // Don't do anything if the state-saver plugin is not in focus
  if (!_.isEqual(this.focusTracker.currentWidget.plugin, this)) return;
  // Don't do anything if state-saver is not on steps view
  if (this.view != 'steps') return;
  const microdrop = new MicropedeAsync(APPNAME);
  let prevStepIndex;
  try {
    prevStepIndex = await microdrop.getState('state-saver-ui', 'step-index', 500);
  } catch (e) {
    console.error(e);
    return;
  }
  let nextStepIndex = prevStepIndex;

  const steps = await microdrop.getState('state-saver-ui', 'steps');
  const numSteps = steps.length;

  // Prevent the page from scrolling down
  e.preventDefault();
  e.stopPropagation();
  switch (e.code) {
    case 'ArrowUp':
      nextStepIndex -= 1;
      break;
    case 'ArrowDown':
      nextStepIndex += 1;
      break;
    default:
      return;
  }

  if (nextStepIndex < 0) {
    nextStepIndex = numSteps - 1;
  } else if (nextStepIndex >= numSteps) {
    nextStepIndex = 0;
  }

  this.loadStep(null, nextStepIndex);
}

StepMixins.exec = async function (item, steps, index) {
  /* Execute routes, then continue to the next step */
  this._running = true;
  const microdrop = new MicropedeAsync(APPNAME);
  index = index || item.node.index;
  steps = steps || await microdrop.getState("state-saver-ui", "steps");
  await this.loadStep(item, index, steps);
  var step = steps[index];
  var routes = _.get(step, ["routes-model", "routes"]);
  // if (routes) await microdrop.routes.execute(routes, -1);
  if (routes) await microdrop.triggerPlugin('routes-model', 'execute', {routes}, -1);
  index += 1;
  if (steps[index]) this.exec(item, steps, index);
  else {
    this._running = false;
  }
}

StepMixins.loadStep = async function (item=null, index, steps) {
  this._running = true;
  try {
    // Load index from item if index parameter is not set
    if (!_.isInteger(index)) {
      index = _.get(item, "node.index");
      if (!_.isInteger(index)) return;
    }
    this.trigger("set-step-index", index);
    const microdrop = new MicropedeAsync(APPNAME);
    steps = steps || await microdrop.getState("state-saver-ui", "steps");
    var step = steps[index];

    // Clear previous routes, and electrodes (incase the haven't been set)
    await put("routes-model", "routes", [], 500);
    await put("electrodes-model", "active-electrodes", [], 500);

    for (const [pluginName, props] of Object.entries(step)) {
      const subs = await microdrop.getSubscriptions(pluginName);

      for (const [k,v] of Object.entries(props)) {
        try {
          // Get the subscriptions for the pluginName
          if (_.includes(subs, `microdrop/put/${pluginName}/${k}`)) {
            await put(pluginName, k, v, 500);
          }
        } catch (e) {
          console.error(e, {pluginName, k, v});
        }
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    this._running = false;
    this.renderStepView();
  }
}

StepMixins.createStep = async function () {
  let steps;
  // Try and get previous steps if they exist
  try {
    const microdrop = new MicropedeAsync(APPNAME);
    steps = await microdrop.getState("state-saver-ui", "steps", 1000);
  } catch (e) { steps = [];}

  // Get the current step from the editor
  const json = _.clone(this.json);

  const step = {
    "routes-model": json["routes-model"],
    "electrodes-model": json["electrodes-model"]
  };

  // Push snapsot and update microdrops state
  steps.push(step);
  this.trigger("set-steps", steps);
}

StepMixins.renderStepView = async function () {
  if (this._running == true) return;
  const loadStep = { text: "Load Step", click: this.loadStep.bind(this) };
  const execStep = { text: "Run", click: this.exec.bind(this) };
  this.editor.set(_.get(this.json, ["state-saver-ui", "steps"]) || []);
  this.editor.node.items = [loadStep, execStep];

  const microdrop = new MicropedeAsync(APPNAME);

  _.set(this.element.style, "overflow", "hidden");

    this.infoBar.innerHTML = '';
    this.infoBar.appendChild(yo`
    <button onclick=${this.createStep.bind(this)}>Create Step</button>`);

  // Show the index of the last loaded step:
  microdrop.getState('state-saver-ui', 'step-index', 500).then((d) => {
    this.infoBar.innerHTML = '';
    this.infoBar.appendChild(yo`
    <button onclick=${this.createStep.bind(this)}>Create Step</button>`);
    this.infoBar.appendChild(yo`<b>${d}</b>`);
  }).catch((e) => {
    const timedOut = _.map(e, (t) => _.includes(t, "timeout")).indexOf(true);
    if (timedOut == -1) {
      throw(["failed to get step-index", e]);
    }
  });
}

async function put(pluginName, k, v) {
  try {
    const microdrop = new MicropedeAsync(APPNAME);
    const msg = {};
    _.set(msg, "__head__.plugin_name", microdrop.name);
    _.set(msg, k, v);
    const dat = await microdrop.putPlugin(pluginName, k, msg);
    return dat.response;
  } catch (e) {
    console.error(pluginName, k , e );
  }
};


module.exports = StepMixins;
