// const MoscaServer  = require('./MoscaServer');
const Broker = require('@micropede/broker/src/index.js');

const clientPort = 8083;
const brokerPort = 1884;
const broker = new Broker('microdrop',clientPort, brokerPort);
