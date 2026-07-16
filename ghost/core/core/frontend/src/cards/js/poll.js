(function () {
    const numberFormatter = new Intl.NumberFormat('en-US');
    const POLL_GUEST_ID_STORAGE_KEY = 'pm_guest_id';
    const MOBILE_CHART_PLOT_HEIGHT = 120;
    const DESKTOP_CHART_PLOT_MIN_HEIGHT = 70;
    const DESKTOP_TREND_CHART_BREAKPOINT = 768;
    const MONTH_NAMES = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // 与 Koenig 编辑器 PollTrendChart 保持一致的固定调色板
    const TREND_PALETTE = [
        '#FF5FD2', '#4CE063', '#F2BE00', '#5BC8FF', '#C084FC',
        '#FF8C42', '#FF5C5C', '#2DD4BF', '#4F8AFF', '#A3E635'
    ];

    const TREND_BUCKET_COUNT = 12;
    const TREND_POINTS_CACHE_LIMIT = 720;
    const TREND_RATE_LABEL_COLUMN_GAP = 72;
    const TREND_RATE_LABEL_WIDTH = 64;
    const TREND_RATE_LABEL_X_OFFSET = 12;

    const clampNumber = function (value, min, max) {
        return Math.min(Math.max(value, min), max);
    };

    const buildOptionProgressWidth = function (value) {
        const percent = Math.max(0, Math.min(Number(value || 0), 100));

        if (percent <= 0) {
            return '0px';
        }

        if (percent >= 100) {
            return '100% ';
        }

        return `calc(${percent}% - ${(36 * percent / 100).toFixed(2)}px)`;
    };

    const resolveLabelLayout = function (items, opts) {
        if (items.length === 0) {
            return new Map();
        }
        const sorted = items.slice().sort(function (a, b) {
            return a.y - b.y;
        });
        const columnCapacity = Math.max(Math.floor((opts.maxY - opts.minY) / opts.minGap) + 1, 1);
        const adjusted = new Map();

        for (let column = 0; column * columnCapacity < sorted.length; column += 1) {
            const columnItems = sorted.slice(column * columnCapacity, (column + 1) * columnCapacity);
            let prevY = -Infinity;

            columnItems.forEach(function (item) {
                const y = Math.max(item.y, prevY + opts.minGap);
                adjusted.set(item.seriesIndex, {column: column, y: y});
                prevY = y;
            });

            let nextY = Infinity;
            for (let index = columnItems.length - 1; index >= 0; index -= 1) {
                const item = columnItems[index];
                const current = adjusted.get(item.seriesIndex);
                const y = clampNumber(Math.min(current.y, nextY - opts.minGap), opts.minY, opts.maxY);
                adjusted.set(item.seriesIndex, {column: column, y: y});
                nextY = y;
            }
        }

        return adjusted;
    };

    const resolveLabelColumns = function (columnCount, activeX, width) {
        const edgePadding = 4;
        const rightSpace = width - edgePadding - activeX - TREND_RATE_LABEL_X_OFFSET;
        const leftSpace = activeX - edgePadding - TREND_RATE_LABEL_X_OFFSET;
        const getCapacity = function (space) {
            if (space < TREND_RATE_LABEL_WIDTH) {
                return 0;
            }

            return Math.floor((space - TREND_RATE_LABEL_WIDTH) / TREND_RATE_LABEL_COLUMN_GAP) + 1;
        };
        const rightCapacity = getCapacity(rightSpace);
        const leftCapacity = getCapacity(leftSpace);
        let rightCount = Math.min(columnCount, rightCapacity);
        let leftCount = columnCount - rightCount;

        if (leftCount > leftCapacity) {
            leftCount = Math.min(columnCount, leftCapacity);
            rightCount = columnCount - leftCount;
        }

        const columns = [];
        for (let index = 0; index < rightCount; index += 1) {
            columns.push({
                align: 'right',
                x: clampNumber(
                    activeX + TREND_RATE_LABEL_X_OFFSET + (index * TREND_RATE_LABEL_COLUMN_GAP),
                    edgePadding,
                    Math.max(width - edgePadding, edgePadding)
                )
            });
        }
        for (let index = 0; index < leftCount; index += 1) {
            columns.push({
                align: 'left',
                x: clampNumber(
                    activeX - TREND_RATE_LABEL_X_OFFSET - (index * TREND_RATE_LABEL_COLUMN_GAP),
                    edgePadding,
                    Math.max(width - edgePadding, edgePadding)
                )
            });
        }

        return columns;
    };

    const formatBucketLabel = function (date) {
        return `${date.getMonth() + 1}.${date.getDate()}`;
    };

    const formatBucketDetail = function (date) {
        // 顶部 hover 时间和底部 bucket 刻度共用一个时间语境:
        // 底部 formatBucketLabel 输出 "月.日", 这里加上 "时:分 AM/PM",
        // 用户横向 hover 时既能看到自己在哪一天 (跟底部刻度对得上), 又能精确到分钟.
        const rawHours = date.getHours();
        const hours = rawHours.toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const ampm = rawHours < 12 ? 'AM' : 'PM';
        return `${hours}:${minutes}:${seconds} ${ampm}`;
    };

    /**
     * trends 接口会根据 from/to 的跨度自动选择分辨率.
     * 前端优先传 poll 完整生命周期, 让后端自己决定 raw / 1m / 1h / 1d:
     *   - from 优先 publishedAt, 再退化到 createdAt
     *   - to 用现在, 若 poll 已结束则用 expiresAt
     *   - 如果开始时间缺失, 再退化到最近 24 小时
     */
    const DEFAULT_TRENDS_WINDOW_HOURS = 24;

    const resolveTrendWindowBoundary = function (value) {
        const ms = value ? new Date(value).getTime() : NaN;
        return Number.isFinite(ms) ? ms : null;
    };

    const buildTrendsQueryWindow = function (poll, windowHours) {
        const hours = Number(windowHours) > 0 ? Number(windowHours) : DEFAULT_TRENDS_WINDOW_HOURS;
        const nowMs = Date.now();
        const expiresMs = resolveTrendWindowBoundary(poll && poll.expiresAt);
        const publishedMs = resolveTrendWindowBoundary(poll && poll.publishedAt);
        const createdMs = resolveTrendWindowBoundary(poll && poll.createdAt);
        const toMs = expiresMs && expiresMs <= nowMs ? expiresMs : nowMs;
        const fallbackFromMs = toMs - hours * 60 * 60 * 1000;
        const candidateFromMs = publishedMs || createdMs || fallbackFromMs;
        const fromMs = Math.min(candidateFromMs, toMs);

        return {
            from: new Date(fromMs).toISOString(),
            to: new Date(toMs).toISOString()
        };
    };

    const buildTrendsUrl = function (pollId, poll) {
        const window = buildTrendsQueryWindow(poll);
        const params = new URLSearchParams();
        params.set('from', window.from);
        params.set('to', window.to);
        return `/members/api/polls/${encodeURIComponent(pollId)}/trends?${params.toString()}`;
    };

    const resolvePredictionMarketsApiUrl = function (card) {
        const value = card && card.dataset
            ? card.dataset.predictionMarketsApiUrl
            : '';

        return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
    };

    const buildPollStreamCandidates = function (card) {
        const candidates = [];
        const predictionMarketsApiUrl = resolvePredictionMarketsApiUrl(card);
        const pushCandidate = function (value) {
            if (typeof value !== 'string') {
                return;
            }

            const trimmed = value.trim().replace(/\/+$/, '');
            if (!trimmed || candidates.indexOf(trimmed) !== -1) {
                return;
            }

            candidates.push(trimmed);
        };

        if (predictionMarketsApiUrl) {
            pushCandidate(`${predictionMarketsApiUrl}/market-topic`);
        }

        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            pushCandidate('http://localhost:3000/market-topic');
            pushCandidate('http://127.0.0.1:3000/market-topic');
        }

        return candidates;
    };

    const buildPollStreamUrl = function (baseUrl, pollId) {
        return `${baseUrl}/polls/${encodeURIComponent(pollId)}/stream`;
    };

    // 把外部 /admin/polls/:id/trends 接口返回的 points 序列, 均匀采样到 N 个 bucket
    const sampleEvenly = function (items, targetCount) {
        if (!Array.isArray(items) || items.length === 0) {
            return [];
        }
        if (items.length <= targetCount) {
            return items.slice();
        }
        const step = (items.length - 1) / (targetCount - 1);
        const out = [];
        for (let i = 0; i < targetCount; i += 1) {
            out.push(items[Math.round(i * step)]);
        }
        return out;
    };

    /**
     * 把 trends 接口的响应映射成图表用的 trendModel.
     * 与 Koenig 编辑器的 mapTrendsResponseToModel 保持同一份语义:
     *   - 用 series 颜色锁定 TREND_PALETTE 顺序 (与编辑器视觉对齐)
     *   - 末端 bucket 作为默认激活点
     * 数据不足时返回 null, 让调用方回退到 snapshot.
     */
    const buildRealTrendModel = function (response, options, targetBuckets) {
        const bucketCount = targetBuckets || TREND_BUCKET_COUNT;
        const points = response && Array.isArray(response.points) ? response.points : [];
        if (points.length === 0 || !Array.isArray(options) || options.length === 0) {
            return null;
        }

        const sampled = sampleEvenly(points, bucketCount);

        const buckets = sampled.map(function (point) {
            const date = new Date(point.time);
            return {
                key: point.time,
                label: formatBucketLabel(date),
                detail: formatBucketDetail(date),
                isFuture: false
            };
        });

        const series = options.map(function (option, index) {
            const color = TREND_PALETTE[index % TREND_PALETTE.length];
            const rates = sampled.map(function (point) {
                const matched = point.options && point.options.find(function (entry) {
                    return entry.id === option.id;
                });
                return Number((matched && (matched.vote_rate ?? matched.voteRate)) || 0);
            });
            return {
                optionId: option.id,
                text: option.text || '',
                color: color,
                rates: rates
            };
        });

        return {
            buckets: buckets,
            series: series,
            activeIndex: buckets.length - 1
        };
    };

    const normalizeTrendPoint = function (point) {
        if (!point || !point.time) {
            return null;
        }

        return {
            poll_id: point.poll_id || point.pollId || '',
            time: point.time,
            total_votes: Number(point.total_votes ?? point.totalVotes ?? 0),
            options: Array.isArray(point.options) ? point.options.map(function (option, index) {
                return {
                    id: String(option.id || option.option_id || `opt_${index}`),
                    vote_count: Number(option.vote_count ?? option.voteCount ?? 0),
                    vote_rate: Number(option.vote_rate ?? option.voteRate ?? 0)
                };
            }) : []
        };
    };

    const normalizeTrendsPayload = function (payload) {
        const rawPoints = Array.isArray(payload)
            ? payload
            : payload && Array.isArray(payload.points)
                ? payload.points
                : [];
        const points = rawPoints.map(normalizeTrendPoint).filter(Boolean);

        return {
            points: points
        };
    };

    const mergeTrendsPayloads = function (basePayload, incomingPayload) {
        const base = normalizeTrendsPayload(basePayload || {});
        const incoming = normalizeTrendsPayload(incomingPayload || {});

        if (!incoming.points.length) {
            return base.points.length ? base : null;
        }

        const mergedByTime = new Map();

        base.points.forEach(function (point) {
            mergedByTime.set(point.time, point);
        });

        incoming.points.forEach(function (point) {
            mergedByTime.set(point.time, point);
        });

        const points = Array.from(mergedByTime.values()).sort(function (left, right) {
            return new Date(left.time).getTime() - new Date(right.time).getTime();
        });

        return {
            points: points.slice(-TREND_POINTS_CACHE_LIMIT)
        };
    };

    const appendTrendPoint = function (trendsPayload, trendPoint) {
        const normalizedPoint = normalizeTrendPoint(trendPoint);

        if (!normalizedPoint) {
            return trendsPayload || null;
        }

        const nextPayload = normalizeTrendsPayload(trendsPayload || {});
        const existingIndex = nextPayload.points.findIndex(function (point) {
            return point.time === normalizedPoint.time;
        });

        if (existingIndex >= 0) {
            nextPayload.points[existingIndex] = normalizedPoint;
        } else {
            nextPayload.points.push(normalizedPoint);
            nextPayload.points.sort(function (left, right) {
                return new Date(left.time).getTime() - new Date(right.time).getTime();
            });
        }

        if (nextPayload.points.length > TREND_POINTS_CACHE_LIMIT) {
            nextPayload.points = nextPayload.points.slice(-TREND_POINTS_CACHE_LIMIT);
        }

        return nextPayload;
    };

    const getChartLibrary = function () {
        return window.LightweightCharts || null;
    };

    const CHART_RATE_MIN = 0;
    const CHART_RATE_MAX = 100;
    const SCALE_MARGIN_TOP = 0.08;
    const SCALE_MARGIN_BOTTOM = 0.1;

    const toChartTimestamp = function (value) {
        const ms = new Date(value).getTime();
        if (!Number.isFinite(ms)) {
            return null;
        }

        return {
            seconds: Math.floor(ms / 1000),
            milliseconds: ms
        };
    };

    const prepareTrendModelForChart = function (trendModel) {
        if (!trendModel || !Array.isArray(trendModel.buckets) || !Array.isArray(trendModel.series) || trendModel.series.length === 0) {
            return null;
        }

        const buckets = trendModel.buckets.map(function (bucket) {
            const timestamp = toChartTimestamp(bucket.key);

            return {
                ...bucket,
                chartTime: timestamp ? timestamp.seconds : null,
                chartMs: timestamp ? timestamp.milliseconds : null
            };
        });

        if (buckets.length === 0 || buckets.some(function (bucket) {
            return bucket.chartTime === null;
        })) {
            return null;
        }

        const series = trendModel.series.map(function (item) {
            return {
                ...item,
                rates: Array.isArray(item.rates) ? item.rates.map(function (rate) {
                    return clampNumber(Number(rate || 0), 0, 100);
                }) : []
            };
        }).filter(function (item) {
            return item.rates.length === buckets.length;
        });

        if (series.length === 0) {
            return null;
        }

        return {
            buckets: buckets,
            series: series,
            activeIndex: clampNumber(
                trendModel.activeIndex == null ? buckets.length - 1 : trendModel.activeIndex,
                0,
                Math.max(buckets.length - 1, 0)
            )
        };
    };

    const measureChartSurface = function (surfaceElement) {
        const rect = surfaceElement.getBoundingClientRect();

        return {
            width: Math.max(Math.round(rect.width), 1),
            height: Math.max(Math.round(rect.height), 1)
        };
    };

    const formatHoverDateTime = function (date) {
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');

        return `${month}.${day} ${hours}:${minutes}`;
    };

    const resolveRateY = function (rate, height) {
        const clampedRate = clampNumber(Number(rate || 0), CHART_RATE_MIN, CHART_RATE_MAX);
        const plotTop = height * SCALE_MARGIN_TOP;
        const plotBottom = height * SCALE_MARGIN_BOTTOM;
        const plotHeight = Math.max(height - plotTop - plotBottom, 1);
        const normalizedRate = (clampedRate - CHART_RATE_MIN) / (CHART_RATE_MAX - CHART_RATE_MIN);

        return clampNumber(plotTop + ((1 - normalizedRate) * plotHeight), 0, height);
    };

    const buildChartLegend = function (trendModel) {
        const legend = document.createElement('div');
        legend.className = 'kg-poll-card-chart-legend';

        trendModel.series.forEach(function (series) {
            const item = document.createElement('div');
            item.className = 'kg-poll-card-chart-legend-item';

            const dot = document.createElement('span');
            dot.className = 'kg-poll-card-chart-legend-dot';
            dot.setAttribute('aria-hidden', 'true');
            dot.style.backgroundColor = series.color;

            const text = document.createElement('span');
            text.className = 'kg-poll-card-chart-legend-text';
            text.textContent = series.text || '';

            item.appendChild(dot);
            item.appendChild(text);
            legend.appendChild(item);
        });

        return legend;
    };

    const destroyTrendChart = function (chartElement) {
        const controller = chartElement && chartElement.__kgChartController;

        if (!controller) {
            if (chartElement) {
                chartElement.replaceChildren();
            }
            return;
        }

        if (controller.resizeObserver) {
            controller.resizeObserver.disconnect();
        }

        if (controller.rafResize) {
            cancelAnimationFrame(controller.rafResize);
        }

        if (controller.rafReveal) {
            cancelAnimationFrame(controller.rafReveal);
        }

        if (controller.plotWrap) {
            controller.plotWrap.removeEventListener('mousemove', controller.handlePointerMove);
            controller.plotWrap.removeEventListener('mouseleave', controller.handlePointerLeave);
        }

        if (controller.chart && controller.handleCrosshairMove) {
            controller.chart.unsubscribeCrosshairMove(controller.handleCrosshairMove);
        }

        if (controller.chart && typeof controller.chart.remove === 'function') {
            controller.chart.remove();
        }

        chartElement.__kgChartController = null;
        chartElement.replaceChildren();
    };

    const getBucketCoordinates = function (controller) {
        const width = controller.surfaceSize.width;
        const buckets = controller.trendModel.buckets;
        const count = buckets.length;

        return buckets.map(function (bucket, index) {
            const coordinate = controller.chart.timeScale().timeToCoordinate(bucket.chartTime);

            if (typeof coordinate === 'number' && Number.isFinite(coordinate)) {
                return clampNumber(coordinate, 0, width);
            }

            if (count <= 1) {
                return width / 2;
            }

            return (width * index) / (count - 1);
        });
    };

    const resolveNearestBucketIndex = function (bucketXs, x) {
        if (bucketXs.length <= 1) {
            return 0;
        }

        let nearestIndex = 0;
        let nearestDistance = Infinity;

        bucketXs.forEach(function (bucketX, index) {
            const distance = Math.abs(bucketX - x);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        });

        return nearestIndex;
    };

    const resizeTrendChart = function (controller) {
        const surfaceSize = measureChartSurface(controller.surfaceElement);

        controller.surfaceSize = surfaceSize;
        controller.chart.applyOptions({
            width: surfaceSize.width,
            height: surfaceSize.height
        });
        controller.chart.timeScale().fitContent();

        if (controller.hoverX !== null) {
            controller.hoverX = clampNumber(controller.hoverX, 0, surfaceSize.width);
        }

        updateTrendChartOverlay(controller);
    };

    const updateTrendChartOverlay = function (controller) {
        if (!controller || !controller.surfaceSize) {
            return;
        }

        const width = controller.surfaceSize.width;
        const height = controller.surfaceSize.height;

        if (width <= 0 || height <= 0) {
            controller.crosshairElement.hidden = true;
            controller.detailLabelElement.hidden = true;
            controller.seriesRefs.forEach(function (seriesRef) {
                seriesRef.dotElement.hidden = true;
                seriesRef.labelElement.hidden = true;
            });
            return;
        }

        const bucketXs = getBucketCoordinates(controller);

        if (bucketXs.length === 0) {
            controller.crosshairElement.hidden = true;
            controller.detailLabelElement.hidden = true;
            controller.seriesRefs.forEach(function (seriesRef) {
                seriesRef.dotElement.hidden = true;
                seriesRef.labelElement.hidden = true;
            });
            return;
        }

        const isHovering = controller.hoverX !== null;
        const defaultX = bucketXs[controller.trendModel.activeIndex] ?? bucketXs[bucketXs.length - 1] ?? 0;
        const hoveredX = isHovering
            ? clampNumber(controller.hoverX, bucketXs[0], bucketXs[bucketXs.length - 1])
            : defaultX;
        const activeBucketIndex = isHovering
            ? resolveNearestBucketIndex(bucketXs, hoveredX)
            : controller.trendModel.activeIndex;
        const activeX = bucketXs[activeBucketIndex] ?? hoveredX;
        const activeBucket = controller.trendModel.buckets[activeBucketIndex];
        const detailText = activeBucket && Number.isFinite(activeBucket.chartMs)
            ? formatHoverDateTime(new Date(activeBucket.chartMs))
            : '';

        const labelMinY = 10;
        const labelMaxY = Math.max(labelMinY, height - 10);

        const activePositions = controller.seriesRefs.map(function (seriesRef, seriesIndex) {
            const value = Number(seriesRef.values[activeBucketIndex] || 0);
            const y = resolveRateY(value, height);

            return {
                seriesIndex: seriesIndex,
                x: activeX,
                y: y,
                value: value,
                color: seriesRef.color
            };
        });

        const crosshairTop = Math.round(Math.max(0, Math.min.apply(null, activePositions.map(function (position) {
            return position.y;
        }))));
        const crosshairBottom = Math.round(Math.min(height, Math.max.apply(null, activePositions.map(function (position) {
            return position.y;
        }))));

        controller.crosshairElement.hidden = !isHovering;
        controller.crosshairElement.style.left = `${activeX}px`;
        controller.crosshairElement.style.top = `${crosshairTop}px`;
        controller.crosshairElement.style.bottom = `${Math.max(height - crosshairBottom, 0)}px`;
        controller.detailLabelElement.hidden = !isHovering || !detailText;
        controller.detailLabelElement.style.left = `${Math.round(clampNumber(activeX, 56, Math.max(width - 56, 56)))}px`;
        controller.detailLabelElement.style.top = `${Math.round(Math.max(crosshairTop - 8, 0))}px`;
        controller.detailLabelElement.textContent = detailText;

        const labelLayout = resolveLabelLayout(activePositions.map(function (position) {
            return {
                seriesIndex: position.seriesIndex,
                y: clampNumber(position.y, labelMinY, labelMaxY)
            };
        }), {
            minGap: 18,
            minY: labelMinY,
            maxY: labelMaxY
        });
        const labelColumnCount = Array.from(labelLayout.values()).reduce(function (count, placement) {
            return Math.max(count, placement.column + 1);
        }, 1);
        const labelColumns = resolveLabelColumns(labelColumnCount, activeX, width);

        activePositions.forEach(function (position, index) {
            const ref = controller.seriesRefs[index];
            const labelPlacement = labelLayout.get(position.seriesIndex) || {column: 0, y: position.y};
            const labelColumn = labelColumns[labelPlacement.column] || {
                align: activeX > width - 140 ? 'left' : 'right',
                x: clampNumber(
                    activeX + (activeX > width - 140 ? -TREND_RATE_LABEL_X_OFFSET : TREND_RATE_LABEL_X_OFFSET),
                    4,
                    Math.max(width - 4, 4)
                )
            };

            ref.dotElement.hidden = false;
            ref.labelElement.hidden = !isHovering;
            ref.dotElement.style.left = `${Math.round(position.x)}px`;
            ref.dotElement.style.top = `${Math.round(position.y)}px`;
            ref.labelElement.style.left = `${Math.round(labelColumn.x)}px`;
            ref.labelElement.style.top = `${Math.round(labelPlacement.y)}px`;
            ref.labelElement.textContent = formatPercent(position.value);
            ref.labelElement.dataset.align = labelColumn.align;
        });

        if (typeof controller.onActivateIndex === 'function') {
            controller.onActivateIndex(activeBucketIndex);
        }
    };

    const createTrendChart = function (chartElement, trendModel) {
        const chartLibrary = getChartLibrary();

        if (!chartLibrary) {
            return null;
        }

        const preparedTrendModel = prepareTrendModelForChart(trendModel);

        if (!preparedTrendModel) {
            return null;
        }

        const chartInner = document.createElement('div');
        chartInner.className = 'kg-poll-card-chart-inner';
        chartInner.appendChild(buildChartLegend(preparedTrendModel));

        const plotWrap = document.createElement('div');
        plotWrap.className = 'kg-poll-card-chart-plot';

        const surfaceElement = document.createElement('div');
        surfaceElement.className = 'kg-poll-card-chart-surface';
        surfaceElement.setAttribute('aria-hidden', 'true');

        const overlayElement = document.createElement('div');
        overlayElement.className = 'kg-poll-card-chart-overlay';
        overlayElement.setAttribute('aria-hidden', 'true');

        const crosshairElement = document.createElement('div');
        crosshairElement.className = 'kg-poll-card-chart-crosshair';
        overlayElement.appendChild(crosshairElement);

        const detailLabelElement = document.createElement('div');
        detailLabelElement.className = 'kg-poll-card-chart-detail-label';
        detailLabelElement.hidden = true;
        overlayElement.appendChild(detailLabelElement);

        const seriesRefs = preparedTrendModel.series.map(function (series) {
            const dotElement = document.createElement('div');
            dotElement.className = 'kg-poll-card-chart-active-dot';
            dotElement.style.color = series.color;
            dotElement.hidden = true;
            dotElement.innerHTML = '<span class="kg-poll-card-chart-active-dot-halo"></span><span class="kg-poll-card-chart-active-dot-solid"></span>';
            overlayElement.appendChild(dotElement);

            const labelElement = document.createElement('div');
            labelElement.className = 'kg-poll-card-chart-rate-label';
            labelElement.style.color = series.color;
            labelElement.style.zIndex = '2';
            labelElement.hidden = true;
            overlayElement.appendChild(labelElement);

            return {
                color: series.color,
                values: series.rates,
                dotElement: dotElement,
                labelElement: labelElement
            };
        });

        plotWrap.appendChild(surfaceElement);
        plotWrap.appendChild(overlayElement);
        chartInner.appendChild(plotWrap);
        chartElement.replaceChildren(chartInner);

        const surfaceSize = measureChartSurface(surfaceElement);
        const background = chartLibrary.ColorType
            ? {type: chartLibrary.ColorType.Solid, color: 'transparent'}
            : {color: 'transparent'};
        const lineType = chartLibrary.LineType && typeof chartLibrary.LineType.Curved === 'number'
            ? chartLibrary.LineType.Curved
            : 0;
        const chart = chartLibrary.createChart(surfaceElement, {
            width: surfaceSize.width,
            height: surfaceSize.height,
            layout: {
                background: background,
                textColor: 'transparent',
                attributionLogo: false
            },
            grid: {
                vertLines: {visible: false},
                horzLines: {visible: false}
            },
            crosshair: {
                mode: chartLibrary.CrosshairMode.Normal,
                vertLine: {visible: false, labelVisible: false},
                horzLine: {visible: false, labelVisible: false}
            },
            leftPriceScale: {
                visible: false,
                borderVisible: false,
                scaleMargins: {top: SCALE_MARGIN_TOP, bottom: SCALE_MARGIN_BOTTOM}
            },
            rightPriceScale: {
                visible: false,
                borderVisible: false,
                scaleMargins: {top: SCALE_MARGIN_TOP, bottom: SCALE_MARGIN_BOTTOM}
            },
            timeScale: {
                visible: false,
                borderVisible: false,
                ticksVisible: false,
                timeVisible: false,
                secondsVisible: true,
                fixLeftEdge: true,
                fixRightEdge: true,
                rightOffset: 0,
                barSpacing: preparedTrendModel.buckets.length > 1 ? 18 : 24
            },
            handleScroll: false,
            handleScale: false
        });

        seriesRefs.forEach(function (seriesRef, index) {
            const lineSeries = chart.addLineSeries({
                color: preparedTrendModel.series[index].color,
                lineWidth: 2,
                lineType: lineType,
                crosshairMarkerVisible: false,
                lastValueVisible: false,
                priceLineVisible: false,
                autoscaleInfoProvider: function () {
                    return {
                        priceRange: {
                            minValue: CHART_RATE_MIN,
                            maxValue: CHART_RATE_MAX
                        }
                    };
                }
            });

            lineSeries.setData(preparedTrendModel.buckets.map(function (bucket, bucketIndex) {
                return {
                    time: bucket.chartTime,
                    value: preparedTrendModel.series[index].rates[bucketIndex]
                };
            }));

            seriesRef.api = lineSeries;
        });

        chart.timeScale().fitContent();

        const controller = {
            chartElement: chartElement,
            chart: chart,
            trendModel: preparedTrendModel,
            plotWrap: plotWrap,
            surfaceElement: surfaceElement,
            surfaceSize: surfaceSize,
            overlayElement: overlayElement,
            crosshairElement: crosshairElement,
            detailLabelElement: detailLabelElement,
            seriesRefs: seriesRefs,
            hoverX: null,
            resizeObserver: null,
            rafResize: 0,
            rafReveal: 0
        };

        controller.handlePointerMove = function (event) {
            const rect = controller.surfaceElement.getBoundingClientRect();

            if (rect.width <= 0) {
                return;
            }

            controller.hoverX = clampNumber(event.clientX - rect.left, 0, rect.width);
            updateTrendChartOverlay(controller);
        };

        controller.handleCrosshairMove = function (event) {
            if (!event || !event.point || typeof event.point.x !== 'number' || !Number.isFinite(event.point.x)) {
                return;
            }

            controller.hoverX = clampNumber(event.point.x, 0, controller.surfaceSize.width);
            updateTrendChartOverlay(controller);
        };

        controller.handlePointerLeave = function () {
            controller.hoverX = null;
            updateTrendChartOverlay(controller);
        };

        plotWrap.addEventListener('mousemove', controller.handlePointerMove);
        plotWrap.addEventListener('mouseleave', controller.handlePointerLeave);
        chart.subscribeCrosshairMove(controller.handleCrosshairMove);

        if (typeof ResizeObserver !== 'undefined') {
            controller.resizeObserver = new ResizeObserver(function () {
                if (controller.rafResize) {
                    cancelAnimationFrame(controller.rafResize);
                }

                controller.rafResize = requestAnimationFrame(function () {
                    controller.rafResize = 0;
                    resizeTrendChart(controller);
                });
            });
            controller.resizeObserver.observe(plotWrap);
        }

        chartElement.__kgChartController = controller;

        requestAnimationFrame(function () {
            resizeTrendChart(controller);
        });

        return controller;
    };

    const renderTrendChart = function (chartElement, trendModel) {
        if (!chartElement || !trendModel || !trendModel.series || trendModel.series.length === 0) {
            return false;
        }

        destroyTrendChart(chartElement);
        return Boolean(createTrendChart(chartElement, trendModel));
    };

    const hideTrendChart = function (chartElement) {
        if (!chartElement) {
            return;
        }

        const controller = chartElement.__kgChartController;

        if (controller && controller.rafReveal) {
            cancelAnimationFrame(controller.rafReveal);
            controller.rafReveal = 0;
        }

        destroyTrendChart(chartElement);
        chartElement.hidden = true;
        chartElement.style.visibility = '';

        const card = chartElement.closest('[data-kg-poll-card="true"]');
        if (card) {
            card.__kgPollTrendChartLayoutInitialized = false;
            card.__kgPollTrendChartPlotHeight = '';
        }
    };

    const prepareTrendChartForRender = function (chartElement) {
        if (!chartElement) {
            return;
        }

        chartElement.hidden = false;
        chartElement.style.visibility = 'hidden';
    };

    const revealTrendChart = function (chartElement) {
        if (!chartElement) {
            return;
        }

        const controller = chartElement.__kgChartController;
        if (!controller) {
            chartElement.style.visibility = '';
            return;
        }

        if (controller.rafReveal) {
            cancelAnimationFrame(controller.rafReveal);
        }

        controller.rafReveal = requestAnimationFrame(function () {
            controller.rafReveal = requestAnimationFrame(function () {
                chartElement.style.visibility = '';
                controller.rafReveal = 0;
            });
        });
    };

    const createOptionElement = function () {
        const optionElement = document.createElement('div');
        optionElement.className = 'kg-poll-card-option';
        optionElement.innerHTML = `
            <div class="kg-poll-card-option-fill" aria-hidden="true"></div>
            <div class="kg-poll-card-option-content">
                <div class="kg-poll-card-option-text">
                    <span class="kg-poll-card-option-text-label"></span>
                    <span class="kg-poll-card-option-result-badge" aria-hidden="true">Result</span>
                </div>
                <div class="kg-poll-card-option-result">
                    <span class="kg-poll-card-option-loading" aria-hidden="true"></span>
                    <span class="kg-poll-card-option-correct" aria-hidden="true">
                        <svg viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="8" fill="currentColor"></circle>
                            <path d="M5.1 8.1 7 10l3.9-4" stroke="#0D180F" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"></path>
                        </svg>
                    </span>
                    <span class="kg-poll-card-option-rate"></span>
                </div>
                <div class="kg-poll-card-option-progress" aria-hidden="true"></div>
            </div>
        `;

        return optionElement;
    };

    const ensureOptionLoadingElement = function (optionElement) {
        if (!optionElement || optionElement.querySelector('.kg-poll-card-option-loading')) {
            return;
        }

        const resultElement = optionElement.querySelector('.kg-poll-card-option-result');
        if (!resultElement) {
            return;
        }

        const loadingElement = document.createElement('span');
        loadingElement.className = 'kg-poll-card-option-loading';
        loadingElement.setAttribute('aria-hidden', 'true');
        resultElement.insertBefore(loadingElement, resultElement.firstChild);
    };

    const formatPercent = function (value) {
        return `${Number(value || 0).toFixed(2)}%`;
    };

    const formatVotes = function (value) {
        return `${numberFormatter.format(Number(value || 0))} Polls`;
    };

    const buildGuestId = function () {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }

        return `guest-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    };

    const readStoredGuestId = function () {
        return localStorage.getItem(POLL_GUEST_ID_STORAGE_KEY) || '';
    };

    const persistGuestId = function (guestId) {
        const normalizedGuestId = String(guestId || '').trim();
        if (!normalizedGuestId) {
            return '';
        }

        try {
            if (window.localStorage) {
                window.localStorage.setItem(POLL_GUEST_ID_STORAGE_KEY, normalizedGuestId);
            }
        } catch (err) {
            // ignore storage errors
        }
        return normalizedGuestId;
    };

    const ensureGuestId = function () {
        const existingGuestId = readStoredGuestId();
        if (existingGuestId) {
            return persistGuestId(existingGuestId);
        }

        return persistGuestId(buildGuestId());
    };

    const getSelectionStorageKey = function (pollId, memberUuid) {
        const normalizedPollId = String(pollId || '').trim();
        const normalizedMemberUuid = String(memberUuid || '').trim();

        if (!normalizedPollId || !normalizedMemberUuid) {
            return '';
        }

        return `kg-poll-selection:${normalizedMemberUuid}:${normalizedPollId}`;
    };

    const readPersistedSelectedOptionIds = function (pollId, memberUuid) {
        const storageKey = getSelectionStorageKey(pollId, memberUuid);

        if (!storageKey || !window.localStorage) {
            return [];
        }

        try {
            const raw = window.localStorage.getItem(storageKey);
            const parsed = raw ? JSON.parse(raw) : [];

            return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
        } catch (err) {
            return [];
        }
    };

    const persistSelectedOptionIds = function (state) {
        const storageKey = getSelectionStorageKey(state && state.pollId, state && state.memberUuid);

        if (!storageKey || !window.localStorage) {
            return;
        }

        try {
            const selectedOptionIds = Array.isArray(state && state.selectedOptionIds)
                ? state.selectedOptionIds.map(String).filter(Boolean)
                : [];

            if (!selectedOptionIds.length || !state.hasVoted) {
                window.localStorage.removeItem(storageKey);
                return;
            }

            window.localStorage.setItem(storageKey, JSON.stringify(selectedOptionIds));
        } catch (err) {
            // ignore storage errors
        }
    };

    const formatExpiry = function (value) {
        if (!value) {
            return '';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        const year = String(date.getFullYear());
        const month = MONTH_NAMES[date.getMonth()] || '';
        const day = String(date.getDate());
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = date.getHours() < 12 ? 'AM' : 'PM';

        return `${month} ${day}, ${year}, ${hours}:${minutes} ${ampm}`;
    };

    const fetchJson = async function (url, options) {
        const guestId = readStoredGuestId();
        const requestOptions = options || {};
        const requestHeaders = requestOptions.headers || {};
        const response = await fetch(url, {
            credentials: 'same-origin',
            ...requestOptions,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(guestId ? {'X-Guest-Id': guestId} : {}),
                ...requestHeaders
            }
        });

        const payload = await response.json().catch(function () {
            return null;
        });

        return {
            ok: response.ok,
            status: response.status,
            payload
        };
    };

    const openPortalSignin = function () {
        const signinTrigger = document.querySelector('[data-portal="signin"]');
        if (signinTrigger) {
            signinTrigger.click();
            return;
        }

        if (window.location.hash !== '#/portal/signin') {
            window.location.hash = '#/portal/signin';
        } else {
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
    };

    const setDialogScrollLock = function (locked) {
        document.body.classList.toggle('kg-poll-dialog-open', locked);
        document.documentElement.classList.toggle('kg-poll-dialog-open', locked);
    };

    const ensureVoteDialog = function () {
        let dialog = document.querySelector('.kg-poll-dialog');
        if (dialog) {
            return dialog;
        }

        dialog = document.createElement('div');
        dialog.className = 'kg-poll-dialog';
        dialog.hidden = true;
        dialog.innerHTML = `
            <div class="kg-poll-dialog-backdrop" data-dialog-dismiss="true"></div>
            <div class="kg-poll-dialog-panel" role="dialog" aria-modal="true" aria-labelledby="kg-poll-dialog-title">
                <p class="kg-poll-dialog-title" id="kg-poll-dialog-title"></p>
                <div class="kg-poll-dialog-actions">
                    <button type="button" class="kg-poll-dialog-button kg-poll-dialog-button-confirm">Sure</button>
                    <button type="button" class="kg-poll-dialog-button kg-poll-dialog-button-cancel">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);
        return dialog;
    };

    const openVoteDialog = function (optionText) {
        const dialog = ensureVoteDialog();
        const title = dialog.querySelector('.kg-poll-dialog-title');
        const confirmButton = dialog.querySelector('.kg-poll-dialog-button-confirm');
        const cancelButton = dialog.querySelector('.kg-poll-dialog-button-cancel');
        const dismissBackdrop = dialog.querySelector('[data-dialog-dismiss="true"]');

        if (title) {
            title.textContent = `Change the vote to ${optionText}?`;
        }

        dialog.hidden = false;
        dialog.setAttribute('aria-hidden', 'false');
        setDialogScrollLock(true);

        return new Promise(function (resolve) {
            let settled = false;

            const cleanup = function (value) {
                if (settled) {
                    return;
                }

                settled = true;
                dialog.hidden = true;
                dialog.setAttribute('aria-hidden', 'true');
                setDialogScrollLock(false);

                confirmButton.removeEventListener('click', handleConfirm);
                cancelButton.removeEventListener('click', handleCancel);
                dismissBackdrop.removeEventListener('click', handleCancel);
                window.removeEventListener('keydown', handleKeydown);

                resolve(value);
            };

            const handleConfirm = function (event) {
                event.preventDefault();
                event.stopPropagation();
                cleanup(true);
            };

            const handleCancel = function (event) {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                cleanup(false);
            };

            const handleKeydown = function (event) {
                if (event.key === 'Escape') {
                    cleanup(false);
                }
            };

            confirmButton.addEventListener('click', handleConfirm);
            cancelButton.addEventListener('click', handleCancel);
            dismissBackdrop.addEventListener('click', handleCancel);
            window.addEventListener('keydown', handleKeydown);

            confirmButton.focus();
        });
    };

    // 异步刷新 trends 缓存 (不阻塞主流程 — 失败时图表会继续显示已有数据)
    const refreshTrends = async function (card, poll) {
        try {
            if (!poll || !poll.pollId) {
                return;
            }

            const trendsResponse = await fetchJson(buildTrendsUrl(poll.pollId, poll));
            if (trendsResponse && trendsResponse.ok && trendsResponse.payload) {
                card.__kgPollTrends = normalizeTrendsPayload(trendsResponse.payload);
                if (card.__kgPollState) {
                    renderPoll(card, card.__kgPollState);
                }
            }
        } catch (err) {
            // ignore — 保留旧 trends 数据
        }
    };

    const refreshVotes = async function (card, state, options) {
        const shouldRefreshTrends = !options || options.refreshTrends !== false;

        // 页面初始化 / reload 时仍然允许带上 trends 刷新;
        // 但投票、改票、取消投票后的刷新会显式关掉，避免用旧快照覆盖 SSE 的最新 trend_point.
        if (shouldRefreshTrends) {
            refreshTrends(card, state);
        }

        const votesResponse = await fetchJson(`/members/api/polls/${encodeURIComponent(state.pollId)}/votes`);

        if (!votesResponse.ok || !votesResponse.payload) {
            return false;
        }

        const votes = normalizeVotesPayload(votesResponse.payload);
        const mergedState = mergePollState({
            pollId: state.pollId,
            title: state.title,
            description: state.description,
            imageSrc: state.imageSrc,
            expiresAt: state.expiresAt,
            publishedAt: state.publishedAt,
            createdAt: state.createdAt,
            pollType: state.pollType,
            allowAnonymousVote: state.allowAnonymousVote,
            status: state.status,
            answerRevealed: state.answerRevealed,
            options: state.options.map(function (option, index) {
                return normalizeOption(option, index);
            }),
            viewer: {
                hasVoted: state.hasVoted,
                canVote: state.canVote,
                canInteract: state.canInteract,
                selectedOptionIds: state.selectedOptionIds
            },
            meta: {
                logged_in: state.loggedIn,
                member_uuid: state.memberUuid
            }
        }, votes, card);

        card.__kgPollState = mergedState;
        persistSelectedOptionIds(mergedState);
        return mergedState;
    };

    const normalizeOption = function (option, index) {
        return {
            id: String(option.id || option.option_id || `opt_${index}`),
            text: option.text || '',
            sortOrder: Number(option.sort_order ?? option.sortOrder ?? index),
            isCorrect: Boolean(option.is_correct ?? option.isCorrect ?? false),
            voteCount: Number(option.vote_count ?? option.voteCount ?? 0),
            voteRate: Number(option.vote_rate ?? option.voteRate ?? 0)
        };
    };

    const normalizePollPayload = function (payload, fallbackPollId) {
        const options = Array.isArray(payload && payload.options) ? payload.options : [];
        const viewer = payload && payload.viewer ? payload.viewer : {};

        return {
            pollId: payload && (payload.poll_id || payload.pollId) || fallbackPollId || '',
            title: payload && payload.title || '',
            description: payload && payload.description || '',
            imageSrc: payload && (payload.image_src || payload.imageSrc) || '',
            expiresAt: payload && (payload.expires_at) || '',
            publishedAt: payload && (payload.published_at || payload.publishedAt) || '',
            createdAt: payload && (payload.created_at || payload.createdAt) || '',
            pollType: payload && (payload.poll_type || payload.pollType) || 'single',
            allowAnonymousVote: Boolean(payload && (payload.allow_anonymous_vote ?? payload.allowAnonymousVote)),
            status: payload && payload.status || 'draft',
            answerRevealed: Boolean(payload && (payload.answer_revealed ?? payload.answerRevealed)),
            votingPaused: Boolean(payload && (payload.voting_paused ?? payload.votingPaused)),
            options: options.map(normalizeOption).sort(function (left, right) {
                return left.sortOrder - right.sortOrder;
            }),
            viewer: {
                hasVoted: Boolean(viewer.has_voted || viewer.hasVoted),
                canVote: Boolean(viewer.can_vote ?? viewer.canVote),
                canInteract: Boolean(viewer.can_interact ?? viewer.canInteract),
                selectedOptionIds: Array.isArray(viewer.selected_option_ids || viewer.selectedOptionIds) ? (viewer.selected_option_ids || viewer.selectedOptionIds).map(String) : []
            },
            meta: payload && payload.meta ? payload.meta : {}
        };
    };

    const normalizeVotesPayload = function (payload) {
        const options = Array.isArray(payload && payload.options) ? payload.options : [];
        const viewer = payload && payload.viewer ? payload.viewer : {};
        const answer = payload && payload.answer ? payload.answer : {};

        return {
            totalVotes: Number(payload && (payload.total_votes ?? payload.totalVotes) || 0),
            options: options.map(normalizeOption),
            viewer: {
                hasVoted: Boolean(viewer.has_voted || viewer.hasVoted),
                canVote: Boolean(viewer.can_vote ?? viewer.canVote),
                canInteract: Boolean(viewer.can_interact ?? viewer.canInteract),
                selectedOptionIds: Array.isArray(viewer.selected_option_ids || viewer.selectedOptionIds) ? (viewer.selected_option_ids || viewer.selectedOptionIds).map(String) : []
            },
            answer: {
                revealed: Boolean(answer.revealed),
                correctOptionIds: Array.isArray(answer.correct_option_ids || answer.correctOptionIds) ? (answer.correct_option_ids || answer.correctOptionIds).map(String) : []
            }
        };
    };

    const mergePollState = function (poll, votes, card) {
        const voteOptionsById = new Map((votes && votes.options ? votes.options : []).map(function (option) {
            return [option.id, option];
        }));

        const pollId = poll.pollId || card.dataset.pollId || '';
        const loggedIn = Boolean(poll.meta && poll.meta.logged_in);
        const memberUuid = poll.meta && poll.meta.member_uuid
            ? String(poll.meta.member_uuid)
            : !loggedIn
                ? ensureGuestId()
                : '';
        const persistedSelectedOptionIds = readPersistedSelectedOptionIds(pollId, memberUuid);
        const selectedOptionIdsFromApi = votes && votes.viewer && votes.viewer.selectedOptionIds && votes.viewer.selectedOptionIds.length
            ? votes.viewer.selectedOptionIds
            : poll.viewer.selectedOptionIds && poll.viewer.selectedOptionIds.length
                ? poll.viewer.selectedOptionIds
                : persistedSelectedOptionIds;
        const selectedOptionIds = poll.pollType === 'multiple' &&
            persistedSelectedOptionIds.length > selectedOptionIdsFromApi.length
            ? persistedSelectedOptionIds
            : selectedOptionIdsFromApi;
        const correctOptionIds = votes && votes.answer && votes.answer.correctOptionIds ? votes.answer.correctOptionIds : [];
        const totalVotes = votes ? votes.totalVotes : 0;
        const answerRevealed = Boolean((votes && votes.answer && votes.answer.revealed) || poll.answerRevealed);
        const votingPaused = Boolean(poll.votingPaused);
        const showResults = Boolean(
            poll.viewer.canVote === false ||
            (votes && (
                answerRevealed ||
                poll.viewer.hasVoted ||
                (votes.viewer && votes.viewer.hasVoted) ||
                poll.status !== 'published'
            ))
        );

        return {
            pollId,
            title: poll.title,
            description: poll.description,
            imageSrc: poll.imageSrc,
            expiresAt: poll.expiresAt,
            publishedAt: poll.publishedAt,
            createdAt: poll.createdAt,
            pollType: poll.pollType,
            allowAnonymousVote: Boolean(poll.allowAnonymousVote),
            status: poll.status,
            answerRevealed,
            votingPaused,
            totalVotes,
            memberUuid,
            selectedOptionIds,
            correctOptionIds,
            canVote: Boolean(poll.viewer.canVote),
            hasVoted: Boolean(poll.viewer.hasVoted || (votes && votes.viewer && votes.viewer.hasVoted)),
            loggedIn,
            showResults,
            voteSubmitting: Boolean(card.__kgPollState && card.__kgPollState.voteSubmitting),
            submittingOptionId: card.__kgPollState && card.__kgPollState.submittingOptionId
                ? String(card.__kgPollState.submittingOptionId)
                : '',
            // 暂停中直接把 canInteract 拉黑, 无论 backend 传了什么 —— 暂停时前台一律不允许投票 / 改票 / 取消
            canInteract: Boolean(
                poll.status === 'published' &&
                !answerRevealed &&
                !votingPaused &&
                (
                    poll.viewer.canInteract ||
                    (votes && votes.viewer && votes.viewer.canInteract)
                )
            ),
            options: poll.options.map(function (option) {
                const voteOption = voteOptionsById.get(option.id);
                return {
                    id: option.id,
                    text: option.text,
                    sortOrder: option.sortOrder,
                    voteCount: voteOption ? voteOption.voteCount : 0,
                    voteRate: voteOption ? voteOption.voteRate : 0,
                    isCorrect: correctOptionIds.indexOf(option.id) !== -1
                };
            })
        };
    };

    const mergeStreamResultsIntoState = function (state, results) {
        if (!state || !results) {
            return state;
        }

        const normalizedResults = normalizeVotesPayload(results);
        const resultOptionsById = new Map(normalizedResults.options.map(function (option) {
            return [option.id, option];
        }));

        state.totalVotes = normalizedResults.totalVotes;
        state.options = state.options.map(function (option) {
            const resultOption = resultOptionsById.get(option.id);

            return resultOption ? {
                ...option,
                voteCount: resultOption.voteCount,
                voteRate: resultOption.voteRate
            } : option;
        });

        if (normalizedResults.answer && normalizedResults.answer.revealed) {
            state.answerRevealed = true;
            state.correctOptionIds = normalizedResults.answer.correctOptionIds;
            state.options = state.options.map(function (option) {
                return {
                    ...option,
                    isCorrect: state.correctOptionIds.indexOf(option.id) !== -1
                };
            });
            state.showResults = true;
            state.canInteract = false;
        }

        return state;
    };

    const applyStreamSnapshot = function (card, payload) {
        const currentState = card.__kgPollState;
        const pollPayload = payload && payload.poll ? payload.poll : {};
        const resultsPayload = payload && payload.results ? payload.results : {};
        const preservedViewer = currentState ? {
            has_voted: currentState.hasVoted,
            can_vote: currentState.canVote,
            can_interact: currentState.canInteract,
            selected_option_ids: currentState.selectedOptionIds
        } : payload && payload.viewer ? payload.viewer : {};

        const poll = normalizePollPayload({
            ...pollPayload,
            viewer: preservedViewer,
            meta: {
                logged_in: currentState ? currentState.loggedIn : false,
                member_uuid: currentState ? currentState.memberUuid : ''
            }
        }, currentState ? currentState.pollId : card.dataset.pollId);

        const votes = normalizeVotesPayload({
            ...resultsPayload,
            viewer: preservedViewer,
            answer: resultsPayload.answer || {
                revealed: poll.answerRevealed,
                correct_option_ids: pollPayload.correct_option_ids || pollPayload.correctOptionIds || []
            }
        });

        if (payload && payload.trends) {
            card.__kgPollTrends = mergeTrendsPayloads(card.__kgPollTrends, payload.trends);
        }

        card.__kgPollState = mergePollState(poll, votes, card);
        persistSelectedOptionIds(card.__kgPollState);
        renderPoll(card, card.__kgPollState);
    };

    const applyStreamVote = function (card, payload) {
        const state = card.__kgPollState;

        if (!state || !payload) {
            return;
        }

        mergeStreamResultsIntoState(state, payload.results || {});

        if (payload.trend_point) {
            card.__kgPollTrends = appendTrendPoint(card.__kgPollTrends, payload.trend_point);
        }

        renderPoll(card, state);
    };

    // SSE `voting_state_changed`: 后端 pause/resume 成功后广播过来, 前台原地切 UI 无需 reload.
    // payload 形如 { poll_id, voting_paused: boolean }
    const applyStreamVotingStateChanged = function (card, payload) {
        const state = card.__kgPollState;
        if (!state || !payload) {
            return;
        }

        const nextPaused = Boolean(payload.voting_paused ?? payload.votingPaused);
        state.votingPaused = nextPaused;

        // 暂停中把交互直接锁死; 恢复后由 answerRevealed / status 等其它条件决定
        state.canInteract = Boolean(
            state.status === 'published' &&
            !state.answerRevealed &&
            !nextPaused &&
            state.canInteract
        );

        renderPoll(card, state);
    };

    const applyStreamPollStatus = function (card, payload) {
        const state = card.__kgPollState;

        if (!state || !payload) {
            return;
        }

        if (payload.status) {
            state.status = payload.status;
        }

        if (typeof payload.answer_revealed === 'boolean' || typeof payload.answerRevealed === 'boolean') {
            state.answerRevealed = Boolean(payload.answer_revealed ?? payload.answerRevealed);
        }

        if (Array.isArray(payload.correct_option_ids || payload.correctOptionIds)) {
            state.correctOptionIds = (payload.correct_option_ids || payload.correctOptionIds).map(String);
            state.options = state.options.map(function (option) {
                return {
                    ...option,
                    isCorrect: state.correctOptionIds.indexOf(option.id) !== -1
                };
            });
        }

        if (state.answerRevealed || state.status !== 'published') {
            state.showResults = true;
            state.canInteract = false;
        }

        renderPoll(card, state);
    };

    const applyStreamPollUpdated = function (card, payload) {
        const state = card.__kgPollState;

        if (!state || !payload || !payload.poll) {
            return;
        }

        const nextPoll = normalizePollPayload({
            ...payload.poll,
            viewer: {
                has_voted: state.hasVoted,
                can_vote: state.canVote,
                can_interact: state.canInteract,
                selected_option_ids: state.selectedOptionIds
            },
            meta: {
                logged_in: state.loggedIn
            }
        }, state.pollId);

        state.title = nextPoll.title;
        state.description = nextPoll.description;
        state.imageSrc = nextPoll.imageSrc;
        state.expiresAt = nextPoll.expiresAt;
        state.publishedAt = nextPoll.publishedAt;
        state.createdAt = nextPoll.createdAt;
        state.pollType = nextPoll.pollType;
        state.allowAnonymousVote = nextPoll.allowAnonymousVote;
        state.status = nextPoll.status;
        state.answerRevealed = nextPoll.answerRevealed;
        state.options = state.options.map(function (option) {
            const updatedOption = nextPoll.options.find(function (candidate) {
                return candidate.id === option.id;
            });

            return updatedOption ? {
                ...option,
                text: updatedOption.text,
                sortOrder: updatedOption.sortOrder
            } : option;
        }).sort(function (left, right) {
            return left.sortOrder - right.sortOrder;
        });

        renderPoll(card, state);
    };

    const setFeedback = function (card, message, tone) {
        const feedback = card.querySelector('.kg-poll-card-feedback');
        if (!feedback) {
            return;
        }

        if (!message) {
            feedback.hidden = true;
            feedback.textContent = '';
            feedback.removeAttribute('data-tone');
            return;
        }

        feedback.hidden = false;
        feedback.textContent = message;
        feedback.setAttribute('data-tone', tone || 'neutral');
    };

    const ensureFeedbackElement = function (card) {
        let feedback = card.querySelector('.kg-poll-card-feedback');
        if (!feedback) {
            feedback = document.createElement('p');
            feedback.className = 'kg-poll-card-feedback';
            feedback.hidden = true;
            card.appendChild(feedback);
        }
    };

    const isDesktopTrendChartLayout = function () {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }

        return window.matchMedia(`(min-width: ${DESKTOP_TREND_CHART_BREAKPOINT}px)`).matches;
    };

    const updateTrendChartLegendLayout = function (chartElement) {
        if (!chartElement) {
            return;
        }

        const legendElement = chartElement.querySelector('.kg-poll-card-chart-legend');

        if (!legendElement) {
            return;
        }

        legendElement.classList.remove('kg-poll-card-chart-legend--compact');

        const legendWidth = Math.round(legendElement.getBoundingClientRect().width);
        if (legendWidth <= 0) {
            return;
        }

        const compactThreshold = Math.max((legendWidth - 20) / 2, 0);
        const items = Array.from(legendElement.querySelectorAll('.kg-poll-card-chart-legend-item'));
        const shouldCompact = items.some(function (item) {
            return Math.ceil(item.scrollWidth) > compactThreshold;
        });

        legendElement.classList.toggle('kg-poll-card-chart-legend--compact', shouldCompact);
    };

    const syncTrendChartLayout = function (card) {
        if (!card) {
            return;
        }

        const chartElement = card.querySelector('.kg-poll-card-chart');
        const plotWrap = chartElement && chartElement.querySelector('.kg-poll-card-chart-plot');

        if (!chartElement || !plotWrap) {
            return;
        }

        let nextHeight = `${MOBILE_CHART_PLOT_HEIGHT}px`;

        if (isDesktopTrendChartLayout()) {
            const optionsContainer = card.querySelector('.kg-poll-card-options');
            updateTrendChartLegendLayout(chartElement);

            const legendElement = chartElement.querySelector('.kg-poll-card-chart-legend');

            if (optionsContainer && legendElement) {
                const optionsHeight = Math.round(optionsContainer.getBoundingClientRect().height);
                const legendHeight = Math.round(legendElement.getBoundingClientRect().height);
                const plotHeight = Math.max(optionsHeight - legendHeight, DESKTOP_CHART_PLOT_MIN_HEIGHT);

                nextHeight = `${plotHeight}px`;
            }
        } else {
            updateTrendChartLegendLayout(chartElement);
        }

        if (plotWrap.style.height !== nextHeight) {
            plotWrap.style.height = nextHeight;
            // 强制立即 reflow，让后面的 measureChartSurface 测得新尺寸
            // void 触发 layout，不影响逻辑
            void plotWrap.offsetHeight;
        }

        const cardElement = chartElement.closest('[data-kg-poll-card="true"]');
        if (cardElement) {
            cardElement.__kgPollTrendChartPlotHeight = nextHeight;
        }

        const controller = chartElement.__kgChartController;
        if (controller) {
            // 用 requestAnimationFrame 等下一帧布局完成再 resize chart，
            // 保险起见——避免某些浏览器在同步 getBoundingClientRect 时仍返回旧值
            const doResize = function () { resizeTrendChart(controller); };
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(doResize);
            } else {
                doResize();
            }
        }
    };

    const renderOption = function (optionElement, option, state, clickable) {
        ensureOptionLoadingElement(optionElement);
        const isSelected = state.selectedOptionIds.indexOf(option.id) !== -1;
        const isSubmitting = state.submittingOptionId === option.id;

        optionElement.dataset.optionId = option.id;
        optionElement.dataset.voteCount = String(option.voteCount || 0);
        optionElement.dataset.voteRate = String(option.voteRate || 0);
        optionElement.dataset.selected = String(isSelected);
        optionElement.dataset.correct = String(state.correctOptionIds.indexOf(option.id) !== -1);
        optionElement.dataset.submitting = String(isSubmitting);
        optionElement.dataset.interactive = String(Boolean(clickable));
        optionElement.tabIndex = clickable ? 0 : -1;
        optionElement.setAttribute('role', clickable ? 'button' : 'presentation');
        optionElement.setAttribute('aria-busy', String(isSubmitting));
        optionElement.setAttribute('aria-disabled', String(!clickable));

        const loadingElement = optionElement.querySelector('.kg-poll-card-option-loading');
        if (loadingElement) {
            loadingElement.style.display = isSubmitting ? 'inline-flex' : 'none';
        }

        const correctElement = optionElement.querySelector('.kg-poll-card-option-correct');
        if (correctElement) {
            const shouldShowCorrect = isSelected && !isSubmitting;
            correctElement.hidden = !shouldShowCorrect;
            correctElement.style.display = shouldShowCorrect ? 'inline-flex' : 'none';
        }

        const fill = optionElement.querySelector('.kg-poll-card-option-fill');
        if (fill) {
            fill.style.width = `${Math.max(0, Math.min(Number(option.voteRate || 0), 100))}%`;
        }

        // 底部细进度条宽度也跟 voteRate 同步
        const progress = optionElement.querySelector('.kg-poll-card-option-progress');
        if (progress) {
            progress.style.width = buildOptionProgressWidth(option.voteRate || 0);
        }

        // 文字写到 .kg-poll-card-option-text-label 里, 不再直接覆盖 .kg-poll-card-option-text
        // (否则会把里面的 Result 徽章 span 一并干掉). 老版本 SSR 还没有 label span 的情况下
        // 用 .kg-poll-card-option-text 兜底.
        const labelElement = optionElement.querySelector('.kg-poll-card-option-text-label')
            || optionElement.querySelector('.kg-poll-card-option-text');
        if (labelElement) {
            labelElement.textContent = option.text || '';
        }

        const rateElement = optionElement.querySelector('.kg-poll-card-option-rate');
        if (rateElement) {
            rateElement.textContent = formatPercent(option.voteRate || 0);
        }
    };

    const renderPoll = function (card, state) {
        ensureFeedbackElement(card);

        card.dataset.pollStatus = state.status || 'published';
        card.dataset.pollType = state.pollType || 'single';
        card.dataset.pollAnswerRevealed = String(Boolean(state.answerRevealed));
        card.dataset.totalVotes = String(state.totalVotes || 0);
        card.dataset.memberLoggedIn = String(Boolean(state.loggedIn));
        card.dataset.pollClickable = String(Boolean(state.canInteract && !state.voteSubmitting));
        card.dataset.pollSubmitting = String(Boolean(state.voteSubmitting));

        const title = card.querySelector('.kg-poll-card-title');
        if (title) {
            title.textContent = state.title || '';
        }

        const description = card.querySelector('.kg-poll-card-description');
        if (description) {
            if (state.description) {
                description.textContent = state.description;
                description.hidden = false;
            } else {
                description.hidden = true;
            }
        }

        const image = card.querySelector('.kg-poll-card-image');
        if (image) {
            if (state.imageSrc) {
                image.src = state.imageSrc;
                image.alt = state.title || 'Poll cover';
                image.hidden = false;
            } else {
                image.hidden = true;
            }
        }

        const optionsContainer = card.querySelector('.kg-poll-card-options');
        if (optionsContainer) {
            const currentOptionElements = Array.from(optionsContainer.querySelectorAll('.kg-poll-card-option'));

            state.options.forEach(function (option, index) {
                let optionElement = currentOptionElements[index];

                if (!optionElement) {
                    optionElement = currentOptionElements[0] ? currentOptionElements[0].cloneNode(true) : createOptionElement();
                    optionsContainer.appendChild(optionElement);
                }

                renderOption(optionElement, option, state, state.canInteract && !state.voteSubmitting);
            });

            currentOptionElements.slice(state.options.length).forEach(function (element) {
                element.remove();
            });
        }

        // 图表只在 trends 接口返回了有效 points 后再显示.
        // 没有 points / 请求失败时直接隐藏, 避免 SSR 快照先占位再重排.
        const chartElement = card.querySelector('.kg-poll-card-chart');
        if (chartElement) {
            try {
                const trendsPayload = card.__kgPollTrends;
                const trendModel = trendsPayload
                    ? buildRealTrendModel(trendsPayload, state.options || [])
                    : null;

                if (trendModel) {
                    prepareTrendChartForRender(chartElement);
                    if (renderTrendChart(chartElement, trendModel)) {
                        const plotWrap = chartElement.querySelector('.kg-poll-card-chart-plot');
                        const storedPlotHeight = card.__kgPollTrendChartPlotHeight;
                        const controller = chartElement.__kgChartController;

                        if (!card.__kgPollTrendChartLayoutInitialized) {
                            syncTrendChartLayout(card);
                            card.__kgPollTrendChartLayoutInitialized = true;
                        } else if (plotWrap && storedPlotHeight) {
                            plotWrap.style.height = storedPlotHeight;

                            if (controller) {
                                resizeTrendChart(controller);
                            }
                        }

                        revealTrendChart(chartElement);
                    } else {
                        hideTrendChart(chartElement);
                    }
                } else {
                    hideTrendChart(chartElement);
                }
            } catch (err) {
                hideTrendChart(chartElement);
            }
        }

        const votes = card.querySelector('.kg-poll-card-votes');
        if (votes) {
            votes.textContent = formatVotes(state.totalVotes || 0);
        }

        /*
         * 右下角状态徽标显示优先级 (从高到低):
         *   1. votingPaused              -> "TBD"    (最高, 即使已过期 / 已公布答案, 只要还是暂停就先显示 TBD)
         *   2. expired 或 answerRevealed  -> "Ended" (未暂停但已到期 / 已公布)
         *   3. 未到期且未暂停             -> 时钟图标 + 结束日期
         * 三者互斥, 同一时刻只显示一个.
         */
        const expiresMs = state.expiresAt ? new Date(state.expiresAt).getTime() : NaN;
        const pollExpired = Number.isFinite(expiresMs) && expiresMs <= Date.now();
        const showPaused = Boolean(state.votingPaused);
        const showEnded = !showPaused && (pollExpired || Boolean(state.answerRevealed));

        card.dataset.votingPaused = String(Boolean(state.votingPaused));

        const paused = card.querySelector('.kg-poll-card-paused');
        if (paused) {
            paused.hidden = !showPaused;
        }

        const expiry = card.querySelector('.kg-poll-card-expiry');
        if (expiry) {
            const date = expiry.querySelector('span');
            if (state.expiresAt && !showPaused && !showEnded) {
                if (date) {
                    date.textContent = formatExpiry(state.expiresAt);
                }
                expiry.hidden = false;
            } else {
                expiry.hidden = true;
            }
        }

        const ended = card.querySelector('.kg-poll-card-ended');
        if (ended) {
            ended.hidden = !showEnded;
        }

    };

    const setSelectedOptions = function (card, optionIds) {
        const state = card.__kgPollState;
        if (!state || !state.canInteract) {
            return;
        }

        state.selectedOptionIds = Array.isArray(optionIds) ? optionIds.map(String) : [];

        setFeedback(card, '', '');
        renderPoll(card, state);
    };

    const buildMultipleSelection = function (state, optionId) {
        const selectedIds = Array.isArray(state && state.selectedOptionIds)
            ? state.selectedOptionIds.map(String)
            : [];
        const nextId = String(optionId);

        if (selectedIds.indexOf(nextId) !== -1) {
            return selectedIds.filter(function (id) {
                return id !== nextId;
            });
        }

        return selectedIds.concat(nextId);
    };

    const resolveConfirmedSelectedOptionIds = function (state, voteRequest, viewer, previousSelectedOptionIds) {
        const previousSelectedIds = Array.isArray(state && state.selectedOptionIds)
            ? state.selectedOptionIds.map(String)
            : [];
        const baselineSelectedIds = Array.isArray(previousSelectedOptionIds)
            ? previousSelectedOptionIds.map(String)
            : previousSelectedIds;
        const requestedOptionIds = Array.isArray(voteRequest && voteRequest.option_ids)
            ? voteRequest.option_ids.map(String)
            : [];
        const viewerSelectedOptionIds = Array.isArray(viewer && (viewer.selected_option_ids || viewer.selectedOptionIds))
            ? (viewer.selected_option_ids || viewer.selectedOptionIds).map(String)
            : [];

        if (!voteRequest) {
            return viewerSelectedOptionIds.length ? viewerSelectedOptionIds : baselineSelectedIds;
        }

        if (state && state.pollType === 'multiple') {
            if (voteRequest.action === 'cancel') {
                return baselineSelectedIds.filter(function (id) {
                    return requestedOptionIds.indexOf(id) === -1;
                });
            }

            return requestedOptionIds;
        }

        if (voteRequest.action === 'cancel') {
            if (state && state.pollType === 'multiple' && requestedOptionIds.length > 0) {
                return baselineSelectedIds.filter(function (id) {
                    return requestedOptionIds.indexOf(id) === -1;
                });
            }

            return [];
        }

        return viewerSelectedOptionIds.length ? viewerSelectedOptionIds : requestedOptionIds;
    };

    const submitVote = async function (card, voteRequest, submittingOptionId) {
        const state = card.__kgPollState;
        if (!state || !state.pollId || state.voteSubmitting || card.dataset.pollSubmitting === 'true') {
            return;
        }

        if (voteRequest.action !== 'cancel' && !voteRequest.option_ids.length) {
            setFeedback(card, 'Choose an option first.', 'warning');
            return;
        }

        const previousSelectedOptionIds = Array.isArray(state.selectedOptionIds)
            ? state.selectedOptionIds.map(String)
            : [];

        state.voteSubmitting = true;
        state.submittingOptionId = submittingOptionId ? String(submittingOptionId) : '';
        card.dataset.pollSubmitting = 'true';
        renderPoll(card, state);

        try {
            const res = await fetch(`/members/api/session/`, {credentials: 'include'});
            const token = (await res.text()).trim();
            const requestHeaders = {
                'Content-Type': 'application/json'
            };

            if (res.ok && token && token.split('.').length === 3) {
                requestHeaders.Authorization = `Bearer ${token}`;
            }

            const response = await fetchJson(`/members/api/polls/${encodeURIComponent(state.pollId)}/votes`, {
                method: 'POST',
                body: JSON.stringify(voteRequest),
                headers: requestHeaders
            });

            if (!response.ok || !response.payload) {
                const code = response.payload && response.payload.error && response.payload.error.code;
                const isLoginRequired = response.status === 401 || code === 'LOGIN_REQUIRED';
                const refreshedState = await refreshVotes(card, state, {refreshTrends: false}).catch(function () {
                    return null;
                });
                if (!refreshedState) {
                    state.selectedOptionIds = previousSelectedOptionIds;
                    persistSelectedOptionIds(state);
                }
                if (isLoginRequired) {
                    setFeedback(card, '', '');
                    openPortalSignin();
                    return;
                }
                const message = code === 'VOTE_CONFLICT'
                    ? 'Your vote changed in another session. Please try again.'
                    : response.payload && response.payload.error && response.payload.error.message
                    ? response.payload.error.message
                    : 'Failed to submit vote.';
                setFeedback(card, message, 'error');
                return;
            }

            const responsePayload = response.payload;
            const results = responsePayload.results || {};
            const viewer = responsePayload.viewer || {};
            const responseAction = responsePayload.action || voteRequest.action || 'cast';

            state.hasVoted = Boolean(viewer.has_voted ?? viewer.hasVoted ?? responseAction !== 'cancel');
            state.canVote = Boolean(viewer.can_vote ?? viewer.canVote ?? responseAction === 'cancel');
            state.canInteract = Boolean(
                viewer.can_interact ??
                viewer.canInteract ??
                (!state.answerRevealed && state.canInteract)
            );
            state.selectedOptionIds = resolveConfirmedSelectedOptionIds(state, voteRequest, viewer, previousSelectedOptionIds);
            state.totalVotes = Number(results.total_votes ?? results.totalVotes ?? state.totalVotes ?? 0);
            persistSelectedOptionIds(state);

            const resultOptionsById = new Map((results.options || []).map(function (option, index) {
                const normalized = normalizeOption(option, index);
                return [normalized.id, normalized];
            }));

            state.options = state.options.map(function (option) {
                const resultOption = resultOptionsById.get(option.id);
                return resultOption ? {
                    ...option,
                    voteCount: resultOption.voteCount,
                    voteRate: resultOption.voteRate
                } : option;
            });

            const refreshedState = await refreshVotes(card, state, {refreshTrends: false}).catch(function () {
                return null;
            });

            setFeedback(card, '', '');
            renderPoll(card, refreshedState || card.__kgPollState || state);
        } catch (err) {
            const refreshedState = await refreshVotes(card, state, {refreshTrends: false}).catch(function () {
                return null;
            });
            if (!refreshedState) {
                state.selectedOptionIds = previousSelectedOptionIds;
                persistSelectedOptionIds(state);
            }
            setFeedback(card, 'Failed to submit vote.', 'error');
        } finally {
            const currentState = card.__kgPollState || state;
            if (currentState) {
                currentState.voteSubmitting = false;
                currentState.submittingOptionId = '';
            }
            card.dataset.pollSubmitting = 'false';
            renderPoll(card, currentState);
        }
    };

    const bindInteractions = function (card) {
        if (card.dataset.pollBound === 'true') {
            return;
        }

        card.dataset.pollBound = 'true';

        card.addEventListener('click', async function (event) {
            const optionElement = event.target.closest('.kg-poll-card-option');
            if (!optionElement || !card.contains(optionElement)) {
                return;
            }

            const state = card.__kgPollState;
            const nextOptionId = optionElement.dataset.optionId;

            if (!state || state.voteSubmitting || !nextOptionId) {
                return;
            }

            if (!state.canInteract) {
                if (
                    !state.loggedIn &&
                    !state.allowAnonymousVote &&
                    state.status === 'published' &&
                    !state.answerRevealed
                ) {
                    setFeedback(card, '', '');
                    openPortalSignin();
                }
                return;
            }

            if (state.pollType === 'multiple') {
                const isSelected = state.selectedOptionIds.indexOf(nextOptionId) !== -1;
                const nextSelection = buildMultipleSelection(state, nextOptionId);
                const nextAction = isSelected
                    ? 'cancel'
                    : !state.hasVoted
                        ? 'cast'
                        : 'change';
                const voteRequest = nextAction === 'cancel'
                    ? {action: 'cancel', option_ids: [nextOptionId]}
                    : {action: nextAction, option_ids: nextSelection};

                await submitVote(card, voteRequest, nextOptionId);
                return;
            }

            if (!state.hasVoted) {
                await submitVote(card, {
                    action: 'cast',
                    option_ids: [nextOptionId]
                }, nextOptionId);
                return;
            }

            if (state.selectedOptionIds.indexOf(nextOptionId) !== -1) {
                await submitVote(card, {
                    action: 'cancel',
                    option_ids: []
                }, nextOptionId);
                return;
            }

            // 取选项文字时优先 label span, 避免把 Result 徽章里的 "Result" 字样也读进来.
            const optionTextEl = optionElement.querySelector('.kg-poll-card-option-text-label')
                || optionElement.querySelector('.kg-poll-card-option-text');
            const optionText = optionTextEl?.textContent || 'this option';
            const confirmed = await openVoteDialog(optionText);

            if (!confirmed) {
                return;
            }

            await submitVote(card, {
                action: 'change',
                option_ids: [nextOptionId]
            }, nextOptionId);
        });

        card.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }

            const optionElement = event.target.closest('.kg-poll-card-option');
            if (!optionElement || !card.contains(optionElement)) {
                return;
            }

            event.preventDefault();
            optionElement.click();
        });
    };

    const loadPollCardData = async function (card) {
        const pollId = card.dataset.pollId;

        if (!pollId) {
            return false;
        }

        const [pollResponse, votesResponse] = await Promise.all([
            fetchJson(`/members/api/polls/${encodeURIComponent(pollId)}`),
            fetchJson(`/members/api/polls/${encodeURIComponent(pollId)}/votes`)
        ]);

        if (!pollResponse.ok || !pollResponse.payload) {
            return false;
        }

        const poll = normalizePollPayload(pollResponse.payload, pollId);
        const votes = votesResponse.ok && votesResponse.payload ? normalizeVotesPayload(votesResponse.payload) : null;
        const state = mergePollState(poll, votes, card);

        const preservedTrends = card.__kgPollTrends || null;
        card.__kgPollTrends = preservedTrends;
        card.__kgPollState = state;
        persistSelectedOptionIds(state);
        renderPoll(card, state);
        setFeedback(card, '', '');
        refreshTrends(card, state);

        return true;
    };

    const reloadPollCardData = async function (card) {
        if (card.__kgPollReloadPromise) {
            card.__kgPollReloadQueued = true;
            return card.__kgPollReloadPromise;
        }

        card.__kgPollReloadPromise = loadPollCardData(card).finally(function () {
            card.__kgPollReloadPromise = null;

            if (card.__kgPollReloadQueued) {
                card.__kgPollReloadQueued = false;
                reloadPollCardData(card);
            }
        });

        return card.__kgPollReloadPromise;
    };

    const parsePollStreamEvent = function (event) {
        if (!event || typeof event.data !== 'string' || !event.data) {
            return null;
        }

        try {
            return JSON.parse(event.data);
        } catch (err) {
            return null;
        }
    };

    const handlePollStreamEnvelope = function (card, envelope) {
        if (!card || !envelope) {
            return;
        }

        const state = card.__kgPollState;
        const pollId = state ? state.pollId : card.dataset.pollId;

        if (!pollId || (envelope.poll_id && envelope.poll_id !== pollId)) {
            return;
        }

        const eventName = envelope.event || '';
        const payload = envelope.data || {};

        if (eventName === 'snapshot') {
            applyStreamSnapshot(card, payload);
            return;
        }

        if (eventName === 'vote') {
            applyStreamVote(card, payload);
            return;
        }

        if (eventName === 'poll_status' || eventName === 'answer_revealed') {
            applyStreamPollStatus(card, payload);
            reloadPollCardData(card).catch(function () {});
            return;
        }

        if (eventName === 'voting_state_changed') {
            applyStreamVotingStateChanged(card, payload);
            return;
        }

        if (eventName === 'poll_updated') {
            applyStreamPollUpdated(card, payload);
            reloadPollCardData(card).catch(function () {});
        }
    };

    const ensurePollStream = function (card) {
        const pollId = card && card.dataset.pollId;

        if (!pollId || typeof window.EventSource === 'undefined' || card.__kgPollStream) {
            return;
        }

        const candidates = buildPollStreamCandidates(card);

        if (!candidates.length) {
            return;
        }

        const controller = {
            source: null,
            candidateIndex: -1,
            opened: false
        };

        const bindSource = function (source) {
            const handleNamedEvent = function (event) {
                const envelope = parsePollStreamEvent(event);
                if (envelope) {
                    handlePollStreamEnvelope(card, envelope);
                }
            };

            controller.handleNamedEvent = handleNamedEvent;
            controller.handleMessage = function (event) {
                const envelope = parsePollStreamEvent(event);
                if (envelope && envelope.event) {
                    handlePollStreamEnvelope(card, envelope);
                }
            };
            controller.handleOpen = function () {
                controller.opened = true;
                card.dataset.pollStreamConnected = 'true';
            };
            controller.handleError = function () {
                card.dataset.pollStreamConnected = 'false';

                if (controller.opened) {
                    return;
                }

                if (controller.candidateIndex >= candidates.length - 1) {
                    return;
                }

                source.close();
                connect(controller.candidateIndex + 1);
            };

            source.addEventListener('snapshot', handleNamedEvent);
            source.addEventListener('vote', handleNamedEvent);
            source.addEventListener('poll_status', handleNamedEvent);
            source.addEventListener('answer_revealed', handleNamedEvent);
            source.addEventListener('voting_state_changed', handleNamedEvent);
            source.addEventListener('poll_updated', handleNamedEvent);
            source.addEventListener('heartbeat', handleNamedEvent);
            source.addEventListener('open', controller.handleOpen);
            source.addEventListener('error', controller.handleError);
            source.addEventListener('message', controller.handleMessage);
        };

        const connect = function (index) {
            const url = buildPollStreamUrl(candidates[index], pollId);
            const source = new window.EventSource(url, {withCredentials: true});

            controller.candidateIndex = index;
            controller.opened = false;
            controller.source = source;
            bindSource(source);
        };

        controller.close = function () {
            if (controller.source) {
                controller.source.close();
            }

            card.dataset.pollStreamConnected = 'false';
        };

        connect(0);
        card.__kgPollStream = controller;
    };

    const hydratePollCard = async function (card) {
        const pollId = card.dataset.pollId;

        if (!pollId || card.dataset.pollHydrated === 'true') {
            return;
        }

        ensureGuestId();
        card.dataset.pollHydrated = 'loading';
        bindInteractions(card);

        try {
            if (!await loadPollCardData(card)) {
                card.dataset.pollHydrated = 'error';
                setFeedback(card, 'Failed to load poll.', 'error');
                return;
            }
            card.dataset.pollHydrated = 'true';
            ensurePollStream(card);
        } catch (err) {
            card.dataset.pollHydrated = 'error';
            setFeedback(card, 'Failed to load poll.', 'error');
        }
    };

    const init = function (root) {
        const cards = root.querySelectorAll ? root.querySelectorAll('[data-kg-poll-card="true"]') : [];
        cards.forEach(function (card) {
            hydratePollCard(card);
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            init(document);
        });
    } else {
        init(document);
    }
})();
