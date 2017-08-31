# -*- coding: utf-8 -*-
import os
import subprocess as sp
import sys

import path_helpers as ph
from microdrop.logger import logger
from microdrop.plugin_helpers import get_plugin_info
from microdrop.plugin_manager import (PluginGlobals, Plugin, IPlugin,
                                      implements)


PluginGlobals.push_env('microdrop.managed')


def get_chrome_exe():
    import _winreg

    key = _winreg.OpenKey(_winreg.HKEY_LOCAL_MACHINE,
                          'SOFTWARE\Microsoft\Windows\CurrentVersion'
                          '\App Paths')
    chrome_exe = ph.path(_winreg.QueryValue(key, 'chrome.exe'))
    assert(chrome_exe.isfile())
    return chrome_exe


class WebuiPlugin(Plugin):
    '''
    When enabled, this plugin:

     1. Starts a 0MQ plugin to sockets IO bridge server.
     2. Starts a web server to serve static files.
     3. Launches a web browser tab to show the MicroDrop web UI **(only Chrome
        is currently supported)**.
    '''
    implements(IPlugin)
    version = get_plugin_info(ph.path(__file__).parent).version
    plugin_name = get_plugin_info(ph.path(__file__).parent).plugin_name

    def __init__(self):
        self.name = self.plugin_name
        self._websockets_process = None
        self._static_server_process = None

    def on_plugin_enable(self):
        py_exe = sys.executable
        # Note that `cwd` argument to `Popen` is not considered when searching
        # the executable, so you the program’s path cannot be specified
        # relative to `cwd`.
        #
        # We can work around this by actually switching to the new directory
        # before launching the `Popen` process.
        original_directory = os.getcwd()

        # Start 0MQ to web sockets bridge (server).
        try:
            os.chdir(ph.path(__file__).parent)
            # The `CREATE_NEW_PROCESS_GROUP` flag is necessary for using
            # `os.kill()` on the subprocess.
            self._websockets_process = sp.Popen([py_exe, '-m',
                                                 'zmq_plugin_bridge.app'],
                                                creationflags=
                                                sp.CREATE_NEW_PROCESS_GROUP)
        finally:
            os.chdir(original_directory)
        # Start web server to serve static files.
        try:
            os.chdir(ph.path(__file__).parent.joinpath('public'))
            # The `CREATE_NEW_PROCESS_GROUP` flag is necessary for using
            # `os.kill()` on the subprocess.
            self._static_server_process = sp.Popen([py_exe, '-m',
                                                    'SimpleHTTPServer'],
                                                   creationflags=
                                                   sp.CREATE_NEW_PROCESS_GROUP)
        finally:
            os.chdir(original_directory)

        # Open UI web page.
        try:
            chrome_exe = get_chrome_exe()
            sp.check_call([chrome_exe, self.url])
        except:
            import webbrowser

            webbrowser.open_new_tab(self.url)
            logger.warn("Web UI is currently only supported using Chrome")

    @property
    def url(self):
        return 'http://localhost:8000/display.html'

    def on_app_exit(self):
        self.cleanup()

    def on_plugin_disable(self):
        self.cleanup()

    def cleanup(self):
        # Stop servers.
        for process_i in ('_websockets_process', '_static_server_process'):
            if getattr(self, process_i):
                getattr(self, process_i).kill()
                setattr(self, process_i, None)


PluginGlobals.pop_env()

from ._version import get_versions
__version__ = get_versions()['version']
del get_versions
