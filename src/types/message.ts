import type { TabEvent } from './tab_event.js';

export type Message = {
    type: MessageType;
    payload?: TabEvent;
};

export enum MessageType {
    JsCookieSet = 'js-cookie-set',
    Click = 'click',
    GetSession = 'get-session'
}
