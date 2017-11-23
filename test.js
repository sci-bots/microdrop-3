var assert = require('assert');
var {spawn} = require('child_process');
var {promisify} = require('util');
var _ = require('lodash');
var {launchMicrodrop} = require('./index');
var MicrodropAsync = require('@microdrop/async/MicrodropAsync');

const DEFAULT_DEVICE_JSON = './resources/default.json';
const DEFAULT_DEVICE_LENGTH = 92;
const ELECTRODE000_NEIGHBOURS = { left: 'electrode043', down: 'electrode001', right: 'electrode002' };
const ROUTE = { start: 'electrode030', path: ['up', 'up', 'up', 'right', 'right']};
const COMPUTED_ROUTE = ['electrode030','electrode029','electrode091','electrode084','electrode083','electrode082'];
const DEFAULT_PROCESS_PLUGINS = [ 'device-model', 'electrodes-model', 'routes-model' ];

describe('MicrodropAsync', async function() {
  this.timeout(10000);
  // var child = spawn('node', ['index.js'], {stdio: 'inherit'});
  launchMicrodrop();
  var microdrop = new MicrodropAsync();

  describe('Device', async function() {
    it('clear loaded device', async function() {
      await microdrop.device.putThreeObject([]);
      var arr = await microdrop.device.threeObject();
      assert.equal(arr.length, 0);
    });

    it('put default device', async function() {
      var device = require(DEFAULT_DEVICE_JSON);
      await microdrop.device.putThreeObject(device);
      var objects = await microdrop.device.threeObject();
      assert.equal(objects.length, DEFAULT_DEVICE_LENGTH);
    });

    it('get neighbours', async function() {
      var n1 = await microdrop.device.getNeighbouringElectrodes('electrode000');
      assert.deepEqual(n1, ELECTRODE000_NEIGHBOURS);
    });

  });

  describe('Electrodes', async function() {
    it('clear active electrodes', async function() {
      await microdrop.electrodes.putActiveElectrodes([]);
      var arr = await microdrop.electrodes.activeElectrodes();
      assert.equal(arr.length, 0);
    });

    it('put active electrodes', async function() {
      await microdrop.electrodes.putActiveElectrodes(['electrode000', 'electrode001']);
      var arr = await microdrop.electrodes.activeElectrodes();
      assert.equal(arr.length, 2);
    });

  });

  describe('Routes', async function() {
    it('clear routes', async function() {
      await microdrop.routes.putRoutes([]);
      var arr = await microdrop.routes.routes();
      assert.equal(arr.length, 0);
    });

    it('add route', async function() {
      await microdrop.routes.putRoute(ROUTE);
      var arr = await microdrop.routes.routes();
      assert.equal(arr.length, 1);
    });

    it('compute electrodes', async function() {
      var route = (await microdrop.routes.routes())[0];
      var ids = (await microdrop.device.electrodesFromRoute(route)).ids;
      assert.deepEqual(ids,COMPUTED_ROUTE);
    });

    it('execute', async function() {
      await microdrop.electrodes.putActiveElectrodes([]);
      var route = (await microdrop.routes.routes())[0];
      route.transitionDurationMilliseconds = 100;
      await microdrop.routes.execute([route], -1);
      var activeElectrodes = await microdrop.electrodes.activeElectrodes();
      assert.deepEqual(activeElectrodes,[_.last(COMPUTED_ROUTE)]);
    });

  });

  describe('PluginManager', async function() {
    it('running process plugins', async function(){
      var plugins = await microdrop.pluginManager.getRunningProcessPlugins();
      assert.deepEqual(_.map(plugins, 'name'), DEFAULT_PROCESS_PLUGINS);
    });
    it('running process plugins', async function(){
      var plugins = await microdrop.pluginManager.getRunningProcessPlugins();
      assert.deepEqual(_.map(plugins, 'name'), DEFAULT_PROCESS_PLUGINS);
    });
  });


});
