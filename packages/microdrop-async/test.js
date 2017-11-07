var MicrodropAsync = require("./MicrodropAsync");
var m = new MicrodropAsync();
var p = m.protocol;
var pm = m.pluginManager;
var d = m.device;
var r= m.routes;
var e = m.electrodes;
var s = m.steps;

var getLastProtocol = async () => {
  var protocols = await p.protocols();
  var len = protocols.length;
  var name = protocols[len-1].name;
  var protocol = await p.getProtocolByName(name);
  console.log("success", protocol);
  return protocol;
}

var deleteProtocol = async () => {
  var protocols = await p.protocols();
  console.log("protocols", protocols);
  var len = protocols.length;
  var name = protocols[len-1].name;
  console.log("name", name);
  var payload = await p.deleteProtocol(name);
  console.log("success", payload);
  return payload;
};
var loadProtocol = async () => {
  var protocols = await p.protocols();
  var protocol = protocols[0];
  output = await p.loadProtocol(protocol);
  if (output.requireConfirmation) {
    console.log("Already exists, giving confirmation to override");
    output = await p.loadProtocol(protocol, true);
  }
  console.log("success", output);
  return output;
};

var newProtocol = async () => {
  const protocol = await p.newProtocol();
  console.log(protocol);
};

var skeletons = async() => {
  const skeletons = await p.protocol_skeletons();
  console.log(skeletons);
};

var protocols = async() => {
  const protocols = await p.protocols();
  console.log(protocols);
}

var processPlugins = async() => {
  const plugins = await pm.getProcessPlugins();
  console.log("plugins", plugins);
}

var runningPlugins = async() => {
  const plugins = await pm.getRunningProcessPlugins();
  console.log("running plugins", plugins);
}

var findPlugin = async (name) => {
  const plugins = await pm.findProcessPluginByName(name);
  console.log(name, plugins);
}

var checkStatus = async (name) => {
  const runningState = await pm.checkStatusOfPluginWithName(name);
  console.log(name, "state", runningState);
}

var startPlugin = async (name) => {
  const status = await pm.checkStatusOfPluginWithName(name);
  console.log("running status before: ", status);
  const state = await pm.startProcessPluginByName(name);
  console.log(state);
}

var stopPlugin = async (name) => {
  const status = await pm.checkStatusOfPluginWithName(name);
  console.log("running status before: ", status);
  const state = await pm.stopProcessPluginByName(name);
  console.log(state);
}

var startDevice = async (name) => {
  const state = await d.startDeviceInfoPlugin();
  console.log(state);
}

var stopDevice = async (name) => {
  const state = await d.stopDeviceInfoPlugin();
  console.log(state);
}

var loadDeviceFile = async (filepath) => {
  let msg;
  if (m.environment == "node"){
    console.log("Loading from filepath");
    if (!filepath) {
      console.error("No file specified");
      return;
    }
    msg = await d.loadFromFilePath(filepath);
  } else {
    console.log("Opening fileprompt");
    msg = await d.loadFromFilePrompt();
  }
  console.log("msg", Object.keys(msg.response));
}

var getDevice = async() => {
  const response = await d.device();
  console.log(Object.keys(response));
}

var startPlanningPlugin = async () => {
  const response = await r.startDropletPlanningPlugin();
  console.log(response);
}

var stopPlanningPlugin = async () => {
  const response = await r.stopDropletPlanningPlugin();
  console.log(response);
}

var getElectrodes = async () => {
  const response = await e.electrodes();
  console.log(Object.keys(response));
}

var getChannels = async () => {
  const response = await e.channels();
  console.log(Object.keys(response));
}

var getSteps = async () => {
  const response = await s.steps();
  console.log("<TEST::getSteps>", response);
}
function test(action, input) {
  if (action == "protocol:load") loadProtocol();
  if (action == "protocol:new") newProtocol();
  if (action == "protocol:del") deleteProtocol();
  if (action == "protocol:skeletons") skeletons();
  if (action == "protocol:protocols") protocols();
  if (action == "manager:processPlugins") processPlugins();
  if (action == "manager:runningPlugins") runningPlugins();
  if (action == "manager:findPlugin") findPlugin(input);
  if (action == "manager:checkPluginState") checkStatus(input);
  if (action == "manager:startPlugin") startPlugin(input);
  if (action == "manager:stopPlugin") stopPlugin(input);
  if (action == "device:start") startDevice();
  if (action == "device:stop") stopDevice();
  if (action == "device:load") loadDeviceFile(input);
  if (action == "device:get") getDevice();
  if (action == "routes:startPlanningPlugin") startPlanningPlugin();
  if (action == "routes:stopPlanningPlugin") stopPlanningPlugin();
  if (action == "electrodes:electrodes") getElectrodes();
  if (action == "electrodes:channels") getChannels();
  if (action == "steps:steps") getSteps();
}
if (process) {
  test(process.argv[2], process.argv[3]);
}

module.exports = test;
