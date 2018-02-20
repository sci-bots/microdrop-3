from micropede.client import MicropedeClient

SCHEMAS = {
    "state": {
        "type": "object",
        "properties": {
            "voltage": {
                "type": "number",
                "default": 100
            },
            "frequency": {
                "type": "number",
                "default": 10000
            },
            "hv_output_enabled": {
                "type": "boolean",
                "default": False
            },
            "hv_output_selected": {
                "type": "boolean",
                "default": True
            },
            "channel_count": {
                "type": "integer",
                "default": 0
            },
            "capacitance_update_interval_ms": {
                "type": "integer",
                "default": 0,
                "minimum": 0
            },
            "target_capacitance": {
                "type": "number",
                "default": 0
            }
        }
    },
    "config": {
        "type": "object",
        "properties": {
            "switching_board_i2c_address": {
                "type": "integer",
                "minimum": 0,
                "default": 32
            },
            "R7": {
                "type": "number",
                "default": 10e3
            },
            "max_voltage": {
                "type": "number",
                "default": 150,
                "minimum": 0
            },
            "min_frequency": {
                "type": "number",
                "default": 100
            },
            "max_frequency": {
                "type": "number",
                "default": 10e3
            },
            "id": {
                "type": "string",
                "default": ""
            }
        }
    }
}

class DropBot(MicropedeClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.state = {}
        self.schemas = SCHEMAS

    def listen(self):
        self.on_put_msg("property", self.put_property)
        self.on_put_msg("schema", self.put_schema)

    def put_schema(self, payload, params):
        try:
            for key in payload:
                if key == '__head__':
                    continue

                schema = self.schemas["state"]["properties"][key]

                for k2 in payload[key]:
                    schema[k2] = payload[key][k2]

            return self.notify_sender(payload, "done", "schema")
        except Exception as e:
            print(e)
            return self.notify_sender(payload, [e], "schema", "failed")

    def put_property(self, payload, params):
        print(params)
        for key in payload:
            if (key == '__head__'):
                continue

            self.validate_schema(payload[key], self.schemas["state"]["properties"][key])
            self.state[key] = payload[key]

        try:
            return self.notify_sender(payload, self.state, "property")
        except Exception as e:
            print(e)
            return self.notify_sender(payload, [e], "property", "failed")


print("Running dropbot plugin")
dropbot = DropBot("microdrop", host="localhost", port=1884, name="dropbot")
dropbot.loop.run_forever()
