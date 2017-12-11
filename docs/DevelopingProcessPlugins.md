# Developing Process Plugins

This document outlines the differences between Web Plugins from Process Plugins. To understand the plugin architecture, please see

**[Developing UI Plugins](https://github.com/Lucaszw/microdrop-3/blob/master/docs/DevelopingUIPlugins.md)**

Process Plugins can be written in any language; although helper classes do exist for Nodejs and Python. The difference between Process Plugins and Web/UI Plugins is that Process Plugins run as separate processes, whereas Web/UI Plugins are tied to the webpage.

For python plugins, a helper library is available. See: https://github.com/Lucaszw/paho-mqtt-helpers

For node plugins, see https://github.com/Lucaszw/microdrop-3/blob/master/ui/src/mqtt-client.js

## Python Plugin Skeleton

```python
from pandas_helpers import PandasJsonEncoder, pandas_object_hook
import paho_mqtt_helpers as pmh


class SamplePythonPlugin(pmh.BaseMqttReactor):

  def start(self):
    # Connect to MQTT broker.
    self._connect()
    # Start loop in background thread.
    signal.signal(signal.SIGINT, self.exit)
    self.mqtt_client.loop_forever()

  def on_disconnect(self, *args, **kwargs):
    # Startup Mqtt Loop after disconnected (unless should terminate)
    if self.should_exit:
        sys.exit()
    self._connect()
    self.mqtt_client.loop_forever()

  def on_connect(self, client, userdata, flags, rc):
    self.listen()
    # Notify the broker that the plugin has started:
    self.mqtt_client.publish("microdrop/sample-python-plugin/plugin-started",
                             json.dumps(self.plugin_path), retain=True)
    ...

  def exit(self, a=None, b=None):
    self.mqtt_client.publish('microdrop/sample-python-plugin/plugin-exited', "{}", retain=True)
    self.should_exit = True
    self.mqtt_client.disconnect()

  def onExit(self, payload, args):
    """ Called when other plugins request termination of this plugin """
    self.exit()

  def listen(self):
    ...
    self.onPutMsg("some-property", self.onPutSomeProperty)
    self.subscribe()

  def on_message(self, client, userdata, msg):
    '''
    Callback for when a ``PUBLISH`` message is received from the broker.
    '''
    try:
        json.loads(msg.payload)
    except ValueError:
        print "Message contains invalid json"
        return False

    method, args = self.router.match(msg.topic)
    if method:
        method(json.loads(msg.payload, object_hook=pandas_object_hook),
               args)

```
