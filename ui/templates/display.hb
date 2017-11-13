<!DOCTYPE html>

<html>
<head>
  <meta http-equiv="content-type" content="text/html; charset=UTF-8">
  <!-- Plugin Title -->
  <title>Microdrop</title>

  <!-- Stylesheets -->
  <link href="styles/bootstrap.min.css" rel="stylesheet" />
  <link href="styles/phosphor/index.css" rel="stylesheet" />
  <!-- Scripts -->
  <script type="text/javascript" src="scripts/phosphor.js"></script>
  <script type="text/javascript" src="scripts/jquery.min.js"></script>
  <script type="text/javascript" src="node_modules/@mqttclient/web/web-mqtt.web.js"></script>
  <script type="text/javascript" src="node_modules/@mqttclient/mqtt-messages/mqtt-messages.js"></script>
  <script type="text/javascript" src="node_modules/@microdrop/async/microdrop-async.web.js"></script>
  <!-- Plugins -->
  {{#each pluginPaths}}
  <script type="text/javascript" src="{{this}}"></script>
  {{/each}}
</head>
<body>
</body>
<script type="text/javascript" src="load-display.js"></script>
</html>
