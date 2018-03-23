<img src="https://raw.githubusercontent.com/sci-bots/microdrop-3/master/docs/MicroDrop.PNG" />

[![Build Status](https://travis-ci.org/sci-bots/microdrop-3.svg?branch=master)](https://travis-ci.org/sci-bots/microdrop-3)
[![Build status](https://ci.appveyor.com/api/projects/status/am9mpa48m038s7ec?svg=true)](https://ci.appveyor.com/project/SciBots/microdrop-3)


MicroDrop with MQTT communication and web front end

## Installing From Source (Latest)

### Prerequisites:
- git 
- node / npm

### Installation:
```sh
git clone --recursive https://github.com/sci-bots/microdrop-3
cd microdrop-3
npm i --global yarn electron @yac/yac npm-check-updates
yarn upgrade:micropede
yarn upgrade:yac
yarn bootstrap
yarn build # This can sometimes appear to hang on windows when it has actually complected. Press <Enter> and/or Ctrl+C if it appears to have stalled for over 30s or so
yarn start
```

## Installing From NPM:

### Prerequisites:
- git 
- node / npm

### Installation:
```sh
npm install --global @microdrop/application
```

### Start:
```sh
  >> microdrop # Ensure no microdrop-2 is not in path
```

## Building an installer:

```sh
cd microdrop-3
cd packages/builder
yarn builder
```

## Docs

**[Visit project wiki](https://github.com/sci-bots/microdrop-3/wiki)**
