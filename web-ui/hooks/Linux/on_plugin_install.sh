#!/bin/bash

# Resolve parent directory of script.  See [here][1].
#
# [1]: http://stackoverflow.com/questions/59895/can-a-bash-script-tell-which-directory-it-is-stored-in#246128
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
PARENT_DIR="$( cd -P "$( dirname "$SOURCE" )" && pwd )"

if [[ ! -z  $1  ]];
then PYTHON_EXE=$1
else PYTHON_EXE=python
fi

$PYTHON_EXE ${PARENT_DIR}/../../on_plugin_install.py
