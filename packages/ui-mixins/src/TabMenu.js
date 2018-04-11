window.$ = require('jquery');
window.Popper = require('popper.js');
require('bootstrap/dist/css/bootstrap.min.css');
require('bootstrap/js/dist/tooltip.js');
require('open-iconic/font/css/open-iconic-bootstrap.css');
const yo = require('yo-yo');
const _  = require('lodash');

const TabButton = (item, ...args) => {
  return yo`
  <button id="tab-${item.name}"
  class="tab-btn btn btn-sm btn-outline-secondary"
  style="${Styles.tabButton}; font-size: 11px;"
  onclick=${item.onclick.bind(this, item, ...args)}>
    ${item.name.replace("-ui-plugin", " ").replace("-", " ")}
  </button>
  `;
}

const TabToggleButton = (item) => {
  const onclick = item.onclick;


  let btn;
  item.onclick = (item) => {
    let toggle1 = () => {
      btn.setAttribute("id", `tab-${item.name2}`);
      btn.classList.remove("btn-outline-secondary");
      btn.classList.add("btn-outline-danger");
      btn.innerText = item.name2;
    };

    let toggle2 = () => {
      btn.setAttribute("id", `tab-${item.name}`);
      btn.classList.remove("btn-outline-danger");
      btn.classList.add("btn-outline-secondary");
      btn.innerText = item.name;
    }
    if (btn.classList.contains("btn-outline-secondary")) {
      toggle1();
    } else {
      toggle2();
    }
    btn.toggle1 = toggle1;
    btn.toggle2 = toggle2;
    onclick(item, btn);
  };

  btn = TabButton(item);
  return btn;
}

const TabMenu = (items=[], options={}) => {
  /* items: [] : {name: str, onclick: fcn, [name2]: str}*/
  return yo`
    <div style="${Styles.tabs}">
      ${_.map(items, (item) => {
        let args = item.args || [];
        if (item.name2 == undefined) return TabButton(item, ...args);
        if (item.name2 != undefined) return TabToggleButton(item, ...args);
      }
      )}
    </div>`;
};

const unselect = (b) => {
  if (b == null) return;
  b.classList.remove("btn-primary");
  b.classList.add("btn-outline-secondary");
}

const select = (b) => {
  if (b == null) return;
  b.classList.remove("btn-outline-secondary");
  b.classList.add("btn-primary");
}

const Styles = {
  tabs: `
    background: #eaeaea;
    border-top: 1px solid #b5b5b5;
    border-bottom: 1px solid #b5b5b5;
    padding: 3px;
  `,
  tabButton: `
    margin: 0px 3px;
  `
}

module.exports = TabMenu;
module.exports.TabMenu = TabMenu;
module.exports.unselect = unselect;
module.exports.select = select;
