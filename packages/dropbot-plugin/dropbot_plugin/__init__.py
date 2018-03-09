import asyncio
import threading
from threading import Thread

import numpy as np
import pydash as _

from dropbot import SerialProxy
from micropede.client import MicropedeClient , dump_stack
from micropede.async import MicropedeAsync

SCHEMA = {
    "type": "object",
    "properties": {
        "voltage": {
            "type": "number",
            "default": 100,
            "per_step": True
        },
        "frequency": {
            "type": "number",
            "default": 10000,
            "per_step": False
        },
        "__hv_output_enabled__": {
            "type": "boolean",
            "default": False
        },
        "__hv_output_selected__": {
            "type": "boolean",
            "default": True
        },
        "__channel_count__": {
            "type": "integer",
            "default": 0
        },
        "__capacitance_update_interval_ms__": {
            "type": "integer",
            "default": 0,
            "minimum": 0
        },
        "__target_capacitance__": {
            "type": "number",
            "default": 0
        }
    }
}

def setup_serial_proxy(self):
    class Y(object): pass
    Y.control_board = None
    Y.ready_event = threading.Event()
    Y.err = False
    def start_thread(x):
        try:
            x.control_board = SerialProxy()
        except Exception as e:
            x.err = e
        x.ready_event.set()

    t = Thread(target=start_thread, args=(Y,))
    t.start()
    Y.ready_event.wait()
    if (Y.err):
        raise(Y.err)

    self.control_board = Y.control_board

APPNAME = "microdrop"

class DropBot(MicropedeClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.schema = SCHEMA

    async def update_board_info(self):
        print("Updating board info")
        info = {}
        info['number of channels'] = int(self.control_board.number_of_channels)
        info['high voltage enabled'] = self.control_board.hv_output_enabled
        info['port'] = self.control_board.port
        info['hardware version'] = str(self.control_board.hardware_version.decode('utf8'))
        info['hv_output_selected'] = self.control_board.hv_output_selected
        await self.set_state('info', info)

    def listen(self):
        setup_serial_proxy(self)
        self.control_board.hv_output_enabled = True
        self.control_board.hv_output_selected = True
        self.on_put_msg("frequency", self.put_frequency)
        self.on_put_msg("voltage", self.put_voltage)
        self.on_trigger_msg("connect-dropbot", self.connect_dropbot)
        self.on_trigger_msg("measure-capacitance", self.measure_capacitance)
        self.on_trigger_msg("measure-voltage", self.measure_voltage)
        self.on_trigger_msg("put-voltage-frequency", self.put_voltage_frequency)
        self.on_state_msg("electrodes-model", "active-electrodes", self.turn_on_electrodes)
        self.wait_for(self.update_board_info())

    async def put_voltage_frequency(self, payload, params):
        self.control_board.voltage = float(payload["voltage"])
        self.control_board.frequency = float(payload["frequency"])
        pass

    async def turn_on_electrodes(self, payload, params):
        print("TURNING ON ELECTRODES!!!!!")
        # Get the three object from device-model
        microdrop = MicropedeAsync(APPNAME,port=self.port,loop=self.loop)
        three_object = await microdrop.get_state('device-model', 'three-object')
        active_electrodes = payload

        def active_filter(obj):
            return _.includes(active_electrodes, obj["id"])

        active_objects = _.filter_(three_object, active_filter)
        channels = _.map_(_.map_(active_objects, "channel"), int)

        max_channels = self.control_board.number_of_channels
        channel_states = np.zeros(max_channels, dtype=int)
        channel_states[channels] = 1
        self.control_board.set_state_of_channels(channel_states)
        print(self.control_board.state_of_channels)
        self.wait_for(self.update_board_info())

    async def measure_voltage(self, payload, params):
        try:
            if (not self.control_board):
                raise("Control board not set")

            voltage = self.control_board.measure_voltage()
            self.notify_sender(payload, voltage, "measure-voltage")

        except Exception as e:
            self.notify_sender(payload, dump_stack(self.name, e),
                               "measure-voltage", "failed")

    async def measure_capacitance(self, payload, params):
        try:
            if (not self.control_board):
                raise("Control board not set")

            capacitance = self.control_board.measure_capacitance()
            self.notify_sender(payload, capacitance, "measure-capacitance")

        except Exception as e:
            self.notify_sender(payload, dump_stack(self.name, e),
                               "measure-capacitance", "failed")

    async def connect_dropbot(self, payload, params):
        try:
            setup_serial_proxy(self)
            await self.update_board_info()
            self.notify_sender(payload, "connected!", "connect-dropbot")
        except Exception as e:
            print("ERROR::", e)
            self.notify_sender(payload, dump_stack(self.name, e),
                               "connect-dropbot", "failed")

    async def put_frequency(self, payload, params):
        """ Set the switching frequency of the active fluxels"""
        try:
            self.validate_schema(payload)
            self.control_board.frequency = float(payload["frequency"])
            await self.set_state("frequency", payload["frequency"])
            self.notify_sender(payload, payload["frequency"], "frequency")
        except Exception as e:
            print(e)
            self.notify_sender(payload, dump_stack(self.client.name, e),
                               "frequency", "failed")

    async def put_voltage(self, payload, params):
        """ Set the on voltage for fluxels"""
        try:
            self.validate_schema(payload)
            self.control_board.voltage = float(payload["voltage"])
            print("SETTING STATE OF VOLTAGE TO:", payload["voltage"])
            await self.set_state("voltage", payload["voltage"])
            print("SET SUCCESSFUL")
            self.notify_sender(payload, payload["voltage"], "voltage")
        except Exception as e:
            print(e)
            self.notify_sender(payload, dump_stack(self.client.name, e),
                               "voltage", "failed")

print("Running dropbot plugin")
dropbot = DropBot("microdrop", host="localhost", port=1884, name="dropbot")
