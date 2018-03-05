const yo = require('yo-yo');
const _ = require('lodash');
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
  return yo`
    <div class="btn-group" style="width:100%;margin: 3px 0px;">
      <button
        id="step-${index}"
        class="step-main btn btn-sm ${isLoaded ? 'btn-primary' : 'btn-outline-secondary'}"
        style="flex-grow: 1;"
        onclick=${clickCallback.bind(this, index, state)}>
        Step ${state.__name__}
      </button>
      <button
        class="btn btn-sm btn-outline-danger"
        onclick=${deleteCallback.bind(this, index, state)}
        style="width:10px;">
        <span style="left: -3px; position: relative;">x</span>
      </button>
    </div>
  `;
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
  const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
  const prevSteps = await microdrop.getState(this.name, 'steps', 500) || [];
  const item1 = _.cloneDeep(prevSteps[index1]);
  const item2 = _.cloneDeep(prevSteps[index2]);
  prevSteps[index1] = item2;
  prevSteps[index2] = item1;
  this.setState('steps', prevSteps);
}

StepMixins.loadStep = async function(index, state, e) {
  this.schema_hash = '';
  // Change unloaded steps to secondary buttons, and loaded step
  // to primary button
  let stepElements = [...this.steps.getElementsByClassName('step-main')];
  _.each(stepElements, unselect);
  select(e.target);

  // Change loaded step
  this.loadedStep = index;

  // If a plugin is selected, update the schemas
  if (this.pluginName) {
    const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
    await this.loadSchemaByPluginName(this.pluginName);
  }

  // Load the step data
  this.loadStatesForStep(state, index);
}

StepMixins.updateStep = async function(pluginName, k, payload) {

  if (this.loadedStep != undefined) {
    const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
    const steps = await microdrop.getState(this.name, 'steps', 500);
    const step = steps[this.loadedStep];
    _.set(step, [pluginName, k], payload);
    this.setState('steps', steps);
  }
}

StepMixins.loadStatesForStep = async function(states, index) {
  /* Load step data into state, and listen for updates */
  let microdrop;

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
  await Promise.all(_.map(this.plugins, async (p) => {
    await Promise.all(_.map(states[p], async (v,k) => {

      // Call a put on each key
      microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
      try { await microdrop.putPlugin(p, k, v); }
      catch (e) { console.error(e);}

      // Listen for changes
      this.stepClient.onStateMsg(p,k, async (payload, params) => {
        microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
        const steps = await microdrop.getState(this.name, 'steps');
        const step = steps[index];
        _.set(step, [p,k], payload);
        this.setState('steps',steps);
      });

    }));
  }));
}

StepMixins.deleteStep = async function(index, step, e) {
  const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
  const prevSteps = await microdrop.getState(this.name, 'steps', 500) || [];
  prevSteps.splice(index, 1);
  this.setState('steps', prevSteps);
}

StepMixins.createStep = async function (e) {
  let state = {};

  // Fetch the entire microdrop state
  await Promise.all(_.map(this.plugins, async (plugin) => {
    const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
    let schema    = await this.getSchema(plugin);
    state[plugin] = await this.getStateForPlugin(plugin, schema);
    return;
  }));

  // Get previous steps
  const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
  let prevSteps;
  try {
    prevSteps = await microdrop.getState(this.name, 'steps', 500);
  } catch (e) { prevSteps = []; }

  // Write current state as new step
  state.__name__ = prevSteps.length;
  prevSteps.push(state);
  await this.setState('steps', prevSteps);
}

module.exports = StepMixins;
