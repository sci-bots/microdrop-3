const _ = require('lodash');
const _fp = require('lodash/fp');

const PluginModel = require('./PluginModel');

class StepModel extends PluginModel {
  constructor () {
    super();
    this.steps = null;
    this.stepNumber = null;
  }
  listen() {
    this.onStateMsg("electrodes-model", "electrodes", this.onSetElectrodes.bind(this));
    this.onStateMsg("electrodes-model", "channels", this.onSetElectrodeChannels.bind(this));
    // TODO: Store Schema as its own model:
    this.onStateMsg("protocol-model", "schema", this.onSetSchema.bind(this));
    // TODO: Route options should be a state message
    this.onPutMsg("route-options", this.onSetRouteOptions.bind(this));

    this.onPutMsg("step", this.onPutStep.bind(this));
    this.onPutMsg("steps", this.onPutSteps.bind(this));
    this.onPutMsg("step-number", this.onPutStepNumber.bind(this));

    this.bindStateMsg("step", "set-step");
    this.bindStateMsg("step-number", "set-step-number");
    this.bindStateMsg("steps", "set-steps");
    this.bindPutMsg("electrodes-model", "electrode-options", "put-electrode-options");
    this.bindPutMsg("routes-model", "route-options", "put-route-options");

    this.onTriggerMsg("update-step", this.onUpdateStep.bind(this));
    this.onTriggerMsg("delete-step", this.onDeleteStep.bind(this));
    this.onTriggerMsg("insert-step", this.onInsertStep.bind(this));
  }

  // ** Getters and Setters **
  get filepath() {return __dirname;}
  get steps() {return this._steps;}
  set steps(steps) {this._steps = steps;}
  get stepNumber() {return this._stepNumber;}
  set stepNumber(stepNumber) {this._stepNumber = stepNumber;}
  get step() {
    if (this.steps == null) {
      console.error("Failed to get step; this.steps == null");
      return undefined;
    }
    return this.steps[this.stepNumber];
  }
  set step(step) {
    if (this.steps == null) {
      console.error("Failed to set step; this.steps == null");
      return undefined;
    }
    this.steps[this.stepNumber] = step;
  }

  // ** Methods **
  updateStepOptions() {
    this.trigger("put-electrode-options",
      this.step["electrode-data-controller"] || false);

    if ("droplet-planning-plugin" in this.step) {
      this.trigger("put-route-options", this.step["droplet-planning-plugin"]);
    }
  }

  // ** Event Handlers **
  onSetElectrodes(payload) {
    if (!this.step) return; if (!this.steps) return;
    const step = this.step;
    if ("electrode-data-controller" in step)
      step["electrode-data-controller"].electrode_states = payload;
    else
      step["electrode-data-controller"] = {electrode_states: payload};
    this.step = step;
    this.trigger("set-steps", this.wrapData("steps",this.steps));
    this.trigger("set-step", this.wrapData("step", step));
  }
  onSetElectrodeChannels(payload) {
    if (!this.step) return; if (!this.steps) return;
    const step = this.step;
    if ("electrode-data-controller" in step)
      step["electrode-data-controller"].channels = payload;
    else
      step["electrode-data-controller"] = {channels: payload};
    this.step = step;
    this.trigger("set-steps", this.wrapData("steps",this.steps));
    this.trigger("set-step", this.wrapData("step", step));
  }
  onSetRouteOptions(payload) {
    if (!this.step) return;
    if (!this.steps) return;

    const step = this.step;
    step["droplet-planning-plugin"] = payload;
    this.step = step;
    this.trigger("set-steps", this.wrapData("steps",this.steps));
    this.trigger("set-step", this.wrapData("step", step));

  }
  onSetSchema(payload) {
    const schema = payload.schema;
    const pluginName = payload.pluginName;
    const step = this.step;
    if (!step) return;
    if (pluginName in step) return;

    step[pluginName] = defaults;
    this.step = step;

    this.trigger("set-step", this.wrapData("step", this.step));
    this.trigger("set-steps", this.wrapData("steps",this.steps));
  }
  onPutStep(payload) {
    this.step = payload;
    this.updateStepOptions();
    this.trigger("set-steps", this.wrapData("steps",this.steps));
    this.trigger("set-step", this.wrapData("step", this.step));
  }
  onPutSteps(payload) {
    this.steps = payload;
    this.trigger("set-steps", this.wrapData("steps",this.steps));
  }
  onPutStepNumber(payload) {
    this.stepNumber = payload.stepNumber;
    this.updateStepOptions();
    this.trigger("set-step-number", this.wrapData("stepNumber",this.stepNumber));
    this.trigger("set-step", this.wrapData("step", this.step));
  }
  onUpdateStep(payload) {
    const data = payload.data;
    const key = data.key;
    const val = data.val;
    const stepNumber = data.stepNumber;

    _.each(this.steps[stepNumber], (schema) => {
      if (!schema) return;
      if (key in schema) schema[key] = val
    });

    this.updateStepOptions();
    this.trigger("set-steps", this.wrapData("steps",this.steps));
    this.trigger("set-step", this.wrapData("step", this.step));
  }
  onDeleteStep(payload) {
    const prevStepNumber = payload.stepNumber;
    let nextStepNumber;
    if (prevStepNumber == 0) nextStepNumber = 0;
    if (prevStepNumber != 0) nextStepNumber = prevStepNumber - 1;

    const steps = this.steps;
    steps.splice(prevStepNumber, 1);
    this.steps = steps;
    this.stepNumber = nextStepNumber;

    this.updateStepOptions();
    this.trigger("set-steps", this.wrapData("steps",this.steps));
    this.trigger("set-step-number", this.wrapData("stepNumber",this.stepNumber));
    this.trigger("set-step", this.wrapData("step", this.step));
  }
  onInsertStep(payload) {
    const stepNumber = payload.stepNumber;
    const steps = this.steps;
    const step = _.cloneDeep(this.step);
    steps.splice(stepNumber, 0, step);

    this.steps = steps;
    this.stepNumber = stepNumber + 1;

    this.updateStepOptions();
    this.trigger("set-steps", this.wrapData("steps",this.steps));
    this.trigger("set-step-number", this.wrapData("stepNumber",this.stepNumber));
    this.trigger("set-step", this.wrapData("step", this.step));
  }
}
module.exports = StepModel;
