'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { HelpCircle } from 'lucide-react'

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Bookmarklet source. When clicked on any listing page, it:
 *  1. Finds the page's main content (or falls back to body)
 *  2. Extracts plain text, trims, caps at 4 KB (keeps AI extraction
 *     latency under ~3s — well within Vercel hobby tier's 10s function
 *     timeout; the property details we care about live at the top of
 *     LoopNet pages anyway)
 *  3. Opens our app in a named tab — falls back to same-tab nav if popups blocked
 *  4. Surfaces any error via alert()
 */
function buildBookmarklet(origin: string): string {
  const src = `
    try{
      var s=document.querySelector('main')||document.querySelector('article')||document.querySelector('[role="main"]')||document.body;
      var t=(s.innerText||'').trim().replace(/\\n{3,}/g,'\\n\\n').slice(0,4000);
      if(!t){alert('Kotofit: no text found on this page.');return;}
      var imgs=[],seen={};
      // Exclude broker/agent headshots & avatars/logos — keep property photos only.
      var SKIP=/people|agent|broker|avatar|profile|headshot|logo/i;
      var nodes=document.querySelectorAll('img');
      for(var i=0;i<nodes.length&&imgs.length<8;i++){
        var src=nodes[i].currentSrc||nodes[i].src||nodes[i].dataset.src||'';
        if(src&&/images?\\d*\\.loopnet\\.com|images?\\d*\\.crexi\\.com/.test(src)&&!SKIP.test(src)&&!seen[src]){seen[src]=1;imgs.push(src);}
      }
      var payload=JSON.stringify({text:t,sourceUrl:location.href,imageUrls:imgs});
      var u=${JSON.stringify(origin)}+'/#import='+encodeURIComponent(payload);
      var w=window.open(u,'kotofit-app');
      if(w){try{w.focus();}catch(_){} }
      else if(confirm('Kotofit: popup blocked. Navigate this tab to the app?')){location.href=u;}
    }catch(e){alert('Kotofit error: '+(e&&e.message||e));}
  `.replace(/\s+/g, ' ').trim()
  return `javascript:(function(){${src}})()`
}

export function BookmarkletHelper() {
  const [origin, setOrigin] = useState('')
  const [copied, setCopied] = useState(false)
  const linkHostRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  // Suppress click on the in-app bookmarklet link — it's only for dragging.
  useEffect(() => {
    const host = linkHostRef.current
    if (!host) return
    const handler = (e: Event) => {
      if ((e.target as HTMLElement)?.closest('a[data-bookmarklet]')) {
        e.preventDefault()
      }
    }
    host.addEventListener('click', handler)
    return () => host.removeEventListener('click', handler)
  }, [origin])

  if (!origin) return null

  const href = buildBookmarklet(origin)
  // React 19 sanitizes `javascript:` URLs out of <a href> at render time, which
  // breaks drag-to-bookmark. Inject the anchor as raw HTML to bypass that.
  const linkHtml =
    `<a href="${escapeHtmlAttr(href)}" data-bookmarklet ` +
    `class="inline-block px-2 py-1 rounded bg-primary text-primary-foreground ` +
    `font-medium no-underline hover:opacity-90 cursor-grab">📌 Save to Kotofit</a>`

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="bookmarklet-trigger gap-2">
            <HelpCircle className="size-4" />
            How it works
          </Button>
        }
      />
      <DialogContent className="bookmarklet-dialog sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">How it works — LoopNet bookmarklet</DialogTitle>
        </DialogHeader>
        <div className="text-sm space-y-3">
          <p className="text-muted-foreground">
            LoopNet (and other CRE sites) block automated fetchers at the network level. A bookmarklet
            runs in your own browser, so the site sees a normal user and doesn&apos;t block it.
          </p>
          <ol className="list-decimal list-inside space-y-1 text-foreground/90">
            <li>Make sure your browser&apos;s bookmarks bar is visible (View → Show Bookmarks Bar)</li>
            <li>
              Drag this link to your bookmarks bar:{' '}
              <span ref={linkHostRef} dangerouslySetInnerHTML={{ __html: linkHtml }} />
            </li>
            <li>Open any listing page (LoopNet, Crexi, broker site, etc.)</li>
            <li>Click the bookmarklet — a new tab opens here with the page text pre-loaded</li>
            <li>The form will auto-extract and populate</li>
          </ol>

          <details className="rounded-md bg-muted/60 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-foreground">
              Bookmarklet not working? Drag failed? Click here for the manual install.
            </summary>
            <div className="mt-2 space-y-2 text-xs">
              <p>
                If the drag didn&apos;t produce a bookmark with a{' '}
                <code className="px-1 rounded bg-field-hover">javascript:</code> URL, some browsers block
                that for security. Workaround:
              </p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Right-click an existing bookmark in your bar → <strong>Add page</strong> (or{' '}
                  <strong>New bookmark</strong>)
                </li>
                <li>
                  Name: <code className="px-1 rounded bg-field-hover">Save to Kotofit</code>
                </li>
                <li>URL: copy the full code below and paste into the URL field:</li>
              </ol>
              <div className="flex gap-2 items-start">
                <textarea
                  readOnly
                  value={href}
                  rows={3}
                  className="flex-1 font-mono text-[10px] bg-panel text-foreground rounded-md px-2 py-1.5 break-all"
                  onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                />
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="text-xs px-2 py-1 rounded-md bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 whitespace-nowrap"
                >
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
            </div>
          </details>

          <p className="text-xs text-muted-foreground">
            The bookmarklet URL is tied to{' '}
            <code className="px-1 py-0.5 rounded bg-muted">{origin}</code>. If
            you change where this app runs, drag a fresh bookmarklet.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
