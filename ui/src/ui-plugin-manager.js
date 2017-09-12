class UIPluginManager extends UIPlugin {
  constructor(element, focusTracker) {
    super(element, focusTracker, "UIPluginManager");
    Object.assign(this, CardMixins);
    this.controls = this.Controls();
    this.pluginCards = new Backbone.Model();
    this.listen();
  }
  listen() {
    this.pluginCards.on("all", this.onPluginCardsChanged.bind(this));
    this.on("add-plugin", this.onAddPlugin.bind(this));
    this.on("remove-plugin-clicked", this.onRemovePlugin.bind(this));
    this.bindTriggerMsg("web-server", "remove-plugin", "remove-plugin");

    this.addGetRoute("microdrop/state/web-plugins", this.onWebPluginsChanged.bind(this));
    this.addGetRoute("microdrop/state/error/web-plugins", this.onChangeWebPluginsFailed.bind(this));
    this.addPostRoute("/add-web-plugin", "add-web-plugin");
  }
  get cards(){return this._cards}
  set cards(item) {this.changeElement("cards", item)}
  get controls(){return this._controls}
  set controls(item) {this.changeElement("controls", item)}

  onAddPlugin(path) {
    this.trigger("add-web-plugin", path);
  }
  onChangeWebPluginsFailed(payload) {
    console.error(`Failed to add webplugin:  ${payload}`);
  }
  onPluginCardsChanged(msg) {
    this.cards = this.Cards(this.pluginCards);
  }
  onRemovePlugin(filepath) {
    this.trigger("remove-plugin", this.wrapData("filepath", filepath));
  }
  onWebPluginsChanged(payload) {
    // TODO: Auto convert payload to json before triggering event
    const paths = JSON.parse(payload);
    this.pluginCards.clear();
    for (const filepath of paths){
      const filename = filepath.replace(/^.*[\\\/]/, '');
      this.pluginCards.set(filename, filepath);
    }
  }
  Card(filename,filepath) {
    const card = $("<div class='card'></div>");
    const removeEvent = () => {this.trigger("remove-plugin-clicked", filepath)};
    const styles = this.Styles();
    card.css(styles.card);
    card.append(this.Title(filename));
    card.append(this.InputField("Plugin:", filepath));
    card.append(this.Button(removeEvent, "Remove","btn-secondary"));
    return card[0];
  }
  Cards(pluginCards) {
    const entries = Object.entries(pluginCards.attributes);
    const cards = $("<div></div>")[0];
    for (const [filename,filepath] of entries)
      cards.appendChild(this.Card(filename,filepath));
    return cards;
  }
  Controls() {
    const controls = document.createElement("div");
    const inputField = $('<input type="text" />')[0];
    const addBtn = $('<button>Add Plugin</button>')[0];
    addBtn.onclick = () => this.trigger("add-plugin", inputField.value);
    controls.appendChild(inputField);
    controls.appendChild(addBtn);
    return controls;
  }
}
