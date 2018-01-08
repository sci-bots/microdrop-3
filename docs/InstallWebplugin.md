# Installing Web/UI Plugins

UI plugins are standalone JavaScript files that generally render as PhosphorJS widgets. To install the plugins, copy the source file path into the ui plugins input field located at: http://localhost:PORT/plugin-manager , and press "Add Plugin".

## Retrieving UI Plugins

Since UI plugins have no dependencies, they can be achieved by any means, including Github. For example, to retrieve the source file for the "Protocol Execution UI Plugin", simple clone the repository from:

 https://github.com/Lucaszw/protocol-execution-ui-plugin.git



## Installing UI Plugins

First, ensure that Microdrop is running on your computer:

```sh
>> microdrop-3.cmd
```

Then navigate in your web browser to: "http://localhost:PORT/plugin-manager". Input the location of the plugin, such as: C:\Path\To\protocol-execution-ui-plugin.js into the "Add Plugin" input field, and select "Add Plugin"



## Using Plugin

The plugin should appear as a plugin under: "http://localhost:PORT/display". The plugin should appear as one of the tabs in the layout (for protocol-execution-ui-plugin, this will be the bottom right by default).
