#!/usr/bin/env python3
"""Narrow local settings bridge. Never returns tokens or credential files."""
import json, os, pathlib, re, shutil, subprocess, sys

os.environ['PATH'] = '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:' + os.environ.get('PATH', '')

def run(args, cwd, check=True):
    result = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=20)
    if check and result.returncode:
        raise ValueError('Command failed. Check repository permissions or GitHub sign-in in the terminal.')
    return result

def models():
    try:
        home = pathlib.Path(os.environ.get('CODEX_HOME', str(pathlib.Path.home()/'.codex')))
        data = json.loads((home/'models_cache.json').read_text())
        return [{'id':m['slug'], 'name':m.get('display_name',m['slug']),
                 'efforts':[e['effort'] for e in m.get('supported_reasoning_levels',[])]}
                for m in data.get('models',[]) if m.get('visibility') != 'hide']
    except (OSError, ValueError, KeyError):
        return []

def status(cwd):
    root = run(['git','rev-parse','--show-toplevel'],cwd,False)
    remote = run(['git','remote','get-url','origin'],cwd,False) if root.returncode == 0 else None
    value = remote.stdout.strip() if remote and remote.returncode == 0 else ''
    # Avoid exposing credentials embedded in existing remote URLs.
    match = re.fullmatch(r'(?:https://github\.com/|git@github\.com:)([\w.-]+/[\w.-]+?)(?:\.git)?',value)
    repo = match.group(1) if match else ''
    accounts = []
    gh = shutil.which('gh')
    if gh:
        result = run([gh,'auth','status','--hostname','github.com','--json','hosts'],cwd,False)
        try:
            accounts = [{'login':a['login'],'active':a.get('active',False)} for a in json.loads(result.stdout).get('hosts',{}).get('github.com',[]) if a.get('login')]
        except (ValueError, KeyError): pass
    return {'models':models(),'cwd':cwd,'git':root.returncode == 0,'repo':repo,
            'hasOrigin':bool(value),'gh':bool(gh),'accounts':accounts}

def contributions(cwd):
    result = status(cwd)
    if not result['gh']:
        result['error'] = 'Install GitHub CLI, then sign in through Settings → GitHub.'
        return result
    query = 'query { viewer { login contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date weekday contributionCount contributionLevel } } } } } }'
    try:
        response = run(['gh','api','graphql','--hostname','github.com','-f','query='+query],cwd,False)
        payload = json.loads(response.stdout)
        if response.returncode or payload.get('errors'):
            raise ValueError()
        viewer = payload['data']['viewer']
        result['login'] = viewer['login']
        result['calendar'] = viewer['contributionsCollection']['contributionCalendar']
    except (ValueError, KeyError, TypeError, subprocess.TimeoutExpired):
        result['error'] = 'Could not load contributions. Check your connection and GitHub sign-in in Settings, then refresh.'
    return result


def execute(cwd, request):
    action = request.get('action','status')
    if action == 'contributions':
        return contributions(cwd)
    if action == 'remote':
        repo = re.sub(r'^https://github\.com/|\.git$', '', request.get('repo','').strip().rstrip('/'))
        if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9_.-]+',repo) or repo.split('/')[1] in ('.','..'):
            raise ValueError('Enter a GitHub repository as owner/repository.')
        if run(['git','rev-parse','--show-toplevel'],cwd,False).returncode:
            raise ValueError('Choose a local Git repository first, or initialize this folder with git init.')
        exists = run(['git','remote','get-url','origin'],cwd,False).returncode == 0
        run(['git','remote','set-url' if exists else 'add','origin','https://github.com/'+repo+'.git'],cwd)
    elif action == 'switch':
        login = request.get('login','')
        if not re.fullmatch(r'[A-Za-z0-9-]+',login): raise ValueError('Choose a GitHub account.')
        if not shutil.which('gh'): raise ValueError('Install GitHub CLI first.')
        run(['gh','auth','switch','--hostname','github.com','--user',login],cwd)
    elif action != 'status': raise ValueError('Unknown settings action.')
    return status(cwd)

if __name__ == '__main__':
    try: print(json.dumps(execute(sys.argv[1],json.loads(sys.argv[2]))))
    except Exception as exc: print(json.dumps({'error':str(exc)}))
