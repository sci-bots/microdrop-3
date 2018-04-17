const {Console} = require('console');

const _ = require('lodash');
const uuid4 = require('uuid/v4');
const Ajv = require('ajv');

const MicropedeAsync = require('@micropede/client/src/async.js');
const {MicropedeClient, DumpStack} = require('@micropede/client/src/client.js');

const ajv = new Ajv({ useDefaults: true });
const console = new Console(process.stdout, process.stderr);
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled rejection (promise: ', event.promise, ', reason: ', event.reason, ').');
});
window.addEventListener('error', function(e) {
    console.error(e.message);
});

const APPNAME = 'microdrop';

const RoutesSchema = {
  type: "object",
  properties: {
    routes: {
      type: "array",
      default: [],
      items: {
        type: "object",
        properties: {
          start: {type: "string", set_with: 'routes'},
          path:  {type: "array", set_with: 'routes', default: [], hidden: true},
          "trail-length": {type: "integer", minimum: 1, default: 1, set_with: 'routes'},
          "repeat-duration-seconds": {type: "number", minium: 0, default: 1, set_with: 'routes'},
          "transition-duration-seconds": {type: "number", minimum: 0.1, default: 1, set_with: 'routes'},
          "route-repeats": {type: "integer", minimum: 1, default: 1, set_with: 'routes'}
        },
        required: ["start"]
      }
    }
  }
};

const RouteSchema = {
  type: "object",
  properties: {
    start: {type: "string"},
    path:  {type: "array"},
    "trail-length": {type: "integer", minimum: 1, default: 1},
    "repeat-duration-seconds": {type: "number", minium: 0, default: 1},
    "transition-duration-seconds": {type: "number", minimum: 0.1, default: 1},
    "route-repeats": {type: "integer", minimum: 1, default: 1}
  },
  required: ['start', 'path']
}

class RoutesModel extends MicropedeClient {
  constructor(appname=APPNAME, host, port, ...args) {
    console.log("Initializing Routes Model");
    super(appname, host, port, ...args);
    this.running = false;
    this.port = port;
    this.schema = RoutesSchema;
  }

  // ** Event Listeners **
  listen() {
    this.onPutMsg("routes", this.putRoutes.bind(this));
    this.onPutMsg("route", this.putRoute.bind(this));
    this.onTriggerMsg("add-electrode-to-sequence", this.addElectrodeToSequence.bind(this));
    this.onTriggerMsg("execute", this.execute.bind(this));
    this.onTriggerMsg("stop", this.stop.bind(this));
    this.bindSignalMsg("complete", "execution-complete");
  }

  // ** Getters and Setters **
  get channel() {return "microdrop/routes-data-controller";}
  get filepath() {return __dirname;}
  get isPlugin() {return true}

  async stop(payload) {
    const LABEL = "<RoutesModel::stop>"; // console.log(LABEL);
    try {
      // TODO: Verify exection stopped before notifying sender
      this.running = false;
      this.trigger("execution-complete", {});
      return this.notifySender(payload, {status: 'stopped'}, 'stop');
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e), 'stop', 'failed');
    }
  }

  async addElectrodeToSequence(payload, params) {
    /* Add electrode to running sequence */
    const LABEL = "<RoutesModel::addElectrodeToSequence>";
    const name = 'add-electrode-to-sequence';
    try {
      if (!this.running) {
        return this.notifySender(payload, 'already running', name);
      }

      // Add active electrodes to scheduler with on time of 0, off time of max,
      // so long as they are not part of any route
      _.each(payload.ids, (id) => {
        if (_.find(this.seq, {id}) == undefined) {
          this.seq.push({id: id, on: 0, off: maxTime});
        }
      });

      return this.notifySender(payload, 'already running', name);
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e), name, 'failed');
    }
  }

  async cacluateExecutionFrames(routes) {
    /* Calculate execution fromes using routes and active electrodes */
    const LABEL = "<RouteModel::calcuateExecutionFrames>";
    routes = routes || await this.getState("routes");
    const electrodes = await this.getState("active-electrodes", "electrodes-model");
    const tms = "transition-duration-seconds";
    let seq = [];

    // Extend path based on number of repeats
    for (const [i, route] of routes.entries()) {
      const repeats = route['repeat-duration-seconds'];
      const trans = route['transition-duration-seconds'];
      const len = route.path.length;

      let numRepeats;
      const microdrop = new MicropedeAsync(APPNAME, 'localhost', this.port);

      // Check if route contains a loop before continuing
      const ids = (await microdrop.triggerPlugin('device-model',
        'electrodes-from-routes', {routes: [route]})).response[0].ids;

      if (ids[0] != _.last(ids)) {
        const times = await ActiveElectrodeIntervals(route, this.port);
        seq = seq.concat(times);
        continue;
      }

      // Calculate number of repeats based on total route exec time
      numRepeats = Math.floor(( repeats ) / (trans *  len) + 1);

      // Override with manual step number if larger then calculated value
      if (route["route-repeats"] > numRepeats)
        numRepeats = route["route-repeats"];

      // Extend the path
      const org = _.clone(route.path);
      for (let j = 0; j < numRepeats-1; j++) {
        route.path = route.path.concat(org);
      }
      const times = await ActiveElectrodeIntervals(route, this.port);
      seq = seq.concat(times);
    }

    // Calculate scheduler properties
    const lengths  = _.map(routes, (r)=>r.path.length);
    const interval = _.min(_.map(routes, tms)) / routes.length;
    const maxInterval = _.max(_.map(routes, tms));
    const maxTime = maxInterval * _.max(lengths) * 2;

    // Add active electrodes to scheduler with on time if 0, off time of max,
    // so long as they are not part of any route
    _.each(electrodes, (id) => {
      if (_.find(seq, {id}) == undefined) {
        seq.push({id: id, on: 0, off: maxTime});
      }
    });

    return {lengths, interval, maxInterval, maxTime, seq};
  }

  async execute(payload, interval=1) {
    const LABEL = "<RoutesModel::execute>"; // console.log(LABEL);
    try {
      let routes = payload.routes;
      if (!routes) routes = await this.getState('routes');
      if (routes.length == 0) {
        // If no routes, return immediately
        return this.notifySender(payload, {status: 'stopped'}, 'execute');
      }
      if (!routes[0].start) throw("missing start in route");
      if (!routes[0].path) throw("missing path in route");
      if (this.running == true) throw("already running");

      const {lengths, interval, maxInterval, maxTime, seq} =
        await this.cacluateExecutionFrames(routes);
      this.seq = seq;

      await this.setState('status', 'running');

      const complete = () => {
        return new Promise((resolve, reject) => {
          const onComplete = () => {
            this.running = false;
            resolve("complete");
          }
          this.running = true;
          this.ExecutionLoop(interval, 0, maxTime, onComplete, this.port);
        });
      };

      await complete();

      await this.setState('status', 'stopped');
      this.trigger("execution-complete", {});
      return this.notifySender(payload, {status: 'stopped'}, 'execute');
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e), 'execute', 'failed');
    }
  }

  async putRoute(payload) {
    const LABEL = "<RoutesModel::putRoute>"; //console.log(LABEL);
    try {
      const schema = RouteSchema;

      // Validate route schema
      const validate = ajv.compile(schema);
      if (!validate(payload)) throw(_.map(validate.errors, (e)=>JSON.stringify(e)));
      var route = _.omit(payload, "__head__");

      const microdrop = new MicropedeAsync(APPNAME, 'localhost', this.port);
      // Validate path by checking if electrodesFromRoutes throws error
      // var e = await microdrop.device.electrodesFromRoute(route);
      var e = (await microdrop.triggerPlugin('device-model',
        'electrodes-from-routes', {routes: [route]}))[0];

      // Get previously stored routes (if failure then set to empty array)
      let routes = await this.getState('routes');
      if (routes == undefined) routes = [];

      // Check if route exists, and if so override
      var index = _.findIndex(routes, {uuid: route.uuid});

      // Add route to routes
      if (index != -1) {
        routes[index] = route;
      } else {
        route.uuid = uuid4();
        routes.push(route);
      }

      // Update state of microdrop
      // routes = await microdrop.routes.putRoutes(routes);
      routes = await microdrop.putPlugin('routes-model', 'routes', routes);
      return this.notifySender(payload, {routes, route}, 'route');
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e), 'route', 'failed');
    }
  }

  async putRoutes(payload) {
    const LABEL = "<RoutesModel::putRoutes>"; //console.log(LABEL);
    try {
      if (!payload.routes) throw("missing payload.routes");
      if (!_.isArray(payload.routes)) throw("payload.routes not an array");
      const routes = payload.routes;
      await this.setState('routes', routes);
      return this.notifySender(payload, routes, 'routes');
    } catch (e) {
      return this.notifySender(payload, DumpStack(LABEL, e), 'routes', 'failed');
    }
  }

  async ExecutionLoop(interval, currentTime, maxTime, callback, port) {
    try {
      // If running set to false manually, return immediately
      if (!this.running) {
        console.log("Execution aborted");
        callback();
        return;
      }

      // Execute Loop continuously until maxTime is reached
      await wait(interval*1000.0);

      const {active, remaining} = ActiveElectrodesAtTime(this.seq, currentTime);
      const microdrop = new MicropedeAsync(APPNAME, 'localhost', port);
      await microdrop.putPlugin('electrodes-model', 'active-electrodes', {
        'active-electrodes': _.map(active, "id")
      });

      if (remaining.length == 0) {callback(); return}
      if (currentTime+interval >= maxTime) {callback(); return}
      this.ExecutionLoop(interval, currentTime+interval, maxTime, callback, port);
    } catch (e) {
      console.error(DumpStack('ExecutionLoop', e));
    }
 }
}

const wait = (interval) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve("wait-complete")
    }, interval);
  });
}

function ActiveElectrodesAtTime(elecs, t) {
  // Return active electrodes for a given time (t)
  const active = _.filter(elecs, (e) => t >= e.on && t < e.off);
  const remaining = _.filter(elecs, (e) => t < e.on);
  return {active, remaining}
}

async function ActiveElectrodeIntervals(r, port) {
  const microdrop = new MicropedeAsync(APPNAME, 'localhost', port);
  // Get electrode intervals based on a routes time properties
  const seq = (await microdrop.triggerPlugin('device-model',
      'electrodes-from-routes', {routes: [r]}, 1001)).response[0];

  // ids, uuid
  const times = [];
  for (const [i, id] of seq.ids.entries()) {
    const on  = r['transition-duration-seconds'] * (i-r['trail-length']+1);
    let off = r['transition-duration-seconds'] * (i+1);
    if (i == (seq.ids.length - 1)) {
      off = 1e10;
    }
    const index = i;
    times.push({id, on, off, index});
  }
  return times;
}

module.exports = RoutesModel;

if (require.main === module) {
  try {
    console.log("STARTING ROUTES MODEL");
    model = new RoutesModel();
  } catch (e) {
    console.error('RoutesModel failed!', e);
  }
}
