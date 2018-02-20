from micropede.client import MicropedeClient

SCHEMAS = {
    "voltage": {
        "type": "integer"
    }
}

class DropBot(MicropedeClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.voltage = 0
        self.frequency = 0
        self.schemas = SCHEMAS

    def listen(self):
        print("LISTENING!!", self.name)
        self.on_put_msg("voltage", self.put_voltage)
        self.on_put_msg("frequency", self.put_frequency)
        self.on_put_msg("all", self.put_all)

    def put_voltage(self, payload, params):
        print("PUTTING VOLTAGE!")
        self.voltage = payload["voltage"]
        try:
            return self.notify_sender(payload, "done", "voltage")
        except Exception as e:
            return self.notify_sender(payload, "done", "voltage", "failed")

    def put_frequency(self, payload, params):
        print("PUTTING FREQUENCY")
        self.frequency = payload["frequency"]
        try:
            return self.notify_sender(payload, "done", "frequency")
        except Exception as e:
            return self.notify_sender(payload, "done", "frequency", "failed")

    def put_all(self, payload, params):
        print("PUTTING ALL!")
        self.voltage = payload["voltage"]
        self.frequency = payload["frequency"]
        try:
            return self.notify_sender(payload, "done", "all")
        except Exception as e:
            return self.notify_sender(payload, "done", "all", "failed")

print("Running dropbot plugin")
dropbot = DropBot("microdrop", host="localhost", port=1884, name="dropbot")
dropbot.loop.run_forever()
