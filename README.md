# Microdrop 3

[![Build Status](https://travis-ci.org/sci-bots/microdrop-3.svg?branch=master)](https://travis-ci.org/sci-bots/microdrop-3)
[![Build status](https://ci.appveyor.com/api/projects/status/am9mpa48m038s7ec?svg=true)](https://ci.appveyor.com/project/SciBots/microdrop-3)


Microdrop with MQTT communication and web front end

## Installing From NPM (Latest, or Release)

```sh
# Install latest:
npm install https://github.com/sci-bots/microdrop-3 --no-optional
# Install latest release:
npm install microdrop --no-optional
microdrop-3
```

## Installing From Source (Latest)

```sh
git clone https://github.com/sci-bots/microdrop-3
cd microdrop-3
npm i --global gulp lerna
npm install --no-optional
lerna bootstrap
# [optional] lerna --exec gulp build
npm run start
```

## Linking with Jupyterlab

```sh
# conda:
conda install jupyterlab

# pip:
pip install jupyterlab
jupyter serverextension enable --py jupyterlab --sys-prefix

cd microdrop-3
gulp link:jupyterlab
```

## Docs

**[Visit project wiki](https://github.com/sci-bots/microdrop-3/wiki)**
