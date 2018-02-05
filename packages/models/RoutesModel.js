const {Console} = require('console');

const _ = require('lodash');
const uuid4 = require('uuid/v4');
const Ajv = require('ajv');

const MicropedeAsync = require('@micropede/client/src/async.js');
const {MicropedeClient, DumpStack} = require('@micropede/client/src/client.js');

const ajv = new Ajv({ useDefaults: true });
const console = new Console(process.stdout, process.stderr);

const APPNAME = 'microdrop';
const MQTT_PORT = 1884;

const RouteSchema = {
  type: "object",
  properties: {
    start: {type: "string"},
    path:  {type: "array"},
    trailLength: {type: "integer", minimum: 1, default: 1},
    repeatDurationSeconds: {type: "number", minium: 0, default: 1},
    transitionDurationMilliseconds: {type: "integer", minimum: 100, default: 1000},
    routeRepeats: {type: "integer", minimum: 1, default: 1}
  },
  required: ['start', 'path']
}

class RoutesModel extends MicropedeClient {
  constructor() {
    console.log("Initializing Routes Model");
    super(APPNAME, 'localhost', MQTT_PORT);
    this.running = false;
  }

  // ** Event Listeners **
  listen() {
    this.onPutMsg("routes", this.putRoutes.bind(this));
    this.onPutMsg("route", this.putRoute.bind(this));
    this.onTriggerMsg("execute", this.execute.bind(this));
  }

  // ** Getters and Setters **
  get channel() {return "microdrop/routes-data-controller";}
  get filepath() {return __dirname;}
  get isPlugin() {return true}

  async execute(payload, interval=1000) {
    const LABEL = "<RoutesModel::execute>";
    try {
      const routes = payload.routes;
      const tms = "transitionDurationMilliseconds";
      if (!routes) throw("missing routes in payload");
      if (!routes[0].start) throw("missing start in route");
      if (!routes[0].path) throw("missing path in route");
      if (this.running == true) throw("already running");

      let seq = [];

      // Extend path based on number of repeats
      for (const [i, route] of routes.entries()) {
        const repeats = route.repeatDurationSeconds;
        const trans = route.transitionDurationMilliseconds;
        const len = route.path.length;

        let numRepeats;
        const microdrop = new MicropedeAsync(APPNAME, 'localhost', MQTT_PORT);

        // Check if route contains a loop before continuing
        // const ids = (await microdrop.device.electrodesFromRoute(route)).ids;
        const ids = (await microdrop.triggerPlugin('device-model',
          'electrodes-from-routes', {routes: [route]})).response[0].ids;

        if (ids[0] != _.last(ids)) {
          const times = await ActiveElectrodeIntervals(route);
          seq = seq.concat(times);
          continue;
        }

        // Calculate number of repeats based on total route exec time
        numRepeats = Math.floor(( repeats * 1000 ) / (trans *  len) + 1);

        // Override with manual step number if larger then calculated value
        if (route.routeRepeats > numRepeats)
          numRepeats = route.routeRepeats;

        // Extend the path
        const org = _.clone(route.path);
        for (let j = 0; j < numRepeats-1; j++) {
          route.path = route.path.concat(org);
        }
        const times = await ActiveElectrodeIntervals(route);
        seq = seq.concat(times);
      }

      const lengths  = _.map(routes, (r)=>r.path.length);
      const interval = _.min(_.map(routes, tms)) / routes.length;
      const maxInterval = _.max(_.map(routes, tms));
      const maxTime = maxInterval * _.max(lengths) * 2;

      await this.setState('status', 'running');

      const complete = () => {
        return new Promise((resolve, reject) => {
          const onComplete = () => {
            this.running = false;
            resolve("complete");
          }
          this.running = true;
          ExecutionLoop(seq, interval, 0, maxTime, onComplete);
        });
      };

      await complete();

      await this.setState('status', 'stopped');

      return this.notifySender(payload, {status: 'running'}, 'execute');
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

      const microdrop = new MicropedeAsync(APPNAME, 'localhost', MQTT_PORT);
      // Validate path by checking if electrodesFromRoutes throws error
      // var e = await microdrop.device.electrodesFromRoute(route);
      var e = (await microdrop.triggerPlugin('device-model',
        'electrodes-from-routes', {routes: [route]}))[0];

      // Get previously stored routes (if failure then set to empty array)
      let routes
      try {
        // routes = await microdrop.routes.routes(500);
        routes = await microdrop.getState('routes-model', 'routes', 500);
      } catch (e) { routes = []; }

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

async function ActiveElectrodeIntervals(r) {
  const microdrop = new MicropedeAsync(APPNAME, 'localhost', MQTT_PORT);
  // Get electrode intervals based on a routes time properties
  const seq = (await microdrop.triggerPlugin('device-model',
      'electrodes-from-routes', {routes: [r]})).response[0];

  // ids, uuid
  const times = [];
  for (const [i, id] of seq.ids.entries()) {
    const on  = r.transitionDurationMilliseconds * (i-r.trailLength+1);
    const off = r.transitionDurationMilliseconds * (i+1);
    const index = i;
    times.push({id, on, off, index});
  }
  return times;
}

 async function ExecutionLoop(elecs, interval, currentTime, maxTime, callback) {
   try {
     // Execute Loop continuously until maxTime is reached
     await wait(interval);

     const {active, remaining} = ActiveElectrodesAtTime(elecs, currentTime);
     const microdrop = new MicropedeAsync(APPNAME, 'localhost', MQTT_PORT);
     await microdrop.putPlugin('electrodes-model', 'active-electrodes', {
       'active-electrodes': _.map(active, "id")
     });

     if (remaining.length == 0) {callback(); return}
     if (currentTime+interval >= maxTime) {callback(); return}

     ExecutionLoop(elecs, interval, currentTime+interval, maxTime, callback);
   } catch (e) {
     console.error(DumpStack('ExecutionLoop', e));
   }
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
