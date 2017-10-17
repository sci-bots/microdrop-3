<!DOCTYPE html>

<html>
<head>
  <meta http-equiv="content-type" content="text/html; charset=UTF-8">
  <!-- Plugin Title -->
  <title>Microdrop</title>

  <!-- Stylesheets -->
  <link href="styles/bootstrap.min.css" rel="stylesheet" />
  <link href="styles/jquery.dataTables.min.css" rel="stylesheet" />
  <link href="styles/phosphor/index.css" rel="stylesheet" />
  <!-- Scripts -->
  <script type="text/javascript" src="scripts/two.min.js"></script>
  <script type="text/javascript" src="libDeviceUIPlugin.js"></script>
  <script type="text/javascript" src="scripts/jquery.dataTables.min.js"></script>
  <script type="text/javascript" src="scripts/mqttws31.min.js"></script>
  <script type="text/javascript" src="scripts/js-signals.min.js"></script>
  <script type="text/javascript" src="scripts/crossroads.min.js"></script>
  <script type="text/javascript" src="node_modules/html2canvas/dist/html2canvas.min.js"></script>
  <script type="text/javascript" src="node_modules/@mqttclient/web/bundle.web.js"></script>
  <script type="text/javascript" src="node_modules/@mqttclient/mqtt-messages/mqtt-messages.js"></script>
  <script type="text/javascript" src="node_modules/@microdrop/async/bundle.web.js"></script>
  <script type="text/javascript" src="main.js"></script>
  <script type="text/javascript" src="ui-plugin.js"></script>
  <!-- Plugins -->
  {{#each pluginPaths}}
  <script type="text/javascript" src="{{this}}"></script>
  {{/each}}
</head>
<body>
</body>
<script type="text/javascript" src="load-display.js"></script>
</html>
