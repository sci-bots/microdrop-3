const lo = require("lodash");

class Schema {
  constructor(ms) {
    this.ms = ms;
  }
  async schema() {
    return (await this.ms.getState("schema-model", "schema"));
  }

  async flatten() {
    const schema = await this.ms.getState("schema-model", "schema");
    return Object.assign(...lo.values(schema));
  }
}

module.exports = Schema;
