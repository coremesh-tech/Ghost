const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');

describe('frontend/cards/poll', function () {
    let dom;
    let originalWindow;
    let originalDocument;
    let originalFetch;
    let originalResizeObserver;
    let originalEventSource;
    let originalRequestAnimationFrame;
    let originalCancelAnimationFrame;
    let originalLocalStorage;

    const pollScriptPath = '../../../../core/frontend/src/cards/js/poll.js';

    const flushMicrotasks = async function (times = 6) {
        for (let index = 0; index < times; index += 1) {
            await Promise.resolve();
        }
    };

    beforeEach(function () {
        originalWindow = global.window;
        originalDocument = global.document;
        originalFetch = global.fetch;
        originalResizeObserver = global.ResizeObserver;
        originalEventSource = global.EventSource;
        originalRequestAnimationFrame = global.requestAnimationFrame;
        originalCancelAnimationFrame = global.cancelAnimationFrame;
        originalLocalStorage = global.localStorage;

        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
                <body>
                    <div
                        class="kg-card kg-poll-card not-kg-prose"
                        data-kg-poll-card="true"
                        data-poll-id="poll_123"
                        data-poll-type="single"
                        data-poll-status="published"
                        data-poll-answer-revealed="false"
                    >
                        <div class="kg-poll-card-header">
                            <h3 class="kg-poll-card-title"></h3>
                        </div>
                        <p class="kg-poll-card-description"></p>
                        <div class="kg-poll-card-body">
                            <div class="kg-poll-card-chart" hidden="hidden"></div>
                            <div class="kg-poll-card-options"></div>
                        </div>
                        <div class="kg-poll-card-meta">
                            <div class="kg-poll-card-votes"></div>
                            <div class="kg-poll-card-meta-status">
                                <div class="kg-poll-card-expiry" hidden="hidden"><span></span></div>
                                <div class="kg-poll-card-ended" hidden="hidden">Ended</div>
                            </div>
                        </div>
                        <p class="kg-poll-card-feedback" hidden="hidden"></p>
                    </div>
                </body>
            </html>
        `, {
            url: 'https://example.com/post/poll'
        });

        global.window = dom.window;
        global.document = dom.window.document;
        global.localStorage = dom.window.localStorage;
        global.fetch = async function (url) {
            const payloads = {
                '/members/api/polls/poll_123': {
                    poll_id: 'poll_123',
                    title: 'What should we ship next?',
                    description: 'Choose the feature you want first.',
                    published_at: '2026-06-01T00:00:00.000Z',
                    status: 'published',
                    options: [
                        {id: 'option_a', text: 'Native polls'},
                        {id: 'option_b', text: 'Theme hydration'}
                    ],
                    viewer: {
                        can_vote: true,
                        can_interact: true,
                        has_voted: false,
                        selected_option_ids: []
                    },
                    meta: {
                        logged_in: false
                    }
                },
                '/members/api/polls/poll_123/votes': {
                    total_votes: 20,
                    options: [
                        {id: 'option_a', text: 'Native polls', vote_count: 8, vote_rate: 40},
                        {id: 'option_b', text: 'Theme hydration', vote_count: 12, vote_rate: 60}
                    ],
                    viewer: {
                        can_vote: true,
                        can_interact: true,
                        has_voted: false,
                        selected_option_ids: []
                    },
                    answer: {
                        revealed: false,
                        correct_option_ids: []
                    }
                }
            };
            const trendsPayload = {
                points: [
                    {
                        time: '2026-06-10T23:30:00.000Z',
                        options: [
                            {id: 'option_a', vote_rate: 42},
                            {id: 'option_b', vote_rate: 58}
                        ]
                    },
                    {
                        time: '2026-06-11T00:00:00.000Z',
                        options: [
                            {id: 'option_a', vote_rate: 40},
                            {id: 'option_b', vote_rate: 60}
                        ]
                    }
                ]
            };
            const requestUrl = new URL(url, 'https://example.com');
            const payload = requestUrl.pathname === '/members/api/polls/poll_123/trends'
                ? trendsPayload
                : payloads[requestUrl.pathname];

            return {
                ok: Boolean(payload),
                status: payload ? 200 : 404,
                json: async function () {
                    return payload;
                }
            };
        };
        global.window.fetch = global.fetch;

        global.ResizeObserver = class ResizeObserver {
            observe() {}
            disconnect() {}
        };

        global.EventSource = class EventSource {
            constructor() {}
            addEventListener() {}
            close() {}
        };

        global.requestAnimationFrame = function (callback) {
            callback();
            return 1;
        };
        global.cancelAnimationFrame = function () {};

        global.window.matchMedia = function () {
            return {
                matches: true,
                addEventListener() {},
                removeEventListener() {}
            };
        };

        global.window.LightweightCharts = {
            CrosshairMode: {Normal: 0},
            createChart() {
                return {
                    addLineSeries() {
                        return {
                            setData() {}
                        };
                    },
                    applyOptions() {},
                    subscribeCrosshairMove() {},
                    unsubscribeCrosshairMove() {},
                    remove() {},
                    timeScale() {
                        return {
                            fitContent() {},
                            timeToCoordinate() {
                                return 40;
                            }
                        };
                    }
                };
            }
        };

        Object.defineProperty(global.document, 'readyState', {
            configurable: true,
            get() {
                return 'complete';
            }
        });

        const originalGetBoundingClientRect = global.window.Element.prototype.getBoundingClientRect;
        global.window.Element.prototype.getBoundingClientRect = function () {
            if (this.classList.contains('kg-poll-card-options')) {
                return {width: 320, height: 90, top: 0, left: 0, right: 320, bottom: 90};
            }

            if (this.classList.contains('kg-poll-card-chart-legend')) {
                return {width: 260, height: 70, top: 0, left: 0, right: 260, bottom: 70};
            }

            if (this.classList.contains('kg-poll-card-chart')) {
                return {width: 320, height: 120, top: 0, left: 0, right: 320, bottom: 120};
            }

            if (this.classList.contains('kg-poll-card-chart-surface')) {
                const plotHeight = Number.parseInt(this.parentElement.style.height, 10) || 120;
                return {width: 320, height: plotHeight, top: 0, left: 0, right: 320, bottom: plotHeight};
            }

            return originalGetBoundingClientRect.call(this);
        };

        Object.defineProperty(global.window.HTMLElement.prototype, 'scrollWidth', {
            configurable: true,
            get() {
                return 80;
            }
        });
    });

    afterEach(function () {
        const resolvedPath = require.resolve(pollScriptPath);
        delete require.cache[resolvedPath];

        dom.window.close();

        global.window = originalWindow;
        global.document = originalDocument;
        global.fetch = originalFetch;
        global.ResizeObserver = originalResizeObserver;
        global.EventSource = originalEventSource;
        global.requestAnimationFrame = originalRequestAnimationFrame;
        global.cancelAnimationFrame = originalCancelAnimationFrame;
        global.localStorage = originalLocalStorage;
    });

    it('keeps the desktop trend plot at least 60px tall when the legend grows', async function () {
        global.document.querySelector('.kg-poll-card').__kgPollTrends = {
            points: [
                {
                    time: '2026-06-10T23:30:00.000Z',
                    options: [
                        {id: 'option_a', vote_rate: 42},
                        {id: 'option_b', vote_rate: 58}
                    ]
                },
                {
                    time: '2026-06-11T00:00:00.000Z',
                    options: [
                        {id: 'option_a', vote_rate: 40},
                        {id: 'option_b', vote_rate: 60}
                    ]
                }
            ]
        };
        require(pollScriptPath);
        global.document.dispatchEvent(new global.window.Event('DOMContentLoaded'));
        await flushMicrotasks();

        const card = global.document.querySelector('.kg-poll-card');
        const plot = global.document.querySelector('.kg-poll-card-chart-plot');

        assert.equal(card.dataset.pollHydrated, 'true');
        assert.ok(plot, global.document.body.innerHTML);
        assert.equal(plot.style.height, '60px');
    });
});
