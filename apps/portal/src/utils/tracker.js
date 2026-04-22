const TRACKING_URL = '/members/api/track/events';

let sessionTokenCache = null;
let tokenCacheTime = 0;

const isTokenValid = (token) => {
    if (!token) {
        return false;
    }
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload && payload.exp) {
            return payload.exp * 1000 > Date.now() + 300000;
        }
    } catch (e) {
        // ignore
    }
    return Date.now() - tokenCacheTime < 15 * 60 * 1000;
};

const getToken = async () => {
    if (isTokenValid(sessionTokenCache)) {
        return sessionTokenCache;
    }
    try {
        const res = await fetch(`/members/api/session/`, {credentials: 'include'});
        if (!res.ok) {
            return null;
        }
        const token = await res.text();
        sessionTokenCache = token;
        tokenCacheTime = Date.now();
        return token;
    } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Failed to get session token for tracking', e);
        return null;
    }
};

const getIdentity = async () => {
    let token = null;
    try {
        token = await getToken();
    } catch (e) {
        // ignore
    }

    if (token) {
        return {
            role: 'member',
            uid: 'portal-member',
            token
        };
    }

    let guestUid = localStorage.getItem('ratus_guest_uid');
    if (!guestUid) {
        guestUid = window.crypto && window.crypto.randomUUID
            ? window.crypto.randomUUID()
            : Math.random().toString(36).substring(2);
        localStorage.setItem('ratus_guest_uid', guestUid);
    }
    return {
        role: 'guest',
        uid: guestUid,
        token: null
    };
};

export const trackEvent = async (type, payload = {}) => {
    // Only track events when the user is on the /topics/met-gala/ page
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/topics/met-gala/')) {
        return;
    }

    const eventObj = {
        eventId: window.crypto && window.crypto.randomUUID
            ? window.crypto.randomUUID()
            : Math.random().toString(36).substring(2),
        type,
        topic: 'met_gala',
        payload,
        timestamp: Date.now()
    };

    try {
        const identity = await getIdentity();
        const headers = {
            'Content-Type': 'application/json',
            'X-User-Role': identity.role,
            'X-User-Id': identity.uid
        };

        if (identity.token) {
            headers.Authorization = `Bearer ${identity.token}`;
        }

        await fetch(TRACKING_URL, {
            method: 'POST',
            headers,
            body: JSON.stringify({events: [eventObj]}),
            keepalive: true
        });
    } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to send tracking event', e);
    }
};
