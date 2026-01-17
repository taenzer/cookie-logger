import { CookieCategory } from '../types/cookie-data.js';
import { TabEventType, type TabEvent } from '../types/tab_event.js';

type CookieBatch = {
    addedByCategory: Map<CookieCategory, number>;
    removedByCategory: Map<CookieCategory, number>;
    firstTs: number;
    lastTs: number;
};

export function renderProtocol(events: TabEvent[]): void {
    const host = document.getElementById('protocol');
    if (!host) return;

    // Defensive copy + sort
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    host.replaceChildren();

    if (sorted.length === 0) {
        host.textContent = '';
        return;
    }

    const MILESTON_EVENTS = new Set([
        TabEventType.Click,
        TabEventType.SessionStart
    ]);

    const isMilestone = (e: TabEvent) => MILESTON_EVENTS.has(e.type);

    const isCookieEvent = (e: TabEvent) => !isMilestone(e);

    const inc = (m: Map<string, number>, key: string, delta = 1) => {
        m.set(key, (m.get(key) ?? 0) + delta);
    };

    const sumMap = (m: Map<string, number>): number => {
        let s = 0;
        for (const v of m.values()) s += v;
        return s;
    };

    const formatMs = (ms: number): string => {
        const v = Math.round(ms);
        return `${v}ms`;
    };

    const formatCategoryBreakdown = (m: Map<string, number>): string => {
        const parts = [...m.entries()]
            .filter(([, n]) => n > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, n]) => `${n}x ${cat}`);
        return parts.length ? parts.join(', ') : '—';
    };

    const safeSnippet = (s: string | undefined, max = 120): string => {
        const v = (s ?? '').replace(/\s+/g, ' ').trim();
        if (!v) return '';
        return v.length > max ? `${v.slice(0, max)}…` : v;
    };

    // UI helpers (DOM-safe via textContent)
    const ul = document.createElement('ul');
    ul.style.margin = '0';
    ul.style.paddingLeft = '18px';
    ul.style.fontFamily =
        'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    ul.style.fontSize = '13px';
    ul.style.lineHeight = '1.35';

    host.appendChild(ul);

    const addListItem = (lines: string[]) => {
        const li = document.createElement('li');
        li.style.margin = '6px 0';

        // Render multiple lines inside one bullet (to mimic your visual structure)
        for (let i = 0; i < lines.length; i++) {
            const line = document.createElement('div');
            line.textContent = lines[i] ?? '';
            if (i > 0) line.style.marginLeft = '0px';
            li.appendChild(line);
        }
        ul.appendChild(li);
    };

    const addConnector = (ms: number) => {
        // A connector line shown *between* two rendered entries
        // e.g. "| 500ms"
        addListItem([`| ${formatMs(ms)}`]);
    };

    const ensureBatch = (b: CookieBatch | null, ts: number): CookieBatch => {
        if (b) return b;
        return {
            addedByCategory: new Map(),
            removedByCategory: new Map(),
            firstTs: ts,
            lastTs: ts
        };
    };

    const flushCookieBatch = (
        batch: CookieBatch | null
    ): CookieBatch | null => {
        if (!batch) return null;

        const addedTotal = sumMap(batch.addedByCategory);
        const removedTotal = sumMap(batch.removedByCategory);

        if (addedTotal === 0 && removedTotal === 0) return null;

        const lines: string[] = [];

        if (addedTotal > 0) {
            lines.push(
                `| + ${addedTotal} Cookies (${formatCategoryBreakdown(batch.addedByCategory)})`
            );
        }
        if (removedTotal > 0) {
            lines.push(
                `| - ${removedTotal} Cookies (${formatCategoryBreakdown(batch.removedByCategory)})`
            );
        }

        addListItem(lines);
        return null;
    };

    const renderMilestone = (e: TabEvent) => {
        if (e.type == TabEventType.SessionStart) {
            addListItem(['Session gestartet']);
            return;
        }
        // if (SESSION_END.has(e.type)) {
        //     addListItem(['End Session']);
        //     return;
        // }

        if (e.type == TabEventType.Click) {
            const txt = safeSnippet(e.meta?.clickData?.text, 140);
            const details = txt ? ` | "${txt}"` : '';
            addListItem([`Click (${details})`]);
            return;
        }
        // Fallback
        addListItem([`Event: ${e.type}`]);
    };

    // Main scan: cookie events are grouped until next milestone
    let lastRenderedTs: number | null = null;
    let cookieBatch: CookieBatch | null = null;

    for (const e of sorted) {
        if (isCookieEvent(e)) {
            cookieBatch = ensureBatch(cookieBatch, e.timestamp);
            cookieBatch.lastTs = e.timestamp;

            const cat = e.meta?.cookieData?.category ?? CookieCategory.Unknown;
            if (e.type == TabEventType.SetCookieViaHeader)
                inc(cookieBatch.addedByCategory, cat, 1);
            // else if (COOKIE_REMOVE.has(e.type))
            //     inc(cookieBatch.removedByCategory, cat, 1);

            continue;
        }

        if (isMilestone(e)) {
            // If time passed since last rendered entry, show connector
            if (lastRenderedTs !== null) {
                const delta = e.timestamp - lastRenderedTs;
                if (delta > 0) addConnector(delta);
            }

            // Flush any cookie batch that happened since last milestone
            cookieBatch = flushCookieBatch(cookieBatch);

            // Render milestone itself
            renderMilestone(e);
            lastRenderedTs = e.timestamp;
            continue;
        }

        // Non-cookie, non-milestone events (optional): render them plainly
        if (lastRenderedTs !== null) {
            const delta = e.timestamp - lastRenderedTs;
            if (delta > 0) addConnector(delta);
        }
        cookieBatch = flushCookieBatch(cookieBatch);
        addListItem([`Event: ${e.type}`]);
        lastRenderedTs = e.timestamp;
    }

    // Final flush: if the session ended without a milestone after last cookie batch
    cookieBatch = flushCookieBatch(cookieBatch);
}
