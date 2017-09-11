class ProtocolUI extends UIPlugin {
  constructor(elem, focusTracker) {
    super(elem, focusTracker, "ProtocolUI");
    this.controls = this.Controls();
    this.data = new Array();
    this.initialSteps = null;
    this.listen();
  }

  // ** Listeners **
  listen() {
    // State Routes (Ties to Data Controllers used by plugin):
    this.onStateMsg("protocol-model", "steps", this.onStepsUpdated.bind(this));
    this.onStateMsg("protocol-model", "step-number", this.onStepNumberUpdated.bind(this));
    this.onStateMsg("protocol-model", "schema", this.onSchemaUpdated.bind(this));

    this.bindPutMsg("protocol-model", "step-number", "update-step-number");
    this.bindTriggerMsg("protocol-model", "update-step", "update");
    this.bindTriggerMsg("protocol-model", "delete-step", "delete-step");
    this.bindTriggerMsg("protocol-model", "insert-step", "insert-step");

    // Implement these::
    this.bindTriggerMsg("protocol-model", "update-protocol-running-state", "update-protocol-running-state");
    this.bindTriggerMsg("protocol-model", "change-repeat", "change-repeat");

    // Local Updates
    this.on("mousedown", this.onMousedown.bind(this));
    this.on("prev-step-clicked", this.onPrevStepClicked.bind(this));
    this.on("next-step-clicked", this.onNextStepClicked.bind(this));
    this.on("play-clicked", this.onPlayClicked.bind(this));
    this.on("delete", this.onDelete.bind(this));
    D(this.element).on("mouseout", this.onMouseout.bind(this));
  }

  // ** Event Handlers (Between action and trigger) **
  onDelete(e) {
    this.trigger("delete-step", this.wrapData("stepNumber", this.step));
  }

  onMouseout(e) {
    if (e.target != this.element) return;
  }

  onMousedown(msg) {
    window.msg = msg;
    if (msg.target.nodeName != "TD") return;
    const src     = this.table.column(msg.target).dataSrc();
    const schema  = this.schema[src]

    // If step not selected, change step and exit
    const step = this.table.row(msg.target)[0][0];
    if (step != this.step){
      this.trigger("update-step-number", this.wrapData("stepNumber",step));
      return;
    }

    // XXX: Not all columns are part of schema, therefore can be undefined
    if (!schema) return;
    if (schema.type == "boolean") this.activateCheckbox(msg);
    if (schema.type == "number")  this.activateSpinner(msg);
  }

  onNextStepClicked(e) {
    const lastStep = this.data.length - 1;
    if (this.step == lastStep)
      this.trigger("insert-step",
                   this.wrapData("stepNumber", lastStep));
    if (this.step != lastStep)
      this.trigger("update-step-number",
                   this.wrapData("stepNumber", this.step+1));
  }

  onPlayClicked(e) {
    this.trigger("update-protocol-running-state",
                 this.wrapData("stepNumber", this.step));
  }

  onPrevStepClicked(e) {
    let prevStep;
    if (this.step == 0) prevStep = this.data.length -1;
    if (this.step != 0) prevStep = this.step-1;
    this.trigger("update-step-number", this.wrapData("stepNumber", prevStep));
  }

  onRepeatChanged(msg) {
    const val = parseInt(msg.target.value);
    this.trigger("change-repeat",
                 this.wrapData("repeat-val", val));
  }

  onUpdate(key,val,stepNumber) {
    const data = {stepNumber: stepNumber, key: key, val: val};
    this.trigger("update", this.wrapData("data", data));
  }

  onProtocolChanged(payload) {
    const protocol = JSON.parse(payload);
    const step_options = protocol.steps;
    this.updateSteps(step_options);
  }

  onStepNumberUpdated(payload) {
    this.step = JSON.parse(payload).stepNumber;
  }

  onStepsUpdated(payload) {
    const steps = JSON.parse(payload);
    this.updateSteps(steps);
  }

  onRepeatsChanged(payload) {
    const val = JSON.parse(payload);
    this.repeats = val;
  }

  onProtocolStateChanged(payload){
    const state = JSON.parse(payload);
    if (state == "running") this.controls.playbtn.innerText = "Pause";
    if (state == "paused")  this.controls.playbtn.innerText = "Play";
  }

  onSchemaUpdated(payload) {
    const schemas = JSON.parse(payload);
    this.schemas = schemas;
  }

  // ** Methods **
  activateCheckbox(msg) {
    const target_d = D(msg.target);
    const input_d  = D('<input type="checkbox">');
    const src      = this.table.column(msg.target).dataSrc();

    // Wrap tabel cell in checkbox:
    const previous_val = JSON.parse(target_d.innerText);
    target_d.empty();
    if (previous_val)  input_d.setAttribute("checked", true);
    if (!previous_val) input_d.removeAttribute("checked");
    target_d.appendChild(input_d.el);

    input_d.on("blur", () => {
      // When out of focus, unwrap cell, and modify data
      const new_val = input_d.el.checked;
      input_d.off();
      target_d.empty();
      this.onUpdate(src, new_val, this.step);
    });
  }
  activateSpinner(msg) {
    const target_d = D(msg.target);
    const input_d  = D('<input type="number">');
    const src      = this.table.column(msg.target).dataSrc();
    const schema   = this.schema[src]

    // Wrap tabel cell in textfield:
    const previous_val = target_d.innerText;
    target_d.empty();
    input_d.value = previous_val;

    if (schema.minimum !== undefined)
      input_d.setAttribute("min", schema.minimum)
    if (schema.maximum !== undefined)
      input_d.setAttribute("max", schema.maximum)

    target_d.appendChild(input_d.el);

    input_d.on("blur", () => {
      // When out of focus, unwrap cell, and modify data
      const new_val = JSON.parse(input_d.value);
      input_d.off();
      target_d.empty();
      this.onUpdate(src, new_val, this.step);
    });

    // XXX: Setting focus immediately doesn't work (wait 100ms)
    setTimeout(() => input_d.focus(), 100);
  }
  addStep() {
    const len = this.columns.length;
    const row = _.zipObject(this.columns, new Array(len).join(".").split("."));

    this.table.row.add(row);
    this.table.draw();
  }
  createDatatablesHeader(v,k) {
    // Get DataTables header based on schema entry
    // TODO: add more keys like type, width, etc
    return {title: k, data: k};
  }
  wrapData(key, value) {
    const msg = new Object();
    msg.__head__ = this.DefaultHeader();
    msg[key] = value;
    return msg;
  }

  // ** Getters and Setters **
  get name() { return "protocol-ui" }
  get styles() {
    const styles = new Object();
    styles.unselected = {background: "white", color: "black", width: "auto"};
    styles.selected   = {background: "#22509b", color: "white", width: "auto"};
    styles.label = {"font-size": "13px", "margin": "0px 5px"};
    return styles;
  }

  get step() {
    const row = D('tr', this.table.table().node()).filter(div => {
      return div.style.color == "white"
    });
    if (row[0])  return this.table.row(row)[0][0];
    if (!row[0]) return null;
  }

  set step(number) {
    if (!this.table) {
      console.error("Attempted to set step, but table was undefined.");
      return;
    }

    const table_d = D(this.table.table().node());
    const rows    = D('tr', table_d);
    // If row undefined then add step
    if (this.table.row(number).node() == null) {
      console.warn("Attempted to set step beyond table size, creating new step");
      this.addStep();
    }

    // Change selected step
    const row_d  = D(this.table.row(number).node());
    rows.forEach((i)=> D(i).setStyles(this.styles.unselected));
    row_d.setStyles(this.styles.selected);
  }

  get columns() {
    const schema = this.schema;
    return _.keys(schema);
  }

  get headers() {
    const schema = this.schema;
    const headers = _.map(schema, this.createDatatablesHeader);
    // XXX: Manually placing step column at first index (so that the table
    //      sorts by the this column by default):
    return headers;
  }
  get schemas() {return this._schemas}
  set schemas(schemas) {
    this._schemas = schemas;
    this.table = this.Table();
    if (this.initialSteps){
      // XXX: Should not require hot fix, (steps should be maintained
      //      w/ own getter/setter)
      this.updateSteps(this.initialSteps);
      delete this.initialSteps;
    }
  }
  get schema() {
    // Get total schema (from all schemas)
    const schema = new Object();
    _.each(_.values(this.schemas), (s) => {_.extend(schema,s)});
    return schema;
  }

  set repeats(val) {
    const field = this.controls.repeatField;
    field.setAttribute("value", val);
  }

  // ** Updaters **
  updateSteps(step_options){
    if (!this.table) {
      console.error("Attemted to update steps, but table was undefined");
      // XXX: Current hot depending on whether schema or steps loaded first
      this.initialSteps = step_options;
      return;
    }

    const step_count = step_options.length;
    const data_count = this.data.length;

    // If rows have been removed, remove them from data:
    if (data_count - step_count > 0){
      this.data = _.slice(this.data, 0,step_count);
      _.each(_.range(step_count,data_count), () => {
        this.table.row().remove();
      });
    }

    // Update data with modified schema values
    _.each(step_options, (step,i) => {
      if (!this.data[i]) this.data[i] = new Object();
      const options = _.assign.apply(_, _.values(step));
      _.each(options, (v,k) => { this.data[i][k] = v });
      const x = _.cloneDeep(this.data);
    });

    // Update step with new step options
    this.updateTable();
  }

  updateRow(step_options, step_number){
    const numberOfColumns = this.table.columns().header().length;
    const arr  = _.map(new Array(numberOfColumns), _.constant(""));
    const data = _.zipObject(this.columns, arr);

    if (step_number > this.table.rows().count()){
      console.error("Number of rows less than step number.");
      return;
    } else if (step_number == this.table.rows().count()){
      this.table.row.add(data);
    }
    _.extend(data, step_options);
    this.table.row(step_number).data(data).draw();
  }

  updateTable() {
    _.each(this.data, this.updateRow.bind(this));
  }

  // ** Initializers **
  Controls() {
    const controls = new Object();

    controls.leftbtn  = D("<button type='button'>Prev</button>");
    controls.playbtn  = D("<button type='button'>Play</button>");
    controls.rightbtn = D("<button type='button'>Next</button>");
    controls.repeatLabel = D("<label for='repeatCount'>Number of Repeats:</label>");
    controls.repeatField = D("<input type='number' id='repeatCount' min='1' value='1' />");
    controls.repeatLabel.setStyles(this.styles.label);

    controls.leftbtn.on("click", event => this.trigger("prev-step-clicked",event));
    controls.playbtn.on("click", event => this.trigger("play-clicked",event));
    controls.rightbtn.on("click", event => this.trigger("next-step-clicked",event));
    controls.repeatField.on("blur", event => this.onRepeatChanged(event));

    this.element.appendChild(controls.leftbtn.el);
    this.element.appendChild(controls.playbtn.el);
    this.element.appendChild(controls.rightbtn.el);
    this.element.appendChild(controls.repeatLabel.el);
    this.element.appendChild(controls.repeatField.el);

    return controls;
  }

  DefaultRow() {
    const row = _.zipObject(this.columns, _.map(this.columns, (c) => {
      if (!this.schema[c]) return 0;
      if (!this.schema[c].default) return 0;
      return this.schema[c].default;
    }));
    return row;
  }

  Table() {
    // remove, and recreate table
    // TODO: Destruct should be part of setter (when input is undefined)
    if (this.table) {
      const node = this.table.table().node();
      this.table.destroy();
      this.element.removeChild(node);
    }

    // Create dom element to house datatable
    const tableAsDomArray = D("<table></table>");
    const tableAsJquery   = $(tableAsDomArray.el);

    tableAsDomArray.setStyles({"font-size": "13px"});
    tableAsDomArray.addClasses("cell-border compact hover");
    tableAsDomArray.on("mousedown", event => this.trigger("mousedown", event));

    // Display options for datatable:
    const options = new Object();
    options.columns = this.headers;
    options.info = false;
    options.ordering = false;
    options.searching = false;
    options.paginate = false;

    // Initialize datatable
    this.element.append(tableAsDomArray.el);
    const dataTable = tableAsJquery.DataTable(options);

    // Add empty row with default data:
    dataTable.row.add(this.DefaultRow()).draw();
    return dataTable
  }

  // ** Static Methods **
  static position() {
    /* topLeft, topRight, bottomLeft, or bottomRight */
    return "bottomLeft";
  }

}

if (!window.microdropPlugins) window.microdropPlugins = new Map();
window.microdropPlugins.set("ProtocolUI", ProtocolUI);
