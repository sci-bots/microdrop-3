import os
import subprocess as sp
import sys

import path_helpers as ph


py_exe = sys.executable
original_directory = os.getcwd()

os.chdir(ph.path(__file__).parent)

# The `CREATE_NEW_PROCESS_GROUP` flag is necessary for using
# `os.kill()` on the subprocess.
_websockets_process = sp.Popen([py_exe, '-m',
                                     'zmq_plugin_bridge.app'],
                                    creationflags=
                                    sp.CREATE_NEW_PROCESS_GROUP)
os.chdir(original_directory)

# Start web server to serve static files.
os.chdir(ph.path(__file__).parent.joinpath('public'))
# The `CREATE_NEW_PROCESS_GROUP` flag is necessary for using
# `os.kill()` on the subprocess.
_static_server_process = sp.Popen([py_exe, '-m',
                                        'SimpleHTTPServer'],
                                       creationflags=
                                       sp.CREATE_NEW_PROCESS_GROUP)
os.chdir(original_directory)
