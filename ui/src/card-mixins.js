const CardMixins = new Object();

CardMixins.Badge = function(text,classes="badge-primary") {
  const styles = this.Styles();
  const badge = D(`<span class='badge ${classes}'>${text}</span>`);
  badge.setStyles(styles.cardBadge);
  return badge.el;
}
CardMixins.Button = function(handler, text="submit", classes="btn-primary") {
  const styles = this.Styles();
  const btn = D(`<button class='${classes} btn btn-sm'>${text}</button`);
  btn.setStyles(styles.cardButton);
  btn.on("click", handler);
  btn.el.addClasses = btn.addClasses.bind(btn);
  return btn.el;
}
CardMixins.InputField = function(title, defaultValue) {
  const container = document.createElement("div");
  const label = D(`<label class='form-control-label'>${title}:</label>`);
  const input = D("<input class='form-control form-control-sm' type='text' />");
  const styles = this.Styles();
  input.value = defaultValue;
  for (const item of [label,input]){
    item.setStyles(styles.cardTextInput);
    container.appendChild(item.el);
  }
  return container;
}
CardMixins.Title = function(value) {
  const title = D("<b class='card-title'></b>").el;
  title.innerHTML = value;
  return title;
}
CardMixins.Styles = function() {
  const styles = new Object();
  styles.list = {"list-style": "none", margin: 0, padding: 0};
  styles.card = {width: "250px", "min-height": "200px", float: "left",
                 margin: "5px", padding: "5px", "text-align": "center"};
  styles.cardRunning = {background: "#ddfddd"};
  styles.cardStopped = {background: "#ffe5e5"};
  styles.cardTextInput = {"font-size": "15px"};
  styles.cardButton = {width: "60px", margin: "5px 3px"};
  styles.cardBadge = {padding: "5px", width: "80px", margin: "0 auto"};
  return styles;
}
