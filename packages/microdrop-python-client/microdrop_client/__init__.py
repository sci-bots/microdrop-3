""" Library for controlling Microdrop """

__version__ = '0.0.1'

import asyncio
from threading import Timer
from time import sleep, time
from random import randint

import pydash as _

from mqttclient import MqttClient

DEFAULT_TIMEOUT = 10000.0

def generate_id():
    timestamp = str(time()).replace(".","")
    randnum = randint(1,1000)
    return f'microdrop-py-{timestamp}-{randnum}'


class MyMqttClient(MqttClient):
    def __init__(self):
        self._name = generate_id()
        super().__init__()
    def listen(self):
        self.trigger('client-ready', 'null')
    @property
    def name(self):
        return self._name


class Microdrop:
    """ Library for controlling Microdrop """
    def __init__(self):
        self.mqttclient = MyMqttClient()
        self.loop = asyncio.get_event_loop()

    def execute(self, protocol, *args, **kwargs):
        self.loop.run_until_complete(protocol(self, *args, **kwargs))

    def safe(self, method):
        return lambda *m, **kw: self.loop.call_soon_threadsafe(method, *m, **kw)

    def reset_client(self, timeout=DEFAULT_TIMEOUT):
        """ Create new client """
        future = asyncio.Future()
        self.mqttclient.client.disconnect()
        del self.mqttclient
        self.mqttclient = MyMqttClient()

        def client_ready(*args):
            self.connected = True
            if (not future.done()):
                future.set_result('client is ready')

        if self.mqttclient.connected:
            client_ready(self)
        else:
            self.mqttclient.on('client-ready', self.safe(client_ready))

        self.timeout(future, timeout)
        return future

    def timeout(self, future, timeout=DEFAULT_TIMEOUT):
        msg = f'timed out in {timeout}ms'

        def t():
            if (not future.done()):
                future.set_exception(Exception(msg))

        Timer(timeout/1000.0, t).start()

    async def get_state(self, sender, prop, timeout=DEFAULT_TIMEOUT):
        """ Get state of microdrop property """
        LABEL = '<MicrodropPython::get_state>'
        topic = f'microdrop/{sender}/state/{prop}'

        try:
            await self.reset_client()
            future = asyncio.Future()
            def state_msg(payload):
                if (not future.done()):
                    future.set_result(payload)

            self.mqttclient.on_state_msg(sender, prop, self.safe(state_msg))
            self.timeout(future, timeout)

            return await future

        except Exception as err:
            raise self.dump_stack([LABEL, topic], err)

    async def get_subscriptions(self, receiver, timeout=DEFAULT_TIMEOUT):
        LABEL = f'<MicrodropPython::get_subscriptions::{receiver}>'
        try:
            payload = await self.trigger_plugin(receiver, 'get-subscriptions', {}, timeout)
            return payload['response']
        except Exception as err:
            raise self.dump_stack(LABEL, err)

    async def put_plugin(self, receiver, prop, val, timeout=DEFAULT_TIMEOUT):
        LABEL = f'<MicrodropPython::put_plugin::{receiver}>'
        try:
            if not isinstance(val, dict):
                msg = {}
                _.set_(msg, prop, val)
                val = msg
            await self.reset_client()
            return await self.call_action(receiver, prop, val, 'put', timeout)
        except Exception as err:
            raise self.dump_stack(LABEL, err)

    async def trigger_plugin(self, receiver, action, val={}, timeout=DEFAULT_TIMEOUT):
        LABEL = f'<MicrodropPython::trigger_plugin::{receiver}::{action}>'
        try:
            await self.reset_client()
            result = await self.call_action(receiver, action, val, 'trigger', timeout)
            return result
        except Exception as err:
            raise self.dump_stack(LABEL, err)


    async def call_action(self, receiver, action, val, msg_type='trigger', timeout=DEFAULT_TIMEOUT):
        LABEL = '<MicrodropPython::call_action>'
        no_timeout = False
        if (timeout == -1):
            timeout = DEFAULT_TIMEOUT
            no_timeout = True

        topic = f'microdrop/{msg_type}/{receiver}/{action}'
        sub = f'microdrop/{receiver}/notify/{self.mqttclient.name}/action'
        _.set_(val, "__head__.plugin_name", self.mqttclient.name)
        future = asyncio.Future()

        def notify_msg(payload):
            _.pull(self.mqttclient.subscriptions, sub)
            self.mqttclient.client.unsubscribe(sub)
            # XXX: no method to remove routes for wheezy.routing
            # ignoring for now, but might causes issues in the future
            if (payload['status']):
                if (payload['status'] != 'success'):
                    if (not future.done()):
                        future.set_exception(self.dump_stack(LABEL, Exception(payload['response'])))
            else:
                print(f'warning: no status key for topic: {topic}')

            if (not future.done()):
                future.set_result(payload)

        self.mqttclient.on_notify_msg(receiver, action, self.safe(notify_msg))
        self.mqttclient.send_message(topic, val)

        if (not no_timeout):
            self.timeout(future, timeout)

        return await future

    def dump_stack(self, label, err):
        return Exception(_.flatten_deep([label, err.args]))
