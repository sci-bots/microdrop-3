from micropede.client import MicropedeClient

print("successfully imported micropede client!")


class DropBot(MicropedeClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def listen(self):
        print("LISTENING!!", self.name)
        self.on_put_msg("voltage", self.put_voltage)
        self.bind_trigger_msg("electrodes-model", "toggle-electrode", "toggle-electrode")
        self.trigger("toggle-electrode", {"electrodeId": "electrode000", "state": True})

    def put_voltage(self, payload):
        print("PUTTING VOLTAGE")

dropbot = DropBot("microdrop", host="localhost", port=1884)
