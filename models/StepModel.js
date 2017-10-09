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
    this.onStateMsg("schema-model", "schema", this.onSchemaSet.bind(this));

    this.onPutMsg("step", this.onPutStep.bind(this));
    this.onPutMsg("steps", this.onPutSteps.bind(this));
    this.onPutMsg("step-number", this.onPutStepNumber.bind(this));

    this.onTriggerMsg("update-step", this.onUpdateStep.bind(this));
    this.onTriggerMsg("delete-step", this.onDeleteStep.bind(this));
    this.onTriggerMsg("insert-step", this.onInsertStep.bind(this));

    this.bindPutMsg("electrodes-model", "electrode-options", "put-electrode-options");
    this.bindPutMsg("routes-model", "route-options", "put-route-options");

    this.bindStateMsg("step", "set-step");
    this.bindStateMsg("step-number", "set-step-number");
    this.bindStateMsg("steps", "set-steps");
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
    if (!this.step) {
      console.error(`Failed to update step options: this.step is ${this.step}`);
      return;
    }
    for (const [pluginName, data] of Object.entries(this.step)){
      this.trigger(`${pluginName}-changed`, data);
    }
  }

  // ** Event Handlers **
  onSchemaSet(payload){
    console.log("<StepModel>:: Set Schema");
    console.log(payload.__head__);

    const schema = payload;

    // Add event bindings for each plugin in schema:
    for (const [pluginName, attrs] of Object.entries(schema)){
      this.bindSignalMsg(`${pluginName}-changed`, `${pluginName}-changed`);
    }

    if (!this.steps) {
      console.error(
        `<StepModel> COULD NOT UPDATE SCHEMA: this.steps is ${this.steps}`
      );
      return;
    }

    // Update steps:
    for (const [i, step] of this.steps.entries()){
      // Iterate through each plugins schema data
      for (const [pluginName, attrs] of Object.entries(schema)){
        // If data already exists for this plugin, then don't overwrite
        if (pluginName in step) continue;
        this.steps[i][pluginName] = new Object();
        // Fill step with the default values for the plugins attributes
        for (const [name, attr] of Object.entries(attrs)){
          this.steps[i][pluginName][name] = attr.default;
        }
      }
    }
    this.trigger("set-steps", this.wrapData("steps",this.steps));
  }
  onPutStep(payload) {
    console.log("<STEP MODEL>:: Putting step");
    this.step = payload;
    this.updateStepOptions();
    this.trigger("set-steps", this.wrapData("steps",this.steps));
    this.trigger("set-step", this.wrapData("step", this.step));
  }
  onPutSteps(payload) {
    console.log("<STEP MODEL>:: Putting steps");
    this.steps = payload;
    this.trigger("set-steps", this.wrapData("steps",this.steps));
  }
  onPutStepNumber(payload) {
    console.log("<STEP MODEL>:: Putting step number");
    this.stepNumber = payload.stepNumber;
    this.updateStepOptions();
    this.trigger("set-step-number", this.wrapData("stepNumber",this.stepNumber));
    this.trigger("set-step", this.wrapData("step", this.step));
  }
  onUpdateStep(payload) {
    console.log("<STEP MODEL>:: UpdateStep");

    const data = payload.data;
    const key = data.key;
    const val = data.val;
    const stepNumber = data.stepNumber;

    if (!this.steps) {
      console.error(`Cannot update step: this.steps is ${this.steps}`);
      return;
    }
    _.each(this.steps[stepNumber], (schema) => {
      if (!schema) return;
      if (key in schema) schema[key] = val
    });

    this.updateStepOptions();
    this.trigger("set-steps", this.wrapData("steps",this.steps));
    this.trigger("set-step", this.wrapData("step", this.step));
  }
  onDeleteStep(payload) {
    console.log("<StepModel>:: Deleting Step");

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
    console.log("<StepModel>:: Inserting Step");
    console.log(this.clientId);
    console.log(payload.__head__);

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
