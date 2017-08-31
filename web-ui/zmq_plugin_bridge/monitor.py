# coding: utf-8
import json
import logging
import sys

from zmq import green as zmq
from zmq_plugin.plugin import Plugin
from zmq_plugin.schema import (validate, PandasJsonEncoder,
                               encode_content_data,
                               decode_content_data)
import IPython
import arrow
import gevent
import jsonschema

logger = logging.getLogger(__name__)


def run_plugin(sio, plugin, log_level=None, namespace=None):
    if log_level is not None:
        logging.basicConfig(level=log_level)

    plugin.reset()

    def get_message():
        msg_frames = plugin.subscribe_socket.recv_multipart(zmq.NOBLOCK)
        message_str = msg_frames[-1]

        try:
            # Decode message from first (and only expected) frame.
            message = json.loads(message_str)
            # Validate message against schema.
            validate(message)
        except jsonschema.ValidationError:
            logger.error('Unexpected message', exc_info=True)
            raise
        else:
            return message

    start = arrow.now()

    while True:
        try:
            try:
                message = get_message()
            except zmq.Again:
                gevent.sleep(.01)
                continue

            msg_timestamp = arrow.get(message['header']['date'])
            delta_time = (msg_timestamp - start).total_seconds()
            time_info = msg_timestamp.strftime('%H:%M:%S')
            if delta_time > .25:
                time_info += (' +%-5.1f' % delta_time)
                print 72 * '-'
            if message['header']['msg_type'] == 'execute_reply':
                msg_info = (time_info +
                            ' [{header[target]}<-{header[source]}] '
                            '{content[command]}'.format(**message))
                print msg_info
                data = decode_content_data(message)
                try:
                    json_data = json.dumps(data, cls=PandasJsonEncoder)
                except:
                    import pdb; pdb.set_trace()
                content = encode_content_data(json_data, mime_type=
                                              'application/json')
                message['content'].update(content)
            elif 'content' in message:
                msg_info = (time_info +
                            ' [{header[source]}->{header[target]}] '
                            '{content[command]}'.format(**message))
                data = decode_content_data(message)
                try:
                    json_data = json.dumps(data, cls=PandasJsonEncoder)
                except:
                    import pdb; pdb.set_trace()
                content = encode_content_data(json_data, mime_type=
                                              'application/json')
                message['content'].update(content)
            else:
                msg_info = (time_info +
                            ' [{header[source]}->{header[target]}] '
                            '<{header[msg_type]}>'.format(**message))
            print msg_info
            sio.emit('zmq', message, namespace=namespace)
            start = arrow.now()
        except KeyboardInterrupt:
            IPython.embed()
        except RuntimeError, exception:
            logger.error('Error', exc_info=True)


def parse_args(args=None):
    """Parses arguments, returns (options, args)."""
    from argparse import ArgumentParser

    if args is None:
        args = sys.argv

    parser = ArgumentParser(description='ZeroMQ Plugin process.')
    log_levels = ('critical', 'error', 'warning', 'info', 'debug', 'notset')
    parser.add_argument('-l', '--log-level', type=str, choices=log_levels,
                        default='info')
    parser.add_argument('hub_uri')
    parser.add_argument('name', type=str)

    args = parser.parse_args()
    args.log_level = getattr(logging, args.log_level.upper())
    return args


if __name__ == '__main__':
    args = parse_args()

    plugin = Plugin(args.name, args.hub_uri, {zmq.SUBSCRIBE: ''})
    run_plugin(plugin, args.log_level)
