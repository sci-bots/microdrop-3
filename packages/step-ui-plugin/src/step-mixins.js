const uuid = require('uuid/v4');
const yo = require('yo-yo');
const _ = require('lodash');
const $ = window.$ = require('jquery');
window.Popper = require('popper.js');
const BootstrapMenu = require('bootstrap-menu');

const APPNAME = 'microdrop';

const StepMixins = {};

const unselect = (b) => {
  b.classList.remove("btn-primary");
  b.classList.add("btn-outline-secondary");
}

const select = (b) => {
  b.classList.remove("btn-outline-secondary");
  b.classList.add("btn-primary");
}

const Step = (state, index, clickCallback, deleteCallback, isLoaded) => {

  const id = `step-group-${uuid()}`;

  let btn = yo`
    <button
      id="step-${index}"
      class="step-main btn btn-sm ${isLoaded ? 'btn-primary' : 'btn-outline-secondary'}"
      style="flex-grow: 1;"
      onclick=${clickCallback.bind(this, index, null)}>
      ${state.__name__}
    </button>
  `;

  const onNameChange = (e, ...args)=> {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.log("Name Change!", e, ...args);
  }

  const onInputChange = (e, ...args) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    console.log("Name Change!", e, ...args);
  }

  var menu = new BootstrapMenu(`#${id}`, {
    actions: [{
      name: 'Rename',
      onClick: () => {
        btn.innerHTML = '';
        btn.appendChild(yo`
          <div>
            <input value="${state.__name__}"
              oninput=${onInputChange.bind(this)}
              onsubmit=${onInputChange.bind(this)}
              onblur=${onInputChange.bind(this)}
              onchange=${onNameChange.bind(this)} />
          </div>
        `);
        btn.children[0].children[0].focus();
      }
    }]
  });

  return yo`
    <div id="${id}"
      class="btn-group" style="width:100%;margin: 3px 0px;">
      ${btn}
      <button
        class="btn btn-sm btn-outline-danger"
        onclick=${deleteCallback.bind(this, index, state)}
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

  if (btn.innerText != 'Stop') {
    this.running = false;
    await microdrop.triggerPlugin('routes-model', 'stop', {});
    return;
  }

  this.running = true;
  const steps = await this.getState('steps');
  // Before loading steps, get a list of plugins still listening:
  const availablePlugins = await this.getAvailablePlugins();

  for (let i =this.loadedStep || 0;i<steps.length; i++ ){
    if (!this.running) break;
    await this.loadStep(i, availablePlugins);
    const routes = await this.getState('routes', 'routes-model');

    // TODO: Should be dynamic
    await microdrop.triggerPlugin('routes-model', 'execute', {routes}, -1);
  }
  this.running = false;
  console.log("Done!");
}

StepMixins.onStepState = function(payload, params) {
  const steps = payload;

  const loadedStep = this.loadedStep;
  this.steps.innerHTML = "";
  _.each(steps, (s, i) => {
    this.steps.appendChild(Step(s, i, this.loadStep.bind(this), this.deleteStep.bind(this), i==loadedStep));
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
