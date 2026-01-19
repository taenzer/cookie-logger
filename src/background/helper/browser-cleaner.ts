function isBrowserExtensionsPage(url: string): boolean {
    // chrome://extensions, edge://extensions, brave://extensions, etc.
    try {
        const u = new URL(url);

        // z.B. chrome:, edge:, brave:
        const scheme = u.protocol; // "chrome:" etc.
        const host = u.hostname; // bei chrome://extensions ist hostname "extensions"

        return host === 'extensions';
    } catch {
        return /^([a-z]+):\/\/extensions\b/i.test(url);
    }
}

function isOurExtensionPage(url: string): boolean {
    // Base: chrome-extension://<EXTENSION_ID>/
    const base = chrome.runtime.getURL('');
    return url.startsWith(base);
}

export async function closeAllTabsExcept(keepTabId?: number): Promise<void> {
    const tabs = await chrome.tabs.query({});

    const tabsToClose: number[] = tabs
        .filter((t) => t.id !== undefined)
        .filter((t) => keepTabId === undefined || t.id !== keepTabId)
        .filter((t) => {
            const url = t.url ?? '';
            if (!url) return true;
            if (isBrowserExtensionsPage(url)) return false;
            if (isOurExtensionPage(url)) return false;
            return true;
        })
        .map((t) => t.id as number);

    if (tabsToClose.length > 0) {
        await chrome.tabs.remove(tabsToClose);
    }
}
