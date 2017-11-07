DEFAULT_TIMEOUT = 10000;

class Steps {
  constructor(ms) {
    this.ms = ms;
  }

  async steps() {
    const LABEL = "<MicrodropAsync::Steps::step>"; console.log(LABEL);
    const steps = await this.ms.getState("step-model", "steps");
    return steps;
  }

  async register(timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Steps::register>"; console.log(LABEL);
    try {
      const msg = {__head__: {plugin_name: this.ms.name}};
      const d = await this.ms.triggerPlugin('step-model',
        'register-plugins', msg, timeout);
      if (d.status == 'success') return d.response;
      if (d.status != 'success') throw (d.response);
    } catch (e) {
      throw([LABEL, e]);
    }
  }

  async addAttribute(model, key, defaultVal=undefined, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Steps::addAttribute>"; console.log(LABEL);
    try {
      const msg = {
        __head__: {plugin_name: this.ms.name},
        model: model, key: key, default: defaultVal
      };
      return (this.ms.triggerPlugin('step-model', 'add-attribute', msg,
        timeout));
    } catch (e) {
      throw([LABEL, e]);
    }
  }

  async currentStep() {
    const LABEL = "<MicrodropAsync::Steps::currentStep>";
    try {
      const steps = await this.steps();
      const currentStepNumber = await this.currentStepNumber();
      return steps[currentStepNumber];
    } catch (e) {
      throw([LABEL, e]);
    }
  }

  async currentStepNumber(timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Steps::currentStepNumber>";
    try {
      const response = await this.ms.getState("step-model", "step-number",
        timeout);
      return response;
    } catch (e) {
      throw([LABEL, e]);
    }
  }

  async createStep(timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Steps::createStep>";
    try {
      const steps = await this.createSteps(timeout);
      return steps[0];
    } catch (e) {
      throw([LABEL, e]);
    }
  }

  async createSteps(timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Steps::createSteps>";
    try {
      const msg = { __head__: {plugin_name: this.ms.name} };
      const d = await this.ms.triggerPlugin('step-model', 'create-steps',
        msg, timeout);
      if (d.status == 'success') return d.response;
      else throw([LABEL, d.response]);
    } catch (e) {
      throw([LABEL, e]);
    }
  }

  async deleteStep(stepNumber, timeout=DEFAULT_TIMEOUT) {
    const msg = {
      __head__: {plugin_name: this.ms.name},
      stepNumber: stepNumber
    };
    const steps = await this.steps();
    await this.validateStepNumber(steps.length - 2);
    await this.validateStepNumber(stepNumber);
    return (this.ms.triggerPlugin('step-model', 'delete-step', msg, timeout));
  }

  async insertStep(stepNumber, timeout=DEFAULT_TIMEOUT) {
    const msg = {
      __head__: {plugin_name: this.ms.name},
      stepNumber: stepNumber
    };
    await this.validateStepNumber(stepNumber);
    return (await this.ms.triggerPlugin("step-model", "insert-step",
      msg, timeout));
  }

  async updateStep(key, val, stepNumber, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Steps::updateStep>";
    const msg = {
      __head__: {plugin_name: this.ms.name},
      key: key, val: val, stepNumber: stepNumber
    };
    await this.validateStepNumber(stepNumber);
    return (await this.ms.triggerPlugin("step-model", "update-step",
      msg, timeout));
  }

  async putSteps(steps, timeout=DEFAULT_TIMEOUT) {
    const msg = {
      __head__: {plugin_name: this.ms.name},
      steps: steps
    };
    return (await this.ms.putPlugin("step-model", "steps", msg, timeout));
  }

  async putStepNumber(stepNumber, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::Steps::putStepNumber>";
    try {
      const msg = {
        __head__: {plugin_name: this.ms.name},
        stepNumber: stepNumber
      };
      const response = await this.ms.putPlugin("step-model", "step-number",
        msg, timeout);
      return response;
    } catch (e) {
      throw([LABEL, e]);
    }
  }

  async validateStepNumber(stepNumber){
    const LABEL = "<MicrodropAsync#Steps> validateStepNumber";
    const steps = await this.steps();
    if (stepNumber >= steps.length)
      throw(`${LABEL}::Step number out of reach`);
    if (stepNumber < 0)
      throw(`${LABEL}::Step number less than zero`);
    return true;
  }
}

module.exports = Steps;
