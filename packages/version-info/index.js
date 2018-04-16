const {Console} = require('console');
const path = require('path');

const _ = require('lodash');

const MicropedeClient = require('@micropede/client');
const MicropedeAsync = require('@micropede/client/src/async');

const console = new Console(process.stdout, process.stderr);

const APPNAME = 'microdrop';
const CLIENTNAME = 'VersionManager';
const HTTP_PORT = 3000;
const MQTT_TCP_PORT = 1884;
const MQTT_WS_PORT = 8083;

module.exports.InitVersionManager = (server, options={}) => {
  const ports = options.ports || {
    http_port: HTTP_PORT,
    mqtt_ws_port: MQTT_WS_PORT,
    mqtt_tcp_port: MQTT_TCP_PORT
  };
  const port = ports.mqtt_tcp_port;

  /* Extend express server with endpoints for handling version updating */
  let u = undefined;
  let client = new MicropedeClient(APPNAME, u, port, CLIENTNAME, u, {
      storageUrl: `http://localhost:${ports.http_port}`,
      resubscribe: false
  });

  let plugins = [];
  let storageFile;

  client.listen = () => {
    client.onStateMsg("{name}", "version", (version, params) => {
      let name = params.name;
      let plugin = _.find(plugins, {name});
      if (plugin == undefined) {
        plugin = {
          name,
          version,
          get needsUpdating() {
            if (!this.storageVersion) return false;
            if (this.storageVersion) return this.version > this.storageVersion;
          }
        };
        plugins.push(plugin);
      } else {
        plugin.version = version;
      }
    });
  };

  server.post('/validate-file', (req, res) => {
    /* Validate filedata is compatible with current microdrop version */
    try {
      let storage = req.body;
      const rep = (s) => s.replace("microdrop/","").replace("/state/version", "");
      let versionsMsgs = _.filter(storage, (v,k)=>_.includes(k,"/version"));
      let versions = _.map(versionsMsgs, (msg) => {
        return {name: rep(msg.topic), version: msg.payload}
      });
      _.each(plugins, (p) => {
        let plugin = _.find(versions, {name: p.name});
        if (plugin)  p.storageVersion = plugin.version;
        if (!plugin) p.storageVersion = p.version;
      });
      storageFile = storage;
      res.send(plugins);
    } catch (e) {
      res.status(500).json({ error: e.toString() });
    }
  });

  server.get('/version-manager-plugins', (req, res) => {
    try {
      res.json(plugins);
    } catch (e) {
      res.status(500).json({ error: e.toString() });
    }
  });

  server.get('/modify-plugin-version', (req, res) => {
    try {
      let {key, val, name} = req.query;
      let plugin = _.find(plugins, {name});
      plugin.version = val;
      res.json(plugin);
    } catch (e) {
      res.status(500).json({ error: e.toString() });
    }
  });

  server.get('/modify-storage-version', (req, res) => {
    try {
      let {val, name} = req.query;
      let storageKeyPrefix = `${APPNAME}!!retained!${APPNAME}/${name}/state`;
      let storage = storageFile[`${storageKeyPrefix}/version`];
      let plugin = _.find(plugins, {name});
      storage.payload = val;
      plugin.storageVersion = val;
      res.json(plugin);
    } catch (e) {
      res.status(500).json({ error: e.toString() });
    }
  });

  server.get('/perform-upgrade', async (req, res) => {
    try {
      const {name} = req.query;
      let storageKeyPrefix = `${APPNAME}!!retained!${APPNAME}/${name}/state`;
      let stats = [];
      let responses = {};
      let storageVersion = storageFile[`${storageKeyPrefix}/version`].payload;
      let pluginVersion = _.find(plugins, {name}).version;

      await Promise.all(_.map(storageFile, async (v, k) => {
        if (_.includes(k, storageKeyPrefix)) {
          if (k == `${storageKeyPrefix}/version`) return;
          let state = storageFile[k].payload;
          let payload = {state, storageVersion, pluginVersion};
          const microdrop = new MicropedeAsync(APPNAME, undefined, port);
          let d = await microdrop.triggerPlugin(name, 'update-version', payload);
          stats.push(d.status == "success");
          responses[k] = {key: k, val: d.response};
        }
      }));

      let plugin = _.find(plugins, {name});
      plugin.response = _.map(_.values(responses), JSON.stringify).join("\n");
      if (!_.includes(stats, false)) {
        plugin.storageVersion = plugin.version;
        _.map(responses, async (v, k) => {
          storageFile[`${storageKeyPrefix}/${k}`] = v;
        });
      }
      res.json(plugin);
    } catch (e) {
      res.status(500).json({ error: e.toString() });
    }
  });

}

module.exports.GetPath = () => {
  return path.resolve(__dirname, 'public');
}
