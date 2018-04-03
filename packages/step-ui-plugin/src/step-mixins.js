const uuid = require('uuid/v4');
const yo = require('yo-yo');
const _ = require('lodash');

const APPNAME = 'microdrop';

const StepMixins = {};
const timeout = ms => new Promise(res => setTimeout(res, ms))

const unselect = (b) => {
  b.classList.remove("btn-primary");
  b.classList.add("btn-outline-secondary");
}

const select = (b) => {
  b.classList.remove("btn-outline-secondary");
  b.classList.add("btn-primary");
}

const Step = (state, index, options) => {
  /* Create a Step element with callbacks */
  const id = `step-group-${uuid()}`;

  const inputChanged = (e, ...args) => {
    /* Called when step is being renamed */
    if (e.key == "Enter" || e.type == "blur") {
      options.renameCallback(e.target.value, index);
      return;
    }
  };

  let btn;
  const onClick = (e, ...args) => {
    /* Called when main button is clicked */
    if (btn.classList.contains("btn-outline-secondary")) {
      //If btn is seconday (not loaded) call the load callback
      btn.classList.remove("btn-outline-secondary");
      options.loadCallback(index, null);
    } else {
      // Else if the button is selected then add an input field
      if (btn.innerHTML.trim() == state.__name__.trim()) {
        btn.innerHTML = '';
        let input = yo`
          <input
            value="${state.__name__}"
            onkeypress=${inputChanged.bind(this)}
            onblur=${inputChanged.bind(this)}
          />`;
        btn.appendChild(input);
        input.focus();
      }
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Define the main button in the step (used to attach click and rename)
  // callbacks
  btn = yo`
    <button
      id="step-${index}"
      class="step-main btn btn-sm ${options.isLoaded ? 'btn-primary' : 'btn-outline-secondary'}"
      style="flex-grow: 1;"
      onclick=${onClick}>
      ${state.__name__}
    </button>
  `;

  // Wrap btn in container, with a delete button as its sibling
  return yo`
    <div id="${id}"
      class="btn-group"
      style="width:100%;margin: 3px 0px;">
      ${btn}
      <button
        class="btn btn-sm btn-outline-danger"
        onclick=${options.deleteCallback.bind(this, index, state)}
        style="width:10px;">
        <span style="left: -3px; position: relative;">x</span>
      </button>
    </div>
  `;
}

StepMixins.getAvailablePlugins = async function() {
  const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
  let availablePlugins = [];
  for (let [i, plugin] of this.plugins.entries()) {
    try {
      let pong = await microdrop.triggerPlugin(plugin, 'ping', {}, 200);
      if (pong) availablePlugins.push(plugin);
    } catch (e) {
      console.error(e)
    }
  }
  return availablePlugins;
}

StepMixins.executeSteps = async function(item, btn) {
  const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
  // Fetch all subscriptions including the term execute

  if (btn.innerText != 'Stop') {
    this.running = false;
    await microdrop.triggerPlugin('routes-model', 'stop', {});
    return;
  }

  this.running = true;
  const steps = await this.getState('steps');

  // Before loading steps, get a list of plugins still listening:
  const availablePlugins = await this.getAvailablePlugins();

  // Find which functions have an "execute" function
  let executablePlugins = [];

  await Promise.all(_.map(availablePlugins, async (p) => {
    let subs = await microdrop.getSubscriptions(p, 200);
    subs = _.filter(subs, (s)=>_.includes(s, "execute"));
    if (subs.length > 0 ) executablePlugins.push(p);
  }));

  for (let i = this.loadedStep || 0;i<steps.length; i++ ){
    if (!this.running) break;
    await this.loadStep(i, availablePlugins);
    const routes = await this.getState('routes', 'routes-model');

    for (let ii = 0; ii < executablePlugins.length; ii++) {
      const p = executablePlugins[ii];
      await microdrop.triggerPlugin(p, 'execute', {}, -1);
    }

  }
  this.running = false;
  console.log("Done!");
}

StepMixins.onStepState = function(payload, params) {
  const steps = payload;
  const loadedStep = this.loadedStep;
  this.steps.innerHTML = "";

  _.each(steps, (s, i) => {
    let options = {
      loadCallback: this.loadStep.bind(this),
      deleteCallback: this.deleteStep.bind(this),
      renameCallback: this.renameStep.bind(this),
      isLoaded: i==loadedStep
    };
    this.steps.appendChild(Step(s, i, options));
  });
}

StepMixins.onStepReorder = async function(evt) {
  const index1 = evt.oldIndex;
  const index2 = evt.newIndex;
  let prevSteps;
  try {
    prevSteps = await this.getState('steps');
  } catch (e) {
    prevSteps = [];
  }
  const item1 = _.cloneDeep(prevSteps[index1]);
  const item2 = _.cloneDeep(prevSteps[index2]);
  prevSteps[index1] = item2;
  prevSteps[index2] = item1;
  this.setState('steps', prevSteps);
}

StepMixins.loadStep = async function(index, availablePlugins) {
  this.schema_hash = '';
  // Change unloaded steps to secondary buttons, and loaded step
  // to primary button
  let stepElements = [...this.steps.querySelectorAll('.step-main')];
  let btn = this.steps.querySelector(`#step-${index}`);
  _.each(stepElements, unselect);
  select(btn);

  // Change loaded step
  this.loadedStep = index;

  // If a plugin is selected, update the schemas
  if (this.pluginName) {
    await this.loadSchemaByPluginName(this.pluginName);
  }

  // Load the step data
  const state = (await this.getState('steps'))[index];
  return await this.loadStatesForStep(state, index, availablePlugins);
}

StepMixins.updateStep = async function(pluginName, k, payload) {
  if (this.loadedStep != undefined) {
    const steps = await this.getState('steps');
    const step = steps[this.loadedStep];
    _.set(step, [pluginName, k], payload);
    this.setState('steps', steps);
  }
}

StepMixins.loadStatesForStep = async function(states, index, availablePlugins) {
  /* Load step data into state, and listen for updates */
  availablePlugins = availablePlugins || this.plugins;

  // Create another client in the background as to not override the schema
  // plugin
  const clientName = 'stepClient-${index}-${parseInt(Math.random()*10000)}';
  if (this.stepClient) {
    try {
      await this.stepClient.disconnectClient();
    } catch (e) {}
    delete this.stepClient;
  }
  this.stepClient = new MicropedeClient(APPNAME, undefined,
    this.port, clientName);

  // Iterate through each plugin + key
  return await Promise.all(_.map(availablePlugins, async (p) => {
    return await Promise.all(_.map(states[p], async (v,k) => {

      // Call a put on each key
      const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
      try { await microdrop.putPlugin(p, k, v); }
      catch (e) { console.error(e);}

      // Listen for changes
      this.stepClient.onStateMsg(p,k, async (payload, params) => {
        const steps = await this.getState('steps');
        const step = steps[index];
        _.set(step, [p,k], payload);
        this.setState('steps',steps);
      });
      return;
    }));
  }));
}

StepMixins.renameStep = async function(name, index) {
  const LABEL = "StepMixins::renameStep";
  try {
    const steps = await this.getState('steps');
    const step = steps[index];
    step.__name__ = name;
    this.setState('steps', steps);
  } catch (e) {
    console.error(LABEL, e);
  }
};

StepMixins.deleteStep = async function(index, step, e) {
  let prevSteps;
  try {
    prevSteps = await this.getState('steps');
  } catch (e) {
    prevSteps = [];
  }

  prevSteps.splice(index, 1);
  this.setState('steps', prevSteps);
}

StepMixins.createStep = async function (e) {
  let state = {};

  // Fetch the entire microdrop state
  await Promise.all(_.map(this.plugins, async (plugin) => {
    try {
      let schema    = await this.getSchema(plugin);
      state[plugin] = await this.getStateForPlugin(plugin, schema);
    } catch (e) {
      console.error(e);
    }
    return;
  }));

  // Get previous steps
  let prevSteps;
  try {
    prevSteps = await this.getState('steps');
  } catch (e) { prevSteps = []; }

  // Write current state as new step
  state.__name__ = `Step ${prevSteps.length}`;
  prevSteps.push(state);
  await this.setState('steps', prevSteps);
}

module.exports = StepMixins;
