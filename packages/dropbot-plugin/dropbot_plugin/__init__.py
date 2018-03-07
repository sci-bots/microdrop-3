from dropbot import SerialProxy
from micropede.client import MicropedeClient , dump_stack

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

class DropBot(MicropedeClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.schema = SCHEMA

    def listen(self):
        wait = self.wait_for
        self.on_put_msg("frequency", self.put_frequency)
        self.on_put_msg("voltage", self.put_voltage)

    async def put_frequency(self, payload, params):
        """ Set the switching frequency of the active fluxels"""
        try:
            self.validate_schema(payload)
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
