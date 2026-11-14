#!/usr/bin/env python3
"""Install an opt-in analytics tracker include across local portfolio HTML pages."""
import argparse
from pathlib import Path
from urllib.parse import urlparse
p=argparse.ArgumentParser()
p.add_argument('--repo',required=True,type=Path)
p.add_argument('--endpoint',required=True)
a=p.parse_args()
u=urlparse(a.endpoint)
if u.scheme!='https' or not u.hostname: p.error('An HTTPS endpoint is required')
script='<script defer src="/portfolio-insights/tracker.js" data-endpoint="'+a.endpoint.rstrip('/')+'"></script>'
count=0
for f in a.repo.rglob('*.html'):
    if 'portfolio-insights' in f.parts or '.git' in f.parts: continue
    txt=f.read_text(encoding='utf-8')
    if '<!-- Portfolio Insights -->' in txt or '</body>' not in txt: continue
    f.write_text(txt.replace('</body>','<!-- Portfolio Insights -->\n'+script+'\n</body>'),encoding='utf-8')
    count+=1
print('Instrumented',count,'pages. Collection remains consent-gated.')
