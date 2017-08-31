@echo off
REM Change into [parent directory of batch file][1].
REM
REM [1]: http://stackoverflow.com/questions/16623780/how-to-get-windows-batchs-parent-folder
REM Launch Microdrop

set "PARENT_DIR=%~dp0"
if "%1"=="" set "PYTHON=python"
if not "%1"=="" set "PYTHON=%1"

"%PYTHON%" "%PARENT_DIR%..\..\on_plugin_install.py"
