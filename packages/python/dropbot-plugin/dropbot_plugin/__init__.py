from micropede.client import MicropedeClient

class DropBot(MicropedeClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def listen(self):
        print("LISTENING!!", self.name)
        self.on_put_msg("voltage", self.put_voltage)
        self.on_put_msg("frequency", self.put_frequency)

    def put_voltage(self, payload, params):
        print("PUTTING VOLTAGE!")
        try:
            return self.notify_sender(payload, "done", "voltage")
        except Exception as e:
            return self.notify_sender(payload, "done", "voltage", "failed")

    def put_frequency(self, payload, params):
        print("PUTTING FREQUENCY")
        try:
            return self.notify_sender(payload, "done", "frequency")
        except Exception as e:
            return self.notify_sender(payload, "done", "frequency", "failed")

print("Running dropbot plugin")
dropbot = DropBot("microdrop", host="localhost", port=1884, name="dropbot")
dropbot.loop.run_forever()
