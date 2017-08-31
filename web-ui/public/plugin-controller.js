class PluginController extends MQTTClient {
  constructor(element, focusTracker, name="dmf-device-ui") {
    super(name);
    this.element = element;
    this.focusTracker = focusTracker;
    this._listen();
  }

  // ** Event Listeners **
  _listen() {
    Key("delete", this._onDelete.bind(this));
  }

  // ** Event Handlers **
   _onDelete(){
     if (this.hasFocus) this.trigger("delete");
   }
   
  // ** Getters and Setters **
  set element(element) {
    // XXX: Must set tabIndex property for FocusTracker to work
    element.tabIndex = 0;
    this._element = element;
  }

  get element() {
    return this._element;
  }

  get hasFocus() {
    return this.element == this.focusTracker.currentWidget.node;
  }
};
