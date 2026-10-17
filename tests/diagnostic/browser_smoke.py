"""Local-only browser acceptance checks. Requires Python Playwright and Chromium.
Run: python tests/diagnostic/browser_smoke.py --output /tmp/vipfish-browser
No production host or live API is contacted.
"""
import argparse
import functools
import json
import shutil
import tempfile
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default=None)
    args = parser.parse_args()
    output = Path(args.output or tempfile.mkdtemp(prefix='vipfish-browser-')).resolve()
    output.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT / 'client/public')))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f'http://127.0.0.1:{server.server_port}'
    url = origin + '/diagnostic/index.html'
    checks = []
    def check(name, condition):
        if not condition:
            raise AssertionError(name)
        checks.append(name)
    try:
        with sync_playwright() as p:
            executable = shutil.which('chromium') or shutil.which('chromium-browser')
            browser = p.chromium.launch(headless=True, executable_path=executable, args=['--no-sandbox'])
            context = browser.new_context(viewport={'width': 1440, 'height': 1050}, accept_downloads=True)
            forbidden = []
            requests = []
            def route_handler(route):
                req = route.request
                requests.append((req.method, req.url))
                if req.url.startswith(origin + '/') and req.method == 'GET':
                    route.continue_()
                else:
                    forbidden.append((req.method, req.url))
                    route.abort()
            context.route('**/*', route_handler)
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('console', lambda msg: errors.append(msg.text) if msg.type == 'error' else None)
            response = page.goto(url, wait_until='networkidle')
            check('static entrypoint returns HTTP 200', response.status == 200)
            check('first question loads', page.locator('#question-title').inner_text() == 'What needs fixing first?')
            check('no default selection', page.locator('input:checked').count() == 0)
            check('continue disabled until a choice', page.locator('#next').is_disabled())
            check('desktop has no horizontal overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            page.screenshot(path=str(output / 'desktop-start.png'), full_page=True)
            page.locator('input[value="enquiries"]').focus()
            page.keyboard.press('Space')
            check('native keyboard selects option', page.locator('input[value="enquiries"]').is_checked())
            page.locator('#next').focus()
            page.keyboard.press('Enter')
            check('focus follows next question', page.evaluate('document.activeElement.id') == 'question-title')
            check('relevant enquiry branch shown', 'enquiries get stuck' in page.locator('#question-title').inner_text())
            page.locator('input[value="reply"]').check()
            page.locator('#next').click()
            page.locator('#back').click()
            page.locator('#back').click()
            page.locator('input[value="admin"]').check()
            page.locator('#next').click()
            check('back and edit replaces stale branch', 'keeps coming back' in page.locator('#question-title').inner_text())
            check('stale selection removed', page.locator('input:checked').count() == 0)
            before_answers = len(requests)
            for choice in ['rekey', 'weekly', 'examples', 'one', 'focused']:
                page.locator(f'input[value="{choice}"]').check()
                page.locator('#next').click()
            check('focused route visible', page.locator('#offer-name').inner_text() == 'Teardown')
            check('correct fixed price', page.locator('#offer-price').inner_text() == '£250')
            check('result focus updated', page.evaluate('document.activeElement.id') == 'result-title')
            check('self-report limitation visible', 'not been independently verified' in page.locator('.limitations').inner_text())
            page.screenshot(path=str(output / 'desktop-result.png'), full_page=True)
            with page.expect_download() as download_info:
                page.locator('#download').click()
            download = download_info.value
            download.save_as(str(output / 'synthetic-brief.json'))
            brief = json.loads((output / 'synthetic-brief.json').read_text())
            check('download contains correct route and six answers', brief['recommendation']['id'] == 'teardown' and len(brief['answers']) == 6)
            check('download does not claim P95 or verified evidence', brief['quality']['score'] is None and brief['evidence']['verification'] == 'unverified')
            check('brief creates no external effects', brief['externalEffects'] == [])
            check('no answer or download network request', len(requests) == before_answers)
            check('contact link carries no answers', page.locator('a[href="/contact"]').get_attribute('href') == '/contact')
            check('no browser persistence', page.evaluate('localStorage.length === 0 && sessionStorage.length === 0 && document.cookie === ""'))
            page.reload(wait_until='networkidle')
            check('reload clears answers', page.locator('#question-title').inner_text() == 'What needs fixing first?' and page.locator('input:checked').count() == 0)
            page.set_viewport_size({'width': 390, 'height': 844})
            page.screenshot(path=str(output / 'mobile-start.png'), full_page=True)
            for choice in ['unknown', 'unknown']:
                page.locator(f'input[value="{choice}"]').check()
                page.locator('#next').click()
            check('unknown exits early with free help', page.locator('#offer-name').inner_text() == 'Free snapshot')
            page.locator('#restart').click()
            for choice in ['unknown', 'quality', 'handoff', 'daily', 'measured', 'several', 'audit']:
                page.locator(f'input[value="{choice}"]').check()
                page.locator('#next').click()
            check('clarified seven-question path reaches audit', page.locator('#offer-name').inner_text() == 'Signal Audit')
            check('audit price correct', page.locator('#offer-price').inner_text() == '£750')
            check('mobile has no horizontal overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            page.screenshot(path=str(output / 'mobile-result.png'), full_page=True)
            page.set_viewport_size({'width': 320, 'height': 640})
            check('320px layout has no horizontal overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            page.emulate_media(reduced_motion='reduce')
            check('reduced-motion style applies', page.evaluate('getComputedStyle(document.querySelector(".primary")).transitionDuration === "0s"'))
            check('no unexpected network destinations', not forbidden)
            check('no browser runtime or CSP errors', not errors)
            context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)
    report = {'status': 'PASS', 'checks': len(checks), 'passed': checks, 'network': 'local GET assets only', 'browser': 'Chromium', 'limitations': 'Not a full accessibility audit, Safari test, deployed-preview test or independent P95 review.'}
    (output / 'browser-report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
