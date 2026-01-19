function cookieIdentityString(cookie: chrome.cookies.Cookie): string {
    const name = cookie.name ?? '';
    const domain = (cookie.domain ?? '').replace(/^\./, '').toLowerCase();
    const path = cookie.path ?? '/';

    // Partitioned cookies: Chrome exposes partitionKey on Cookie objects.
    const pk = cookie.partitionKey;
    const topLevelSite = pk?.topLevelSite?.toLowerCase() ?? '';
    const hasCrossSiteAncestor = pk?.hasCrossSiteAncestor ?? false;
    const storeId = cookie.storeId ?? '';

    return [
        `n=${name}`,
        `d=${domain}`,
        `p=${path}`,
        `tls=${topLevelSite}`,
        `xsa=${hasCrossSiteAncestor}`,
        `sid=${storeId}`
    ].join('|');
}

function toHex(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i]!.toString(16).padStart(2, '0');
    }
    return hex;
}

export async function generateCookieSignature(cookie: chrome.cookies.Cookie): Promise<string> {
    const s = cookieIdentityString(cookie);
    const data = new TextEncoder().encode(s);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return toHex(hash);
}
