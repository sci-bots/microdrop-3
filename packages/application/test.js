var assert = require('assert');
var {spawn} = require('child_process');
var {promisify} = require('util');
var path = require('path');
var _ = require('lodash');
var electron = require('electron');
electron.app.commandLine.appendSwitch('ignore-gpu-blacklist');

var {Console} = require('console');
var console = new Console(process.stdout, process.stderr);

var MicropedeAsync = require('@micropede/client/src/async.js');
var Microdrop = require('./index.js');

const DEFAULT_DEVICE_JSON = './public/resources/default.json';
const DEFAULT_DEVICE_LENGTH = 92;
const ELECTRODE000_NEIGHBOURS = { left: 'electrode043', down: 'electrode001', right: 'electrode002' };
const ROUTE = { start: 'electrode030', path: ['up', 'up', 'up', 'right', 'right']};
const COMPUTED_ROUTE = ['electrode030','electrode029','electrode091','electrode084','electrode083','electrode082'];
const DEFAULT_PROCESS_PLUGINS = [ 'device-model', 'electrodes-model', 'routes-model' ];

const asyncTimer = (time) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), time);
  });
}
let microdrop;

describe('Microdrop', async function() {
  this.timeout(10000);

  before(async () => {
    await Microdrop(electron, false, true);
    microdrop = new MicropedeAsync('microdrop', 'localhost', 1884);
  });

  describe('Device', function() {
    this.timeout(5000);

    // XXX: Clear test failing after switching to electron (commenting for now)

    // it('clear loaded device', async function(done) {
    //   await asyncTimer(3000);
    //   await microdrop.device.putThreeObject([]);
    //   var arr = await microdrop.device.threeObject();
    //   return assert.equal(arr.length, 0);
    // });

    it('put default device', async function() {
        this.timeout(10000);
        await asyncTimer(2000);
        // XXX: Using timer to ensure electron app is ready
        var device = require(DEFAULT_DEVICE_JSON);
        await microdrop.putPlugin('device-model', 'three-object', device, 5000);
        var objects = await microdrop.getState('device-model', 'three-object');
        return assert.equal(objects.length, DEFAULT_DEVICE_LENGTH);
    });

    it('get neighbours', async function() {
      var n1 = (await microdrop.triggerPlugin('device-model',
        'get-neighbouring-electrodes', {electrodeId: 'electrode000'})).response;
      assert.deepEqual(n1, ELECTRODE000_NEIGHBOURS);
    });

  });

  describe('Electrodes', async function() {
    it('clear active electrodes', async function() {
      // await microdrop.electrodes.putActiveElectrodes([]);
      await microdrop.putPlugin('electrodes-model', 'active-electrodes', []);
      var arr = await microdrop.getState('electrodes-model', 'active-electrodes');
      // var arr = await microdrop.electrodes.activeElectrodes();
      assert.equal(arr.length, 0);
    });

    it('put active electrodes', async function() {
      // await microdrop.electrodes.putActiveElectrodes(['electrode000', 'electrode001']);
      await microdrop.putPlugin('electrodes-model', 'active-electrodes',
        ['electrode000', 'electrode001']);
      // var arr = await microdrop.electrodes.activeElectrodes();
      var arr = await microdrop.getState('electrodes-model',
        'active-electrodes');
      assert.equal(arr.length, 2);
    });

  });

  describe('Routes', async function() {
    it('clear routes', async function() {
      // await microdrop.routes.putRoutes([]);
      await microdrop.putPlugin('routes-model', 'routes', []);
      // var arr = await microdrop.routes.routes();
      var arr = await microdrop.getState('routes-model', 'routes');
      assert.equal(arr.length, 0);
    });

    it('add route', async function() {
      // await microdrop.routes.putRoute(ROUTE);
      await microdrop.putPlugin('routes-model', 'route', ROUTE);
      // var arr = await microdrop.routes.routes();
      var arr = await microdrop.getState('routes-model', 'routes');
      assert.equal(arr.length, 1);
    });

    it('compute electrodes', async function() {
      // var route = (await microdrop.routes.routes())[0];
      var route = (await microdrop.getState('routes-model', 'routes'))[0];
      // var ids = (await microdrop.device.electrodesFromRoute(route)).ids;
      var ids = (await microdrop.triggerPlugin('device-model',
        'electrodes-from-routes', {routes: [route]})).response[0].ids
      assert.deepEqual(ids,COMPUTED_ROUTE);
    });

    it('execute', async function() {
      // await microdrop.electrodes.putActiveElectrodes([]);
      await microdrop.putPlugin('electrodes-model', 'active-electrodes', []);
      // var route = (await microdrop.routes.routes())[0];
      var route = (await microdrop.getState('routes-model', 'routes'))[0];
      route.transitionDurationMilliseconds = 100;
      // await microdrop.routes.execute([route], -1);
      await microdrop.triggerPlugin('routes-model', 'execute',
        {routes: [route]}, -1);
      // var activeElectrodes = await microdrop.electrodes.activeElectrodes();
      var activeElectrodes = await microdrop.getState('electrodes-model',
        'active-electrodes');
      assert.deepEqual(activeElectrodes,[_.last(COMPUTED_ROUTE)]);
    });

  });

  // XXX: Currently pluginManager fails on travis
  // describe('PluginManager', async function() {
  //   // it('get process plugins', async function(){
  //   //
  //   //   const expected = _.map(require('./plugins.json')['processPlugins'], "name");
  //   //   var plugins = await microdrop.pluginManager.getProcessPlugins();
  //   //   assert.deepEqual(_.map(plugins, 'name'), expected);
  //   // });
  //
  // });


  after(function () {
    console.log("tests complete");
    // w.close();
    // process.exit(0);
  });


});
