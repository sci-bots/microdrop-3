const yo = require('yo-yo');
const MicropedeAsync = require('@micropede/client/src/async.js');
const APPNAME = 'microdrop';

const ElectrodeMixins = {};

ElectrodeMixins.updateElectrode = async function () {
  const obj = _.last(this.editor.history.history);
  const editedProp = _.get(obj, 'params.node.field');
  if (editedProp == undefined) return;

  const newData = this.editor.get();
  const microdrop = new MicropedeAsync(APPNAME);
  const threeObject = await microdrop.getState('device-model', 'three-object');

  if (!_.includes(newData.id, 'electrode')) throw 'id invalid';

  // Modify threeObject with new data
  let newObjects = _.map(threeObject, (item) => {
    if (_.isEqual(newData.translation, item.translation)) {
      return newData;
    }
    return item;
  })
  this.trigger('device-model', 'put-device', {'three-object': newObjects});
}

ElectrodeMixins.renderSelectedElectrode = async function () {
  const LABEL = "StateSaver::renderSelectedElectrode";
  try {
    this.infoBar.appendChild(yo`
    <div>
      <button onclick=${this.updateElectrode.bind(this)}>
        Update Electrode
      </button>
      <br>
    </div>`);

    const microdrop = new MicropedeAsync(APPNAME);
    let id = await microdrop.getState("electrode-controls", "selected-electrode", 500);

    const electrodes = _.get(this.json, ["device-model", "three-object"]) || [];
    this.editor.set(_.find(electrodes, { id }));

  } catch (e) {
    console.error(LABEL, e);
  }
}

module.exports = ElectrodeMixins;
