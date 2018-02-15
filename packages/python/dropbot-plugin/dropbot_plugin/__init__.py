from micropede.client import MicropedeClient

class DropBot(MicropedeClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def listen(self):
        self.on_put_msg("voltage", self.put_voltage)
        self.on_put_msg("frequency", self.put_frequency)

    def put_voltage(self, payload, params):
        try:
            return self.notify_sender(payload, "done", "voltage")
        except Exception as e:
            return self.notify_sender(payload, "done", "voltage", "failed")

    def put_frequency(self, payload, params):
        try:
            return self.notify_sender(payload, "done", "voltage")
        except Exception as e:
            return self.notify_sender(payload, "done", "voltage", "failed")

print("RUNNING DROPBOT plugin")
dropbot = DropBot("microdrop", host="localhost", port=1884)
dropbot.loop.run_forever()
