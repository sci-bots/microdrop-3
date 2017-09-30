const fs = require('fs');
const path = require('path');

const _ = require('lodash');

const PluginModel = require('./PluginModel');

class SchemaModel extends PluginModel {
  /* Keeps track of custom properties defined by plugins */
  constructor(){
    // Check if plugins.json exists, and if not create it:
    if (!fs.existsSync(path.resolve(path.join(__dirname,"plugins.json"))))
      SchemaModel.generateSchemaJSON();
    super();
  }
  listen() {
    this.onPutMsg("schema", this.onPutSchema.bind(this));
    this.bindStateMsg("schema", "set-schema");

    this.trigger("set-schema", this.wrapData("schema", this.readSchema()));
  }
  get filepath() {return __dirname;}
  readSchema() {
    return JSON.parse(fs.readFileSync(SchemaModel.schemafile(), 'utf8'));
  }
  writeSchema(schema) {
    const filepath = SchemaModel.schemafile();
    const data = JSON.stringify(schema,null,4);
    fs.writeFileSync(filepath, data, 'utf8');
  }
  onPutSchema(payload) {
    // Read schema from file
    const schema = this.Schema();
    schema[payload.pluginName] = payload.schema;
    this.writeSchema(schema);
    this.trigger("set-schema", this.wrapData("schema", schema));
  }
  Schema() {
    const schema = this.readSchema();
    return schema;
  }
  static schemafile() {
    // TODO: Use non-absolute paths (this will break if we move models location)
    return path.resolve(path.join(__dirname, "schema.json"));
  }
  static generateSchemaJSON() {
    const defaultSchema = {defaults: {step: {default: 0, type: 'integer'}}};
    const filepath = SchemaModel.schemafile();
    const data = JSON.stringify(defaultSchema,null,4);
    fs.writeFileSync(filepath, data, 'utf8');
  }
};

module.exports = SchemaModel;
