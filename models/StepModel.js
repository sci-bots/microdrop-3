const _ = require('lodash');
const _fp = require('lodash/fp');
const MicrodropAsync = require('@microdrop/async');

const PluginModel = require('./PluginModel');

function UpdateStepNumbers(steps) {
  /* Update the step number column of steps (after insert) */
  for (const [i, step] of steps.entries()){
    step.step = i;
  }
  return steps;
}

function AddAttribute(steps, key, val=null) {
  /* Add attribute to each step (if currently undefined) */
  for (const [i, step] of steps.entries()){
    if (step[key] != undefined) continue;
    step[key] = val;
  }
  return steps;
}

function Steps(schema, length= 1) {
  /* Create default steps from schema */
  const steps = new Array(length);
  for (var i=0;i<length;i++){
    steps[i] = _.mapValues(schema, "default");
  }
  return steps;
}


function Step(schema) {
  /* Create default step from schema */
  return Steps(schema, 1)[0];
}

class StepModel extends PluginModel {
  constructor () {
    super();
    this.microdrop = new MicrodropAsync();
  }

  listen() {
    this.onPutMsg("steps", this.putSteps.bind(this));
    this.onPutMsg("step-number", this.putStepNumber.bind(this));

    this.onTriggerMsg("create-steps", this.createSteps.bind(this));
    this.onTriggerMsg("update-step", this.updateStep.bind(this));
    this.onTriggerMsg("delete-step", this.deleteStep.bind(this));
    this.onTriggerMsg("insert-step", this.insertStep.bind(this));
    // this.onTriggerMsg("add-attribute", this.addAttribute.bind(this));
    this.bindStateMsg("step-number", "set-step-number");
    this.bindStateMsg("steps", "set-steps");
  }

  // ** Getters and Setters **
  get filepath() {return __dirname;}

  putSteps(payload) {
    const LABEL = "<StepModel::putSteps>"; console.log(LABEL);
    try {
      if (!_.isArray(payload.steps)) throw([LABEl, "payload.steps not Array"]);
      this.trigger("set-steps", payload.steps);
      this.trigger("set-step-number", 0);
      return this.notifySender(payload, payload.steps, 'steps');
    } catch (e) {
      return this.notifySender(payload, [LABEL, e], 'steps', "failed");
    }
  }
  putStepNumber(payload) {
    const LABEL = "<StepModel::putStepNumber>"; console.log(LABEL);
    try {
      if (payload.stepNumber == undefined)
        throw([LABEL, "missing key 'stepNumber'"]);
      this.trigger("set-step-number", payload.stepNumber);
      return this.notifySender(payload, payload.stepNumber, 'step-number');
    } catch (e) {
      return this.notifySender(payload, [LABEL, e], 'step-number', "failed");
    }
  }

  async createSteps(payload) {
    const LABEL = "<StepModel::createSteps>"; console.log(LABEL);
    try {
      const schema = await this.microdrop.schema.flatten();
      return this.notifySender(payload, Steps(schema), 'create-steps');
    } catch (e) {
      return this.notifySender(payload, [LABEL, e], 'create-steps', 'failed');
    }
  }
  async updateStep(payload) {
    const LABEL = "<StepModel::updateStep>"; console.log(LABEL);
    try {
      if (payload.key == undefined) throw([LABEL, "payload.key missing"]);
      if (payload.val == undefined) throw([LABEL, "payload.val missing"]);
      if (payload.stepNumber == undefined) throw([LABEL, "payload.stepNumber missing"]);

      const steps = await this.microdrop.steps.steps();
      const step = steps[payload.stepNumber];
      step[payload.key] = payload.val;
      this.trigger("set-steps", steps);
      return this.notifySender(payload, step, 'update-step');
    } catch (e) {
      return this.notifySender(payload, [LABEL, e], 'update-step', "failed");
    }
  }
  async deleteStep(payload) {
    /* Delete steps at payload.stepNumber */
    const LABEL = "<StepModel::deleteStep>"; console.log(LABEL);
    try {
      if (payload.stepNumber == undefined) throw([LABEL, "missing stepNumber"]);
      let stepNumber = await this.microdrop.steps.currentStepNumber();
      let steps = await this.microdrop.steps.steps();
      // Delete step
      steps.splice(payload.stepNumber, 1);
      steps = UpdateStepNumbers(steps);
      // If step number is now out of range, change it to the last step
      if (stepNumber >= steps.length) {
        stepNumber = steps.length -1;
        this.trigger("set-step-number", stepNumber);
      }
      // Update steps
      this.trigger("set-steps", steps);
      return this.notifySender(payload, steps, 'delete-step');
    } catch (e) {
      return this.notifySender(payload, [LABEL, e], 'delete-step');
    }
  }
  async insertStep(payload) {
    /* Insert Step After step number in payload */
    const LABEL = "<StepModel::insertStep>"; console.log(LABEL);
    try {
      if (payload.stepNumber == undefined) throw([LABEL, "missing stepNumber"]);
      let steps = await this.microdrop.steps.steps();
      // Create new step
      const step = _.cloneDeep(steps[payload.stepNumber]);
      // Insert step into the currently stored steps
      steps.splice(payload.stepNumber+1, 0, step);
      steps = UpdateStepNumbers(steps);
      // Update steps
      this.trigger("set-steps", steps);
      return this.notifySender(payload, steps, 'insert-step');
    } catch (e) {
      return this.notifySender(payload, [LABEL, e], 'insert-step', "failed");
    }
  }
}
module.exports = StepModel;
