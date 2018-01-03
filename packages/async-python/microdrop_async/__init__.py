import asyncio
from time import sleep, time
from random import randint

from mqttclient import MqttClient

def generateId():
    timestamp = str(time()).replace(".","")
    randnum = randint(1,1000)
    return f'microdrop-async-{timestamp}-{randnum}'

class MicrodropAsync(MqttClient):
    def __init__(self):
        self._name = generateId()
        super().__init__()

    @property
    def name(self):
        return self._name

    def listen(self):
        self.trigger('client-ready', 'null')

    def client_ready(self, timeout=5):
        if (self.on('client-ready', ))
        loop = asyncio.get_event_loop()

    # async getSubscriptions(receiver, timeout=DEFAULT_TIMEOUT) {
    #   const payload = await this.triggerPlugin(receiver, "get-subscriptions", {}, timeout);
    #   return payload.response;
    # }
