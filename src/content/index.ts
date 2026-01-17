import { MessageType, type Message } from '../types/message.js';
import type { Session } from '../types/session.js';
import { TabEventType, type TabEvent } from '../types/tab_event.js';

let session: Session;

const opts: AddEventListenerOptions = { capture: true, passive: true };

document.addEventListener('click', clickHandler, opts);

function clickHandler(event: MouseEvent) {
    if (!session) {
        console.log('CLICK WITHOUT SESSION');
        return;
    }
    console.log('CLICK');
    const target = event.target;
    const text = (getTargetElementText(target) ?? '').slice(0, 120);

    const tabEvent: TabEvent = {
        sessionId: session.sessionId,
        timestamp: nowMs(),
        type: TabEventType.Click,
        url: location.href,
        meta: {
            clickData: {
                cssSelector: cssPath(target),
                mouseButton: event.button,
                text: text
            }
        }
    };

    chrome.runtime.sendMessage<Message, any>({
        type: MessageType.Click,
        payload: tabEvent
    });
}

function cssPath(input: EventTarget | null): string {
    if (!(input instanceof HTMLElement)) return '';
    if (!input || !input.nodeType || input.nodeType !== 1) return '';
    var element: Element | HTMLElement | null = input;
    const parts = [];
    while (element && element.nodeType === 1 && parts.length < 6) {
        let part = element.nodeName.toLowerCase();
        if (element.id) {
            part += `#${element.id}`;
            parts.unshift(part);
            break;
        }
        if (element.classList && element.classList.length)
            part += '.' + [...element.classList].slice(0, 2).join('.');
        parts.unshift(part);
        element = element.parentElement;
    }
    return parts.join(' > ');
}

function getTargetElementText(target: EventTarget | null): string | null {
    if (!(target instanceof Element)) return null;

    // Inputs/Textareas/Selects: value verwenden
    if (target instanceof HTMLInputElement) return target.value;
    if (target instanceof HTMLTextAreaElement) return target.value;
    if (target instanceof HTMLSelectElement) return target.value;

    // Buttons/Links/sonstige Elemente: innerText
    if (target instanceof HTMLElement) {
        return (target.innerText || target.textContent || '').trim();
    }

    return (target.textContent || '').trim();
}

function nowMs(): number {
    return Date.now();
}

async function initSession() {
    session = await chrome.runtime.sendMessage<Message, Session>({
        type: MessageType.GetSession
    });
}

initSession();
