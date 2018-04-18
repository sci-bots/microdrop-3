import asyncio
import json
import threading
from threading import Thread

import numpy as np
import pydash as _
from si_prefix import si_format, si_parse

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

    async def update_board_info(self):
        info = {}
        _.assign(info, json.loads(self.control_board.config.to_json()))
        _.assign(info, json.loads(self.control_board.state.to_json()))
        _.assign(info, json.loads(self.control_board.properties.to_json()))
        _.assign(info, {"uuid": str(self.control_board.uuid)})
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
        self.on_state_msg("electrodes-model", "voltage", self.change_voltage)
        self.on_state_msg("electrodes-model", "frequency", self.change_frequency)
        self.on_state_msg("dropbot-ui-plugin", "{key}", self.modify_status)
        self.wait_for(self.update_board_info())

    async def change_voltage(self, voltage, params):
        try:
            print("CHANGING :) VOLTAGE!!!")
            # Convert payload from si_unit string to number
            print("CALLING PSI PARSE:", voltage);
            voltage = si_parse(_.replace(voltage, "V", ""))
            print("ITS NOW: ", voltage)
            await self.put_voltage({"voltage": voltage}, {})
            await self.update_board_info()
        except Exception as e:
            print("Error setting voltage")
            print(e)

    async def change_frequency(self, frequency, params):
        try:
            print("FREQ", frequency)
            frequency = si_parse(_.replace(frequency, "Hz", ""))
            await self.put_frequency({"frequency": frequency}, params)
            await self.update_board_info()
        except Exception as e:
            print("Error setting frequency")
            print(e)

    async def put_voltage_frequency(self, payload, params):
        self.control_board.voltage = float(payload["voltage"])
        self.control_board.frequency = float(payload["frequency"])
        await self.update_board_info()

    async def turn_on_electrodes(self, payload, params):
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
        await self.update_board_info()

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
            await self.update_board_info()
            self.notify_sender(payload, self.control_board.frequency, "frequency")
        except Exception as e:
            print(e)
            self.notify_sender(payload, dump_stack(self.client.name, e),
                               "frequency", "failed")

    async def put_voltage(self, payload, params):
        """ Set the on voltage for fluxels"""
        try:
            print("PUT VOLTAGE CALLED!")
            self.validate_schema(payload)
            self.control_board.voltage = float(payload["voltage"])
            print("SETTING STATE OF VOLTAGE TO:", payload["voltage"])
            print("SETTING STATE!!")
            await self.update_board_info()
            print("SET SUCCESSFUL")
            self.notify_sender(payload, self.control_board.voltage, "voltage")
        except Exception as e:
            print(e)
            self.notify_sender(payload, dump_stack(self.client.name, e),
                               "voltage", "failed")

print("Running dropbot plugin")
dropbot = DropBot("microdrop", host="localhost", port=1884, name="dropbot")
