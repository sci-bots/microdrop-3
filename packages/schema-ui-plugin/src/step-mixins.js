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

const Step = (step, index, clickCallback, deleteCallback, isLoaded) => {
  return yo`
    <div class="btn-group" style="width:100%;margin: 3px 0px;">
      <button
        id="step-${index}"
        class="step-main btn btn-sm ${isLoaded ? 'btn-primary' : 'btn-outline-secondary'}"
        style="flex-grow: 1;"
        onclick=${clickCallback.bind(this, index, step)}>
        Step ${index}
      </button>
      <button
        class="btn btn-sm btn-outline-danger"
        onclick=${deleteCallback.bind(this, index, step)}
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

StepMixins.loadStep = async function(index, step, e) {
  this.schema_hash = '';
  // Change unloaded steps to secondary buttons, and loaded step
  // to primary button
  let stepElements = [...this.steps.getElementsByClassName('step-main')];
  _.each(stepElements, unselect);
  select(e.target);

  // Get the last loaded schema, and show in jsoneditor for this step
  this.loadedStep = index;
  this.loadStates(step);

  if (this.pluginName) {
    const microdrop = new MicropedeAsync(APPNAME, undefined, this.port);
    step = (await microdrop.getState(this.name, 'steps', 500))[index];
    this.json = step[this.pluginName];
    this.editor.set(this.json);
  }
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
  prevSteps.push(state);
  await this.setState('steps', prevSteps);
}





module.exports = StepMixins;
