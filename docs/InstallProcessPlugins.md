# Install Process Plugin

Process plugins can be installed through adding the plugins folder at http://localhost:PORT/plugin-manager , or by launching the plugin on its own through the command line.


## Retrieving Process Plugins

Process plugins can be from any source including github, conda, and npm. Instructions on how to do this for droplet-planning-plugin are provided below.

### Retrieving Plugin From Source (Github)

**1. Clone the repository onto your computer**
```sh
> git clone https://github.com/Lucaszw/droplet-planning-plugin.git
```

### Retrieving Conda Plugin

**1. Discover which conda channel the plugin is being hosted on, this can be done through anaconda search:**
```sh
> anaconda search -t conda droplet-planning-plugin
```
```
Run 'anaconda show <USER/PACKAGE>' to get more details:
Packages:
     Name                      |  Version | Package Types   | Platforms
     ------------------------- |   ------ | --------------- | ---------------
     cfobel/droplet-planning-plugin-requirements |          | conda           | win-32
     lucaszw/microdrop.droplet-planning-plugin | 2.1.post43 | conda           | win-32
     microdrop-plugins/microdrop.droplet-planning-plugin |    2.2.1 | conda           | win-32
     wheeler-microfluidics/droplet-planning-plugin-requirements | 1.0.post36 | conda           | win-32
Found 4 packages
```
```sh
> anaconda show lucaszw/microdrop.droplet-planning-plugin
```
```
Using Anaconda API: https://api.anaconda.org
Name:    microdrop.droplet-planning-plugin
Summary:
Access:  public
Package Types:  conda
Versions:
   + 2.1.post42
   + 2.1.post43

To install this package with conda run:
     conda install --channel https://conda.anaconda.org/lucaszw microdrop.droplet-planning-plugin
```

**2. Install the plugin using conda install: **
```sh
conda install --channel https://conda.anaconda.org/lucaszw microdrop.droplet-planning-plugin
```


## Registering Plugin with Microdrop ##

Plugins can be registered by launching the plugin separately while microdrop is running, or by adding the plugin path through the plugin manager ui found at http://localhost:PORT/plugin-manager. The process is outlined for installing droplet-planning-plugin as an example.

### Registering Plugin through launching ###

```sh
>cd path\to\droplet-planning-plugin
>python __init__.py
```

Navigate to http://localhost:PORT/plugin-manager. You should see the plugin name listed in the Process Plugins panel.

TODO: Provide instructions for registering conda packages

### Registering Plugin through Plugin Manager UI ###

Navigate to http://localhost:PORT/plugin-manager. Enter the absolute path to the plugin (C:\path\to\droplet-planning-plugin) into the Process Plugin input field. Click "Add Plugin Path"
