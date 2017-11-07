const WebMixins = new Object();

const IsJsonString = (str) => {
  try { JSON.parse(str);} catch (e) {return false;}
  return true;
}

DEFAULT_TIMEOUT = 10000;

WebMixins.newMessage = function(topic, timeout=DEFAULT_TIMEOUT) {
  const LABEL = "<MicrodropAsync::WebMixins::newMessage>";
  return new Promise((resolve, reject) => {
    this.client.onMessageArrived = (msg) => {
      if (msg.destinationName != topic) return;

      const payloadIsValid = IsJsonString(msg.payloadString);
      if (payloadIsValid) resolve(JSON.parse(msg.payloadString));
      if (!payloadIsValid) {
        reject("<MicrodropAsync.Web>#newMessage Payload Invalid")};
    }
    this.client.subscribe(topic);
    setTimeout(()=>{reject([LABEL, `Timeout (${timeout})`])}, timeout);
  });
}

WebMixins.clearSubscriptions = function(timeout=DEFAULT_TIMEOUT) {
  const subscriptions = this.subscriptions;

  // Unsubscribe to all previous messages:
  const unsubscribe = (prev=null) => {
    return new Promise((resolve, reject) => {
      this.client.unsubscribe("#",{
        onSuccess: () => {
          resolve(this.subscriptions);
        },
        onFailure: () => {
          reject("unsubscribe");
        }
      });
    });
  };
  // Disconnect client:
  const disconnect = (prev=null, timeout=DEFAULT_TIMEOUT) => {
    return new Promise((resolve, reject) => {
      this.client.onConnectionLost = () => {
        resolve(this.client.isConnected());
      }
      this.client.disconnect();
      setTimeout(()=>{
        reject(`Timeout (${timeout})`);
      }, timeout);
    });
  };
  // Reconnect client:
  const connect = (prev=null) => {
    return new Promise((resolve, reject) => {
      this.client.connect({
        onSuccess: () => {
          for (const [i, sub] of subscriptions.entries()) {
            console.log("Subscribing::", sub);
            this.client.subscribe(sub);
          }
          // Re-add client event bindings (removed after disconnect)
          this.client.onMessageArrived = this.onMessageArrived.bind(this);
          resolve(this.client.isConnected())
        },
        onFailure: () => {
          reject("failed to connect")}
      });
    });
  };
  const makeRequest = async () => {
    try {
      await unsubscribe();
      await disconnect();
      await connect();
    }catch(e) {
      console.error(e);
      throw([`<MicrodropAsync::Web::clearSubscriptions>`, e ]);
    }
    return this.client;
  }

  return makeRequest();
}

module.exports = WebMixins;
