import json

from flask import Flask
from gevent import monkey
monkey.patch_all()
from geventwebsocket.handler  import WebSocketHandler
from zmq import green as zmq
from zmq_plugin.schema import (encode_content_data, pandas_object_hook,
                               PandasJsonEncoder)
import gevent
import logging
import monitor as mn
import socketio


sio = socketio.Server()
app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'


NAMESPACE = '/zmq_plugin'


@sio.on('connect', namespace=NAMESPACE)
def connect(sid, environ):
    print('connect ', sid)
    sio.emit('connected', {'data': 'connected: {}'.format(sid)}, room=sid,
             namespace=NAMESPACE)


@sio.on('disconnect', namespace=NAMESPACE)
def disconnect(sid):
    # **NOTE** Disconnection closes the socket, so emitting will fail.
    print('disconnect ', sid)


@sio.on('debug', namespace=NAMESPACE)
def debug(sid):
    import pdb; pdb.set_trace()


@sio.on('reset', namespace=NAMESPACE)
def reset(sid):
    plugin.reset()


@sio.on('execute', namespace=NAMESPACE)
def execute(sid, request):
    message = {'request': request, 'error': None, 'response': None}

    kwargs = json.loads(json.dumps(request['kwargs']),
                        object_hook=pandas_object_hook)

    try:
        response = plugin.execute(*request['args'], **kwargs)
    except Exception, exception:
        message['error'] = str(exception)

    try:
        json_response = json.dumps(response, cls=PandasJsonEncoder)
    except Exception, exception:
        message['response'] = 'Error encoding response: %s' % exception
    else:
        message['response'] = encode_content_data(json_response, mime_type=
                                                  'application/json')
    sio.emit('execute_reply', message, namespace=NAMESPACE)


if __name__ == '__main__':
    # wrap Flask application with socketio's middleware
    app = socketio.Middleware(sio, app)

    # deploy as an eventlet WSGI server
    plugin = mn.Plugin('zmq_plugin_bridge', 'tcp://localhost:31000',
                       {zmq.SUBSCRIBE: ''})
    gevent.spawn(mn.run_plugin, sio, plugin, logging.INFO, NAMESPACE)
    gevent.pywsgi.WSGIServer(('', 5000), app,
                             handler_class=
                             WebSocketHandler).serve_forever()
