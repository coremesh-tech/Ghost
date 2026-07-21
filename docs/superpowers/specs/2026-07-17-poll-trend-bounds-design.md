# Poll Trend Bounds Design

## Problem

Poll vote rates are percentages and are normalized to the inclusive `0–100` range before chart rendering. The current trend chart passes those points to Lightweight Charts 4.2.0 with `LineType.Curved`. That renderer converts Catmull–Rom segments into Bézier curves whose control points are not constrained by the source values. Sequences such as `100 → 0 → 0` can therefore draw below the zero baseline even though every poll rate is valid.

This is a rendering defect, not negative poll data. The chart's fixed `0–100` price range and bottom scale margin make the overshoot visible.

## Goals

- Keep the trend line visually smooth.
- Guarantee every rendered value remains within `0–100`.
- Guarantee each rendered segment remains between its two neighbouring source rates, preventing local overshoot at both 0 and 100.
- Keep original buckets and rates as the source of truth for hover selection, labels, dates, and active dots.
- Preserve existing desktop/mobile chart sizing and crowded-label behaviour.

## Non-goals

- No API, database, vote calculation, or trend-cache changes.
- No changes to the vendored Lightweight Charts bundle.
- No CSS masking or removal of the bottom scale margin.
- No redesign of the legend, hover labels, or chart palette.

## Considered Approaches

### 1. Boundary-safe monotone interpolation (selected)

Generate a small set of intermediate points for each original bucket interval with monotone cubic Hermite interpolation. Render the generated values with `LineType.Simple`. Limit tangents at plateaus and turning points, and clamp every generated value to both the adjacent endpoint range and `0–100`.

This preserves a smooth shape, keeps `0 → 0` and `100 → 100` flat, and provides an explicit data-level invariant that is independent of a chart library's curve implementation.

### 2. Straight source-point segments

Switch the existing source points to `LineType.Simple` without interpolation. This guarantees bounds with the smallest change, but loses the smooth appearance requested for the trend chart.

### 3. Visual clipping or zero bottom margin

Hide the overshoot with CSS or move the zero line to the edge. This treats the symptom, can clip endpoint strokes and halos, and leaves the renderer producing invalid geometry.

## Design

Add a pure chart-data helper next to `prepareTrendModelForChart` in `poll.js`. It accepts prepared buckets and one rate series, calculates monotone tangents across the original time/value pairs, and emits a fixed number of samples per interval plus the final source point.

For each interval:

1. Calculate its secant slope from timestamp and rate differences.
2. Set tangents to zero where slopes change sign or either adjacent segment is flat.
3. Apply the monotonicity limiter so endpoint tangents cannot introduce an extremum inside the interval.
4. Evaluate cubic Hermite samples at evenly spaced positions.
5. Clamp each sample to `min(startRate, endRate) … max(startRate, endRate)` and `0 … 100`.

The chart series will use `LineType.Simple` to connect these already-smoothed points. Original `preparedTrendModel.buckets` and `series.rates` remain unchanged in the chart controller, so bucket coordinates, hover snapping, labels, and active dots continue to reflect real poll observations rather than interpolated values.

If there is only one valid bucket, the helper returns that source point. Prepared bucket timestamps are already validated before interpolation; no fallback path or vendor modification is needed.

## Tests

Extend the existing Lightweight Charts test double so it records line options and `setData` payloads. Add focused regression coverage for:

- `100 → 0 → 0 → 100`: rendered values never drop below 0, flat zero intervals remain flat, and each segment stays within its endpoint values.
- `0 → 100 → 100 → 0`: rendered values never exceed 100, flat maximum intervals remain flat, and each segment stays within its endpoint values.
- The line uses `LineType.Simple`, contains additional samples, and still includes every original bucket timestamp/value pair.

Run the focused poll unit test, frontend/test lint for the two touched JavaScript files, and the relevant frontend asset build. Record the existing Node 24 versus declared Node 22 engine warning separately from test outcomes.
