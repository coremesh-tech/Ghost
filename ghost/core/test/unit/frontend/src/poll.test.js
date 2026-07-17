const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');

describe('frontend/cards/poll', function () {
    let dom;
    let optionsHeight;
    let legendHeight;
    let resizeObserverInstances;
    let chartSeriesOptions;
    let chartSeriesData;
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

    const flushTimers = async function (times = 2) {
        for (let index = 0; index < times; index += 1) {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        }
    };

    const setTrendPoints = function (points) {
        const trendsPayload = {points: points};
        const fetchWithoutTrendOverride = global.fetch;

        global.document.querySelector('.kg-poll-card').__kgPollTrends = trendsPayload;
        global.fetch = async function (url) {
            const requestUrl = new URL(url, 'https://example.com');

            if (requestUrl.pathname === '/members/api/polls/poll_123/trends') {
                return {
                    ok: true,
                    status: 200,
                    json: async function () {
                        return trendsPayload;
                    }
                };
            }

            return fetchWithoutTrendOverride(url);
        };
        global.window.fetch = global.fetch;

        return points.map(function (point) {
            return Date.parse(point.time) / 1000;
        });
    };

    const setTrendRates = function (rates) {
        const start = Date.parse('2026-06-10T22:30:00.000Z');
        const points = rates.map(function (rate, index) {
            return {
                time: new Date(start + (index * 30 * 60 * 1000)).toISOString(),
                options: [
                    {id: 'option_a', vote_rate: rate},
                    {id: 'option_b', vote_rate: 100 - rate}
                ]
            };
        });

        return setTrendPoints(points);
    };

    const assertSeriesStaysWithinSegments = function (data, times, rates) {
        assert.ok(Array.isArray(data) && data.length > 0, 'Expected chart series data to be non-empty');
        assert.ok(times.length >= 2, 'Expected at least two source timestamps');
        assert.equal(times.length, rates.length, 'Expected one source rate for every timestamp');

        data.forEach(function (point, pointIndex) {
            const pointDescription = `point time=${String(point.time)} value=${String(point.value)}`;
            const sourceTimeBounds = `${times[0]}..${times[times.length - 1]}`;

            assert.ok(Number.isFinite(point.time), `${pointDescription}; expected a finite timestamp within source time bounds ${sourceTimeBounds}`);
            assert.ok(point.time >= times[0] && point.time <= times[times.length - 1], `${pointDescription}; expected source time bounds ${sourceTimeBounds}`);

            if (pointIndex > 0) {
                assert.ok(point.time > data[pointIndex - 1].time, `${pointDescription}; expected a timestamp strictly after ${data[pointIndex - 1].time} within source time bounds ${sourceTimeBounds}`);
            }

            assert.ok(Number.isFinite(point.value), `${pointDescription}; expected a finite value within chart bounds 0..100`);
            assert.ok(point.value >= 0 && point.value <= 100, `${pointDescription}; expected chart value bounds 0..100`);

            let segmentIndex = -1;
            for (let index = 0; index < times.length - 1; index += 1) {
                if (point.time >= times[index] && point.time <= times[index + 1]) {
                    segmentIndex = index;
                    break;
                }
            }

            assert.notEqual(segmentIndex, -1, `${pointDescription}; expected a neighbouring source segment within time bounds ${sourceTimeBounds}`);
            const segmentMin = Math.min(rates[segmentIndex], rates[segmentIndex + 1]);
            const segmentMax = Math.max(rates[segmentIndex], rates[segmentIndex + 1]);
            assert.ok(point.value >= segmentMin && point.value <= segmentMax, `${pointDescription}; expected segment value bounds ${segmentMin}..${segmentMax}`);
        });
    };

    const assertSeriesPreservesSourcePoints = function (data, times, rates) {
        assert.ok(Array.isArray(data), 'Expected chart series data before checking source points');

        times.forEach(function (time, index) {
            const expectedValue = rates[index];
            const matches = data.filter(function (point) {
                return point.time === time;
            });

            assert.equal(matches.length, 1, `Expected source point time=${time} value=${expectedValue} exactly once; found ${matches.length}`);
            assert.equal(matches[0].value, expectedValue, `Expected source point time=${time} value=${expectedValue}; found value=${matches[0].value}`);
        });
    };

    const assertSeriesMatchesContract = function (seriesIndex, times, rates) {
        const options = chartSeriesOptions[seriesIndex];
        const data = chartSeriesData[seriesIndex];

        assert.ok(options, `Expected chart options for series ${seriesIndex}`);
        assert.equal(options.lineType, global.window.LightweightCharts.LineType.Simple, `Expected bounded trend series ${seriesIndex} to use LineType.Simple`);
        assert.ok(Array.isArray(data), `Expected chart data for series ${seriesIndex}`);
        assert.ok(data.length > rates.length, `Expected smoothed series ${seriesIndex} to contain more than ${rates.length} source points; found ${data.length}`);
        assertSeriesPreservesSourcePoints(data, times, rates);
        assertSeriesStaysWithinSegments(data, times, rates);
    };

    beforeEach(function () {
        optionsHeight = 90;
        legendHeight = 70;
        resizeObserverInstances = [];
        chartSeriesOptions = [];
        chartSeriesData = [];
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
            constructor(callback) {
                this.callback = callback;
                this.targets = [];
                resizeObserverInstances.push(this);
            }

            observe(target) {
                this.targets.push(target);
            }

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
            LineType: {Simple: 0, Curved: 2},
            createChart() {
                return {
                    addLineSeries(options) {
                        const seriesIndex = chartSeriesOptions.length;
                        chartSeriesOptions.push(options);
                        chartSeriesData.push([]);

                        return {
                            setData(data) {
                                chartSeriesData[seriesIndex] = data;
                            }
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
                return {width: 320, height: optionsHeight, top: 0, left: 0, right: 320, bottom: optionsHeight};
            }

            if (this.classList.contains('kg-poll-card-chart-legend')) {
                return {width: 260, height: legendHeight, top: 0, left: 0, right: 260, bottom: legendHeight};
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

    it('keeps smoothed trend data above zero without losing source buckets', async function () {
        const rates = [100, 0, 0, 100];
        const times = setTrendRates(rates);

        require(pollScriptPath);
        global.document.dispatchEvent(new global.window.Event('DOMContentLoaded'));
        await flushMicrotasks();

        const inverseRates = rates.map(function (rate) {
            return 100 - rate;
        });
        assertSeriesMatchesContract(0, times, rates);
        assertSeriesMatchesContract(1, times, inverseRates);

        const data = chartSeriesData[0];
        const plateauPoints = data.filter(function (point) {
            return point.time >= times[1] && point.time <= times[2];
        });
        assert.ok(plateauPoints.length > 0, `Expected lower plateau points between ${times[1]} and ${times[2]}`);
        assert.ok(plateauPoints.every(function (point) {
            return point.value === 0;
        }), `Expected lower plateau values to stay at 0; found ${plateauPoints.map(function (point) {
            return `${point.time}:${point.value}`;
        }).join(', ')}`);
    });

    it('keeps smoothed trend data below one hundred across a maximum plateau', async function () {
        const rates = [0, 100, 100, 0];
        const times = setTrendRates(rates);

        require(pollScriptPath);
        global.document.dispatchEvent(new global.window.Event('DOMContentLoaded'));
        await flushMicrotasks();

        const inverseRates = rates.map(function (rate) {
            return 100 - rate;
        });
        assertSeriesMatchesContract(0, times, rates);
        assertSeriesMatchesContract(1, times, inverseRates);

        const data = chartSeriesData[0];
        const plateauPoints = data.filter(function (point) {
            return point.time >= times[1] && point.time <= times[2];
        });
        assert.ok(plateauPoints.length > 0, `Expected upper plateau points between ${times[1]} and ${times[2]}`);
        assert.ok(plateauPoints.every(function (point) {
            return point.value === 100;
        }), `Expected upper plateau values to stay at 100; found ${plateauPoints.map(function (point) {
            return `${point.time}:${point.value}`;
        }).join(', ')}`);
    });

    it('preserves subsecond source times without duplicating chart timestamps', async function () {
        const rates = [25, 75];
        const points = [
            {
                time: '2026-06-10T22:30:00.100Z',
                options: [
                    {id: 'option_a', vote_rate: rates[0]},
                    {id: 'option_b', vote_rate: 100 - rates[0]}
                ]
            },
            {
                time: '2026-06-10T22:30:00.900Z',
                options: [
                    {id: 'option_a', vote_rate: rates[1]},
                    {id: 'option_b', vote_rate: 100 - rates[1]}
                ]
            }
        ];
        const times = setTrendPoints(points);

        require(pollScriptPath);
        global.document.dispatchEvent(new global.window.Event('DOMContentLoaded'));
        await flushMicrotasks();

        const inverseRates = rates.map(function (rate) {
            return 100 - rate;
        });
        [rates, inverseRates].forEach(function (seriesRates, seriesIndex) {
            const data = chartSeriesData[seriesIndex];

            assert.equal(chartSeriesOptions[seriesIndex].lineType, global.window.LightweightCharts.LineType.Simple);
            assert.deepEqual(data.map(function (point) {
                return point.time;
            }), times);
            assertSeriesPreservesSourcePoints(data, times, seriesRates);
            assertSeriesStaysWithinSegments(data, times, seriesRates);
        });

        const controller = global.document.querySelector('.kg-poll-card-chart').__kgChartController;
        assert.equal(controller.trendModel.buckets.length, rates.length);
        assert.deepEqual(controller.seriesRefs[0].values, rates);
    });

    it('rejects duplicate trend timestamps before creating line series', async function () {
        const duplicateTime = '2026-06-10T22:30:00.100Z';
        setTrendPoints([
            {
                time: duplicateTime,
                options: [
                    {id: 'option_a', vote_rate: 25},
                    {id: 'option_b', vote_rate: 75}
                ]
            },
            {
                time: duplicateTime,
                options: [
                    {id: 'option_a', vote_rate: 75},
                    {id: 'option_b', vote_rate: 25}
                ]
            }
        ]);

        require(pollScriptPath);
        global.document.dispatchEvent(new global.window.Event('DOMContentLoaded'));
        await flushMicrotasks();

        const chartElement = global.document.querySelector('.kg-poll-card-chart');
        assert.equal(chartSeriesOptions.length, 0, 'Expected duplicate trend timestamps to create no line series');
        assert.equal(chartSeriesData.length, 0, 'Expected duplicate trend timestamps to never reach setData');
        assert.equal(chartElement.hidden, true);
        assert.equal(chartElement.__kgChartController, undefined);
    });

    it('rejects out-of-order trend timestamps before creating line series', async function () {
        setTrendPoints([
            {
                time: '2026-06-10T22:30:01.000Z',
                options: [
                    {id: 'option_a', vote_rate: 25},
                    {id: 'option_b', vote_rate: 75}
                ]
            },
            {
                time: '2026-06-10T22:30:00.000Z',
                options: [
                    {id: 'option_a', vote_rate: 75},
                    {id: 'option_b', vote_rate: 25}
                ]
            }
        ]);

        require(pollScriptPath);
        global.document.dispatchEvent(new global.window.Event('DOMContentLoaded'));
        await flushMicrotasks();

        const chartElement = global.document.querySelector('.kg-poll-card-chart');
        assert.equal(chartSeriesOptions.length, 0, 'Expected out-of-order trend timestamps to create no line series');
        assert.equal(chartSeriesData.length, 0, 'Expected out-of-order trend timestamps to never reach setData');
        assert.equal(chartElement.hidden, true);
        assert.equal(chartElement.__kgChartController, undefined);
    });

    it('uses bounded Hermite samples instead of dense straight lines', async function () {
        const rates = [0, 80, 100];
        const times = setTrendRates(rates);

        require(pollScriptPath);
        global.document.dispatchEvent(new global.window.Event('DOMContentLoaded'));
        await flushMicrotasks();

        const inverseRates = rates.map(function (rate) {
            return 100 - rate;
        });
        assertSeriesMatchesContract(0, times, rates);
        assertSeriesMatchesContract(1, times, inverseRates);

        const midpointTime = (times[0] + times[1]) / 2;
        const midpoint = chartSeriesData[0].find(function (point) {
            return point.time === midpointTime;
        });

        assert.ok(midpoint, `Expected a Hermite sample at midpoint time=${midpointTime}`);
        assert.ok(Math.abs(midpoint.value - 43.75) < 0.001, `Expected midpoint near 43.75; found ${midpoint.value}`);
        assert.ok(Math.abs(midpoint.value - 40) > 1, `Expected midpoint to differ from linear value 40; found ${midpoint.value}`);

        const controller = global.document.querySelector('.kg-poll-card-chart').__kgChartController;
        assert.equal(controller.trendModel.buckets.length, rates.length);
        assert.deepEqual(controller.seriesRefs[0].values, rates);
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
        assert.ok(Number.parseInt(plot.style.height, 10) >= 60);
    });

    it('does not recompute the desktop trend plot height after initialization', async function () {
        optionsHeight = 120;
        legendHeight = 40;
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

        const optionsContainer = global.document.querySelector('.kg-poll-card-options');
        const plot = global.document.querySelector('.kg-poll-card-chart-plot');

        assert.equal(plot.style.height, '80px');

        optionsHeight = 220;

        resizeObserverInstances.forEach(function (observer) {
            if (observer.targets.indexOf(optionsContainer) !== -1) {
                observer.callback([{
                    target: optionsContainer,
                    contentRect: {width: 320, height: optionsHeight}
                }]);
            }
        });
        await flushMicrotasks();

        assert.equal(plot.style.height, '80px');
    });

    it('wraps hover rate labels into columns when one column exceeds the plot height', async function () {
        optionsHeight = 270;
        legendHeight = 70;

        const options = Array.from({length: 16}, function (_, index) {
            return {
                id: `option_${index}`,
                text: `Option ${index + 1}`
            };
        });
        const trendOptions = options.map(function (option, index) {
            return {
                id: option.id,
                vote_rate: index === 0 ? 100 : 0
            };
        });

        global.fetch = async function (url) {
            const requestUrl = new URL(url, 'https://example.com');
            const payloads = {
                '/members/api/polls/poll_123': {
                    poll_id: 'poll_123',
                    title: 'Many options',
                    published_at: '2026-06-01T00:00:00.000Z',
                    status: 'published',
                    options: options,
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
                    total_votes: 1,
                    options: options.map(function (option, index) {
                        return {
                            id: option.id,
                            text: option.text,
                            vote_count: index === 0 ? 1 : 0,
                            vote_rate: index === 0 ? 100 : 0
                        };
                    }),
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
                },
                '/members/api/polls/poll_123/trends': {
                    points: [
                        {time: '2026-06-10T23:30:00.000Z', options: trendOptions},
                        {time: '2026-06-11T00:00:00.000Z', options: trendOptions}
                    ]
                }
            };
            const payload = payloads[requestUrl.pathname];

            return {
                ok: Boolean(payload),
                status: payload ? 200 : 404,
                json: async function () {
                    return payload;
                }
            };
        };
        global.window.fetch = global.fetch;
        global.document.querySelector('.kg-poll-card').__kgPollTrends = {
            points: [
                {time: '2026-06-10T23:30:00.000Z', options: trendOptions},
                {time: '2026-06-11T00:00:00.000Z', options: trendOptions}
            ]
        };

        require(pollScriptPath);
        global.document.dispatchEvent(new global.window.Event('DOMContentLoaded'));
        await flushMicrotasks();

        const plot = global.document.querySelector('.kg-poll-card-chart-plot');
        assert.ok(plot, global.document.body.innerHTML);
        assert.equal(plot.style.height, '200px');

        plot.dispatchEvent(new global.window.MouseEvent('mousemove', {
            bubbles: true,
            clientX: 40,
            clientY: 100
        }));

        const labels = Array.from(global.document.querySelectorAll('.kg-poll-card-chart-rate-label'));
        assert.equal(labels.length, 16);
        assert.equal(labels.filter(function (label) {
            return label.hidden;
        }).length, 0);

        const columns = new Map();
        labels.forEach(function (label) {
            const left = Number.parseFloat(label.style.left);
            const top = Number.parseFloat(label.style.top);
            const column = columns.get(left) || [];

            column.push(top);
            columns.set(left, column);
        });

        assert.equal(columns.size, 2);
        columns.forEach(function (tops) {
            tops.sort(function (a, b) {
                return a - b;
            });
            tops.forEach(function (top) {
                assert.ok(top >= 10 && top <= 190);
            });
            for (let index = 1; index < tops.length; index += 1) {
                assert.ok(tops[index] - tops[index - 1] >= 18);
            }
        });
    });

    it('opens Portal signin when anonymous vote quota is exhausted', async function () {
        const signinTrigger = global.document.createElement('button');
        let signinClicks = 0;
        signinTrigger.setAttribute('data-portal', 'signin');
        signinTrigger.addEventListener('click', function () {
            signinClicks += 1;
        });
        global.document.body.appendChild(signinTrigger);

        global.fetch = async function (url, options = {}) {
            const requestUrl = new URL(url, 'https://example.com');
            const method = String(options.method || 'GET').toUpperCase();

            if (requestUrl.pathname === '/members/api/session/') {
                return {
                    ok: false,
                    status: 404,
                    text: async function () {
                        return '';
                    },
                    json: async function () {
                        return null;
                    }
                };
            }

            if (requestUrl.pathname === '/members/api/polls/poll_123/votes' && method === 'POST') {
                return {
                    ok: false,
                    status: 401,
                    json: async function () {
                        return {
                            ok: false,
                            error: {
                                code: 'LOGIN_REQUIRED',
                                message: 'daily anonymous vote used, please sign in'
                            }
                        };
                    }
                };
            }

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
                },
                '/members/api/polls/poll_123/trends': {
                    points: []
                }
            };
            const payload = payloads[requestUrl.pathname];

            return {
                ok: Boolean(payload),
                status: payload ? 200 : 404,
                json: async function () {
                    return payload;
                }
            };
        };
        global.window.fetch = global.fetch;

        require(pollScriptPath);
        global.document.dispatchEvent(new global.window.Event('DOMContentLoaded'));
        await flushMicrotasks();

        const firstOption = global.document.querySelector('.kg-poll-card-option');
        firstOption.click();
        await flushMicrotasks(10);
        await flushTimers();

        assert.equal(signinClicks, 1);
        assert.equal(global.document.querySelector('.kg-poll-card-feedback').hidden, true);
    });
});
