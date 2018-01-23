const yo = require('yo-yo');
const MicropedeAsync = require('@micropede/client/src/async.js');
const APPNAME = 'microdrop';

const RouteMixins = {};

RouteMixins.changeRoute = function () {
  const obj = _.last(this.editor.history.history);
  const microdrop = new MicropedeAsync(APPNAME);
  microdrop.putPlugin('routes-model', 'route', this.editor.get());
}

RouteMixins.renderSelectedRoute = async function () {
  const LABEL = "StateSaver::renderSelectedRoute";
  try {
    const microdrop = new MicropedeAsync(APPNAME);
    let uuid = await microdrop.getState("route-controls", "selected-route", 500);
    const routes = _.get(this.json, ["routes-model", "routes"]) || [];
    this.editor.set(_.find(routes, { uuid }));
  } catch (e) {
    console.error(LABEL, e);
  }
}

module.exports = RouteMixins;
