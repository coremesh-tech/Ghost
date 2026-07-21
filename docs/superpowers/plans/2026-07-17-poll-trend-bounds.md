# Poll Trend Bounds Implementation Plan

> **For AI agents:** Required sub-skill: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Track progress with the checkboxes below.

**Goal:** Keep poll trend lines smooth while guaranteeing that rendered percentage values never overshoot the `0–100` domain or their neighbouring source rates.

**Architecture:** Generate boundary-safe monotone cubic samples in the poll frontend before passing data to Lightweight Charts, then render those samples as a simple line. Keep the original prepared buckets and rates unchanged for hover coordinates, labels, dates, and active dots.

**Tech Stack:** Browser JavaScript, Lightweight Charts 4.2.0, Mocha, Node assert, JSDOM, pnpm.

---

## File Structure

- Modify `ghost/core/core/frontend/src/cards/js/poll.js`: add the pure bounded interpolation helper and use its output with `LineType.Simple`.
- Modify `ghost/core/test/unit/frontend/src/poll.test.js`: capture the chart options/data and add lower/upper boundary regression tests.
- Verify `docs/superpowers/specs/2026-07-17-poll-trend-bounds-design.md`: use the approved invariants as the acceptance checklist.

### Task 1: Capture the chart contract and add boundary regression coverage

**Files:**
- Modify: `ghost/core/test/unit/frontend/src/poll.test.js:4-215`
- Test: `ghost/core/test/unit/frontend/src/poll.test.js`

- [x] **Step 1: Extend the Lightweight Charts test double**

Add `chartSeriesOptions` and `chartSeriesData` arrays to the suite state, reset them in `beforeEach`, and make the existing test double record real inputs rather than asserting on the mock itself:

```js
let chartSeriesOptions;
let chartSeriesData;

// in beforeEach
chartSeriesOptions = [];
chartSeriesData = [];

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
```

- [x] **Step 2: Add helpers for deterministic trend rates and segment assertions**

```js
const setTrendRates = function (rates) {
    const start = Date.parse('2026-06-10T22:30:00.000Z');
    const times = rates.map(function (_, index) {
        return new Date(start + (index * 30 * 60 * 1000)).toISOString();
    });

    global.document.querySelector('.kg-poll-card').__kgPollTrends = {
        points: rates.map(function (rate, index) {
            return {
                time: times[index],
                options: [
                    {id: 'option_a', vote_rate: rate},
                    {id: 'option_b', vote_rate: 100 - rate}
                ]
            };
        })
    };

    return times.map(function (time) {
        return Date.parse(time) / 1000;
    });
};

const assertSeriesStaysWithinSegments = function (data, times, rates) {
    data.forEach(function (point) {
        assert.ok(point.value >= 0 && point.value <= 100);
        let segmentIndex = rates.length - 2;
        for (let index = 0; index < times.length - 1; index += 1) {
            if (point.time >= times[index] && point.time <= times[index + 1]) {
                segmentIndex = index;
                break;
            }
        }
        const segmentMin = Math.min(rates[segmentIndex], rates[segmentIndex + 1]);
        const segmentMax = Math.max(rates[segmentIndex], rates[segmentIndex + 1]);
        assert.ok(point.value >= segmentMin && point.value <= segmentMax);
    });
};
```

- [x] **Step 3: Add the lower-bound test**

```js
it('keeps smoothed trend data above zero without losing source buckets', async function () {
    const rates = [100, 0, 0, 100];
    const times = setTrendRates(rates);

    require(pollScriptPath);
    global.document.dispatchEvent(new global.window.Event('DOMContentLoaded'));
    await flushMicrotasks();

    const data = chartSeriesData[0];
    assert.equal(chartSeriesOptions[0].lineType, global.window.LightweightCharts.LineType.Simple);
    assert.ok(data.length > rates.length);
    times.forEach(function (time, index) {
        assert.equal(data.find(function (point) {
            return point.time === time;
        }).value, rates[index]);
    });
    assertSeriesStaysWithinSegments(data, times, rates);
    assert.ok(data.filter(function (point) {
        return point.time >= times[1] && point.time <= times[2];
    }).every(function (point) {
        return point.value === 0;
    }));
});
```

- [x] **Step 4: Add the upper-bound test**

```js
it('keeps smoothed trend data below one hundred across a maximum plateau', async function () {
    const rates = [0, 100, 100, 0];
    const times = setTrendRates(rates);

    require(pollScriptPath);
    global.document.dispatchEvent(new global.window.Event('DOMContentLoaded'));
    await flushMicrotasks();

    const data = chartSeriesData[0];
    assert.equal(chartSeriesOptions[0].lineType, global.window.LightweightCharts.LineType.Simple);
    assert.ok(data.length > rates.length);
    assertSeriesStaysWithinSegments(data, times, rates);
    assert.ok(data.filter(function (point) {
        return point.time >= times[1] && point.time <= times[2];
    }).every(function (point) {
        return point.value === 100;
    }));
});
```

- [x] **Step 5: Run the focused test and verify RED**

Run:

```bash
cd ghost/core
pnpm test:single test/unit/frontend/src/poll.test.js
```

Historical RED: `4 passing / 2 failing`; both new tests failed because production selected `LineType.Curved` and passed only the four source points.

### Task 2: Implement bounded monotone curve data

**Files:**
- Modify: `ghost/core/core/frontend/src/cards/js/poll.js:18-19,372-434,771-839`
- Test: `ghost/core/test/unit/frontend/src/poll.test.js`

- [x] **Step 1: Add the interpolation density and pure helper**

Add `TREND_CURVE_SAMPLES_PER_SEGMENT = 8`. Implement `buildBoundedTrendData(buckets, rates)` beside `prepareTrendModelForChart`:

```js
const buildBoundedTrendData = function (buckets, rates) {
    const points = buckets.map(function (bucket, index) {
        return {
            time: bucket.chartTime,
            value: clampNumber(rates[index], CHART_RATE_MIN, CHART_RATE_MAX)
        };
    });

    if (points.length < 3) {
        return points;
    }

    const slopes = [];
    for (let index = 0; index < points.length - 1; index += 1) {
        const duration = points[index + 1].time - points[index].time;
        if (duration <= 0) {
            return points;
        }
        slopes.push((points[index + 1].value - points[index].value) / duration);
    }

    const tangents = new Array(points.length).fill(0);
    tangents[0] = slopes[0];
    tangents[tangents.length - 1] = slopes[slopes.length - 1];

    for (let index = 1; index < tangents.length - 1; index += 1) {
        tangents[index] = slopes[index - 1] * slopes[index] <= 0
            ? 0
            : (slopes[index - 1] + slopes[index]) / 2;
    }

    slopes.forEach(function (slope, index) {
        if (slope === 0) {
            tangents[index] = 0;
            tangents[index + 1] = 0;
            return;
        }

        const startRatio = tangents[index] / slope;
        const endRatio = tangents[index + 1] / slope;
        const magnitude = Math.hypot(startRatio, endRatio);
        if (magnitude > 3) {
            const scale = 3 / magnitude;
            tangents[index] = scale * startRatio * slope;
            tangents[index + 1] = scale * endRatio * slope;
        }
    });

    const data = [];
    for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        const duration = end.time - start.time;
        const sampleCount = TREND_CURVE_SAMPLES_PER_SEGMENT;
        const segmentMin = Math.max(Math.min(start.value, end.value), CHART_RATE_MIN);
        const segmentMax = Math.min(Math.max(start.value, end.value), CHART_RATE_MAX);

        for (let sample = 0; sample < sampleCount; sample += 1) {
            const position = sample / sampleCount;
            const positionSquared = position * position;
            const positionCubed = positionSquared * position;
            const value = ((2 * positionCubed - 3 * positionSquared + 1) * start.value)
                + ((positionCubed - 2 * positionSquared + position) * duration * tangents[index])
                + ((-2 * positionCubed + 3 * positionSquared) * end.value)
                + ((positionCubed - positionSquared) * duration * tangents[index + 1]);

            data.push({
                time: start.time + (duration * position),
                value: clampNumber(value, segmentMin, segmentMax)
            });
        }
    }

    data.push(points[points.length - 1]);
    return data;
};
```

- [x] **Step 2: Render the generated data as a simple line**

```js
const lineType = chartLibrary.LineType && typeof chartLibrary.LineType.Simple === 'number'
    ? chartLibrary.LineType.Simple
    : 0;

lineSeries.setData(buildBoundedTrendData(
    preparedTrendModel.buckets,
    preparedTrendModel.series[index].rates
));
```

- [x] **Step 3: Run the focused test and verify GREEN**

Run:

```bash
cd ghost/core
pnpm test:single test/unit/frontend/src/poll.test.js
```

Expected at this historical step: `6 passing` and zero failures. After the completed review follow-ups below, the final focused GREEN is `13 passing` and zero failures.

#### Review follow-ups (completed)

- [x] **Subsecond timestamp TDD:** Preserve subsecond chart times with `chartTime = ms / 1000`, and reject exact duplicate or out-of-order timestamps before series creation. The focused suite moved from RED (`7 passing / 3 failing`) to GREEN (`10 passing`).
- [x] **Rapid smoothing TDD:** Use exactly eight samples for every positive-duration segment and retain fractional sample times rather than rounding. The focused suite moved from RED (`10 passing / 2 failing`) to GREEN (`12 passing`).
- [x] **Full-source timestamp validation TDD:** Final branch review found that validation after sampling could miss an invalid raw point. The regression uses 13 raw points whose non-increasing index 6 is skipped by 12-bucket sampling, moving the suite to RED (`12 passing / 1 failing`). The fix validates every raw timestamp as finite and the complete raw sequence as strictly increasing before sampling, while `prepareTrendModelForChart` retains its defensive downstream check; the suite returned to GREEN (`13 passing`).
- [x] **Coverage:** Verify the Hermite midpoint is approximately `43.75`, controller hover state remains isolated from interpolated data, same-second subsecond buckets stay distinct, invalid timestamp ordering is rejected across the complete raw sequence before sampling with prepared-model validation retained as defense, rapid three-point trends emit 17 samples, and non-integer midpoint times remain aligned.

### Task 3: Verify the complete change

**Files:**
- Verify: `ghost/core/core/frontend/src/cards/js/poll.js`
- Verify: `ghost/core/test/unit/frontend/src/poll.test.js`
- Verify: `docs/superpowers/specs/2026-07-17-poll-trend-bounds-design.md`

- [x] **Step 1: Run focused unit coverage**

```bash
cd ghost/core
pnpm test:single test/unit/frontend/src/poll.test.js
```

Observed: `13 passing` and zero failures.

- [x] **Step 2: Run the available lint gates**

```bash
cd ghost/core
pnpm exec eslint -c test/.eslintrc.js --ignore-path test/.eslintignore test/unit/frontend/src/poll.test.js
pnpm lint:frontend
```

The test file receives direct ESLint coverage from the first command. `pnpm lint:frontend` checks only frontend paths that are not excluded by `.eslintignore`; `core/frontend/src/cards/js/poll.js` matches the explicit `core/frontend/src/**/*.js` ignore rule and therefore does not receive direct ESLint coverage. Verification evidence for `poll.js` comes from the focused poll tests and `pnpm build:assets:js`. Observed: both lint commands exited 0, and ESLint reported zero errors and zero warnings. `pnpm lint:frontend` still printed the known Node engine warning because its runtime reported `v24.14.0` while the project requires `^22.13.1`; that environment warning is recorded separately from the lint result.

- [x] **Step 3: Build frontend JavaScript assets**

```bash
cd ghost/core
pnpm build:assets:js
```

Observed: exit 0. The build reported `tsconfig.json` duplicate `esModuleInterop` key warnings that are unrelated to this diff, and `git status --short` plus `git diff --stat` remained empty afterward with no tracked generated changes.

- [x] **Step 4: Review invariants and repository diff**

```bash
git diff --check origin/master...HEAD
git diff --stat origin/master...HEAD
git diff --name-only origin/master...HEAD
git status --short
```

Observed: no whitespace errors; the focused suite reported `13 passing`; and the range contained exactly four files: the plan, design spec, `poll.js`, and `poll.test.js`.

- [x] **Step 5: Commit the verified implementation**

```bash
git add docs/superpowers/plans/2026-07-17-poll-trend-bounds.md \
    ghost/core/core/frontend/src/cards/js/poll.js \
    ghost/core/test/unit/frontend/src/poll.test.js
git commit -m "🐛 Fixed poll trend lines crossing percentage bounds" \
    -m $'no ref\n\n- curved chart-library control points could draw valid poll rates below zero or above one hundred\n- bounded monotone samples keep the smooth shape without changing hover data or vendor code'
```

Observed: the commit hook succeeded, and no push was performed.
