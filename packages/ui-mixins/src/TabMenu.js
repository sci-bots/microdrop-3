window.$ = require('jquery');
window.Popper = require('popper.js');
require('bootstrap/dist/css/bootstrap.min.css');
require('bootstrap/js/dist/tooltip.js');
require('open-iconic/font/css/open-iconic-bootstrap.css');
const yo = require('yo-yo');
const _  = require('lodash');

const TabMenu = (items=[], options={}) => {
  /* items: [] : {name: str, onclick: fcn}*/
  return yo`
    <div style="${Styles.tabs}">
      ${_.map(items, (item) => yo`
          <button id="tab-${item.name}"
          class="tab-btn btn btn-sm btn-outline-secondary"
          style="${Styles.tabButton}; font-size: 11px;"
          onclick=${item.onclick.bind(this, item)}>
            ${item.name}
          </button>
        `
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
