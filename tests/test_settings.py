import base64, json, os, pathlib, select, subprocess, sys, tempfile, time, unittest
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
import pty_host, settings_host
from unittest.mock import patch

class SettingsTests(unittest.TestCase):
 def test_arguments_preserve_defaults_and_quote_effort(self):
  self.assertEqual(pty_host.launch_args('codex',{}),['codex'])
  self.assertEqual(pty_host.launch_args('codex',{'model':'test-model','effort':'high'}),['codex','--model','test-model','-c','model_reasoning_effort="high"'])
  self.assertEqual(pty_host.launch_args('codex',{'effort':'high; echo bad'}),['codex'])
  self.assertEqual(pty_host.launch_args('shell',{'model':'test'}),['/bin/zsh','-l'])
 def test_claude_uses_separate_model_and_preserves_cli_defaults(self):
  self.assertEqual(pty_host.launch_args('claude',{}),['claude'])
  self.assertEqual(pty_host.launch_args('claude',{'model':'codex-model','effort':'ultra'}),['claude'])
  self.assertEqual(pty_host.launch_args('claude',{'claudeModel':'sonnet','effort':'high'}),['claude','--model','sonnet'])
  self.assertEqual(pty_host.launch_args('codex',{'claudeModel':'opus'}),['codex'])
  for model in ['bad model','--help','x'*161,None]:
   self.assertEqual(pty_host.launch_args('claude',{'claudeModel':model}),['claude'])
 def test_claude_launch_through_real_pty(self):
  # Stand-in CLI checks the transport without requiring a paid Claude session.
  with tempfile.TemporaryDirectory() as directory:
   fixture=pathlib.Path(directory)/'cli.py'
   fixture.write_text("import os,sys\nprint('ARGS='+repr(sys.argv[1:]),flush=True)\nprint('INPUT='+input(),flush=True)\nprint('SIZE='+str(os.get_terminal_size().columns)+'x'+str(os.get_terminal_size().lines),flush=True)\n")
   code="import sys,pty_host; original=pty_host.launch_args; pty_host.launch_args=lambda mode,options:[sys.executable,'-u',"+repr(str(fixture))+"]+original(mode,options)[1:]; pty_host.main()"
   p=subprocess.Popen([sys.executable,'-c',code,'claude',directory,json.dumps({'claudeModel':'opus','model':'unrelated','effort':'ultra'})],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
   try:
    commands=json.dumps({'cols':91,'rows':27})+'\n'+json.dumps({'input':'hello claude\n'})+'\n'
    p.stdin.write(commands.encode());p.stdin.flush()
    p.wait(timeout=10)
    output=''.join(base64.b64decode(m['data']).decode() for line in p.stdout for m in [json.loads(line)] if 'data' in m)
    self.assertEqual(p.returncode,0)
    self.assertIn("ARGS=['--model', 'opus']",output)
    self.assertIn('INPUT=hello claude',output)
    self.assertIn('SIZE=91x27',output)
   finally:
    if p.poll() is None:p.terminate();p.wait(timeout=5)
    p.stdin.close();p.stdout.close()
 def test_remote_validation_and_update(self):
  with tempfile.TemporaryDirectory() as directory:
   subprocess.run(['git','init','-q',directory],check=True)
   settings_host.execute(directory,{'action':'remote','repo':'example/project'})
   self.assertEqual(settings_host.status(directory)['repo'],'example/project')
   settings_host.execute(directory,{'action':'remote','repo':'https://github.com/example/another.git'})
   self.assertEqual(settings_host.status(directory)['repo'],'example/another')
   for value in ['-bad/repo','https://evil.test/a/b','a/b; echo bad','a/..']:
    with self.assertRaises(ValueError): settings_host.execute(directory,{'action':'remote','repo':value})
 def test_contributions_success_and_errors(self):
  calendar={'totalContributions':12,'weeks':[]}
  payload={'data':{'viewer':{'login':'example','contributionsCollection':{'contributionCalendar':calendar}}}}
  with patch.object(settings_host,'status',return_value={'gh':True,'repo':'example/project'}):
   with patch.object(settings_host,'run',return_value=subprocess.CompletedProcess([],0,json.dumps(payload),'')) as command:
    result=settings_host.execute('.',{'action':'contributions'})
    self.assertEqual(result['calendar'],calendar)
    self.assertEqual(result['login'],'example')
    self.assertIn('--hostname',command.call_args.args[0])
   for response in [subprocess.CompletedProcess([],1,'','secret error'),subprocess.CompletedProcess([],0,'{"errors":[{"message":"secret"}]}','')]:
    with patch.object(settings_host,'run',return_value=response):
     result=settings_host.contributions('.')
     self.assertIn('error',result)
     self.assertNotIn('secret',result['error'])
  with patch.object(settings_host,'status',return_value={'gh':False}), patch.object(settings_host,'run') as command:
   self.assertIn('Install GitHub CLI',settings_host.contributions('.')['error'])
   command.assert_not_called()
 def test_real_pty_input_output_resize(self):
  with tempfile.TemporaryDirectory() as directory:
   env=dict(os.environ,ZDOTDIR=directory)
   p=subprocess.Popen([sys.executable,'pty_host.py','shell',directory],stdin=subprocess.PIPE,stdout=subprocess.PIPE,env=env)
   pending=b''; output=''
   def send(value): p.stdin.write(json.dumps(value).encode()+b'\n');p.stdin.flush()
   def until(marker):
    nonlocal pending,output
    deadline=time.monotonic()+10
    while marker not in output and time.monotonic()<deadline:
     if select.select([p.stdout],[],[],.2)[0]:
      chunk=os.read(p.stdout.fileno(),65536)
      if not chunk: break
      pending+=chunk
      while b'\n' in pending:
       line,pending=pending.split(b'\n',1);msg=json.loads(line)
       if 'data' in msg:output+=base64.b64decode(msg['data']).decode(errors='replace')
    self.assertIn(marker,output)
   try:
    send({'input':"printf 'PTY_%s\\n' READY\n"});until('PTY_READY')
    send({'cols':91,'rows':27});send({'input':'stty size\n'});until('27 91')
    send({'input':'exit\n'});p.wait(timeout=5);self.assertEqual(p.returncode,0)
   finally:
    if p.poll() is None:p.terminate();p.wait(timeout=5)
    p.stdin.close();p.stdout.close()
if __name__=='__main__':unittest.main()
