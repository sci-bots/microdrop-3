DEFAULT_TIMEOUT = 10000;

class Protocol {
  constructor(ms) {
      this.ms = ms;
  }

  getProtocolByName(name) {
    return new Promise((resolve, reject) => {
      return this.protocols().then((protocols) => {
        for (var i=0;i<protocols.length;i++) {
          if (protocols[i].name == name) {
            resolve(protocols[i]);
          }
        }
        reject("Protocol not found");
      });
    });
  }

  async activeProtocol() {
    const protocols = await this.ms.getState("protocol-model", "protocols");
    const protocolSkeleton = await this.ms.getState("protocol-model", "protocol-skeleton");
    console.log("protocols", protocols);
    for (const [i, protocol] of protocols.entries()){
      if (protocol.name == protocolSkeleton.name) {
        return protocol;
      }
    }
    throw("<MicrodropAsync::activeProtocol> failed to find protocol");
  }

  protocols(timeout=DEFAULT_TIMEOUT) {
    return this.ms.getState("protocol-model", "protocols");
  }

  protocol_skeletons(timeout=DEFAULT_TIMEOUT) {
    return this.ms.getState("protocol-model", "protocol-skeletons");
  }

  newProtocol(timeout=DEFAULT_TIMEOUT) {
    // Create a new Microdrop Protocol
    const msg = { __head__: {plugin_name: this.ms.name} }
    return this.ms.triggerPlugin("protocol-model", "new-protocol",
      msg, timeout);
  }

  deleteProtocol(name, timeout=DEFAULT_TIMEOUT) {
    // TODO: Change delete-protocol to require only name in payload
    const msg = {
      __head__: {plugin_name: this.ms.name},
      protocol: {name: name}
    };
    return this.ms.triggerPlugin("protocol-model", "delete-protocol",
      msg, timeout);
  }

  async changeProtocol(name, timeout=DEFAULT_TIMEOUT) {
    const LABEL = "<MicrodropAsync::changeProtocol>";
    try {
      const msg = {
        __head__: {plugin_name: this.ms.name},
        name: name
      };
      const response = await this.ms.triggerPlugin("protocol-model",
        "change-protocol", msg, timeout);
      console.log(response);
      return response;
    } catch (e) {
      throw([LABEL, e]);
    }
  }

  loadProtocol(protocol, overwrite=false, timeout=DEFAULT_TIMEOUT) {
    const msg = {
      __head__: {plugin_name: this.ms.name},
      protocol: protocol,
      overwrite: overwrite
    };
    return this.ms.triggerPlugin("protocol-model", "load-protocol",
      msg, timeout);
  }

}

module.exports = Protocol;
