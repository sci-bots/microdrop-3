window.$ = require('jquery');
window.Popper = require('popper.js');
require('bootstrap/dist/css/bootstrap.min.css');
require('bootstrap/js/dist/tooltip.js');
require('open-iconic/font/css/open-iconic-bootstrap.css');
const yo = require('yo-yo');
const _  = require('lodash');

const TabButton = (item) => {
  return yo`
  <button id="tab-${item.name}"
  class="tab-btn btn btn-sm btn-outline-secondary"
  style="${Styles.tabButton}; font-size: 11px;"
  onclick=${item.onclick.bind(this, item)}>
    ${item.name}
  </button>
  `;
}

const TabToggleButton = (item) => {
  const onclick = item.onclick;

  let btn;
  item.onclick = (item) => {
    if (btn.classList.contains("btn-outline-secondary")) {
      btn.setAttribute("id", `tab-${item.name2}`);
      btn.classList.remove("btn-outline-secondary");
      btn.classList.add("btn-outline-danger");
      btn.innerText = item.name2;
    } else {
      btn.setAttribute("id", `tab-${item.name}`);
      btn.classList.remove("btn-outline-danger");
      btn.classList.add("btn-outline-secondary");
      btn.innerText = item.name;
    }
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
        if (item.name2 == undefined) return TabButton(item);
        if (item.name2 != undefined) return TabToggleButton(item);
      }
      )}
    </div>`;
};

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
