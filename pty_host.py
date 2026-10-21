#!/usr/bin/env python3
"""Line-delimited JSON transport for a real, independently sized POSIX terminal."""
import base64, errno, fcntl, json, os, pty, select, signal, struct, sys, termios

def emit(value):
    print(json.dumps(value), flush=True)

def launch_args(mode, options):
    if mode == 'github': return ['gh', 'auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web']
    if mode != 'codex': return ['/bin/zsh', '-l']
    args = ['codex']
    model = options.get('model', '')
    effort = options.get('effort', '')
    if isinstance(model, str) and model and len(model) <= 160 and not any(c.isspace() for c in model):
        args += ['--model', model]
    if effort in ('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'):
        args += ['-c', 'model_reasoning_effort=' + json.dumps(effort)]
    return args

def main():
    mode, cwd = sys.argv[1:3]
    options = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
    args = launch_args(mode, options)
    pid, fd = pty.fork()
    if pid == 0:
        fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack('HHHH', 35, 100, 0, 0))
        os.chdir(cwd)
        os.environ.update(TERM='xterm-256color', COLORTERM='truecolor', TERM_PROGRAM='CodexStudio')
        os.environ['PATH'] = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:' + os.environ.get('PATH', '')
        try:
            os.execvp(args[0], args)
        except OSError as exc:
            print('Could not launch ' + args[0] + ': ' + str(exc), flush=True)
            os._exit(127)
    def stop(*_):
        try: os.killpg(pid, signal.SIGHUP)
        except ProcessLookupError: pass
        try: os.close(fd)
        except OSError: pass
        sys.exit(0)
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGHUP, stop)
    pending = b''
    while True:
        readable, _, _ = select.select([fd, sys.stdin.buffer], [], [])
        if fd in readable:
            try: data = os.read(fd, 65536)
            except OSError as exc:
                if exc.errno != errno.EIO: raise
                data = b''
            if not data:
                _, status = os.waitpid(pid, 0)
                emit({'exit': os.waitstatus_to_exitcode(status)})
                break
            emit({'data': base64.b64encode(data).decode()})
        if sys.stdin.buffer in readable:
            data = os.read(sys.stdin.fileno(), 65536)
            if not data: stop()
            pending += data
            while b'\n' in pending:
                line, pending = pending.split(b'\n', 1)
                msg = json.loads(line)
                if 'input' in msg:
                    data = msg['input'].encode()
                    while data:
                        count = os.write(fd, data)
                        data = data[count:]
                elif 'cols' in msg:
                    size = struct.pack('HHHH', max(1, int(msg['rows'])), max(2, int(msg['cols'])), 0, 0)
                    fcntl.ioctl(fd, termios.TIOCSWINSZ, size)
    os.close(fd)

if __name__ == '__main__': main()
