import type { TabEvent } from './tab_event.js';

export type Session = {
    sessionId: string;
    t0: number;
    events?: TabEvent[];
    url: string;
};
