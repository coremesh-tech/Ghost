const {addCreateDocumentOption} = require('../render-utils/add-create-document-option');
const {renderEmptyContainer} = require('../render-utils/render-empty-container');

function getValue(data, camelKey, snakeKey, fallback) {
    return data[camelKey] ?? data[snakeKey] ?? fallback;
}

function normalizeStringArray(values) {
    if (!Array.isArray(values)) {
        return [];
    }

    return values
        .map(value => value?.toString?.() ?? '')
        .filter(Boolean);
}

function normalizeOptions(options) {
    if (!Array.isArray(options)) {
        return [];
    }

    return options.map((option, index) => {
        return {
            id: option?.id?.toString?.() ?? `${index}`,
            text: option?.text?.toString?.() ?? '',
            voteCount: Number(option?.voteCount ?? option?.vote_count ?? 0),
            voteRate: Number(option?.voteRate ?? option?.vote_rate ?? 0)
        };
    });
}

function normalizePollData(node) {
    const data = typeof node.getDataset === 'function' ? node.getDataset() : node;

    return {
        pollId: getValue(data, 'pollId', 'poll_id', ''),
        title: getValue(data, 'title', 'title', ''),
        description: getValue(data, 'description', 'description', ''),
        imageSrc: getValue(data, 'imageSrc', 'image_src', ''),
        expiresAt: getValue(data, 'expiresAt', 'expires_at', ''),
        pollType: getValue(data, 'pollType', 'poll_type', 'single'),
        status: getValue(data, 'status', 'status', 'draft'),
        answerRevealed: Boolean(getValue(data, 'answerRevealed', 'answer_revealed', false)),
        correctOptionIds: normalizeStringArray(getValue(data, 'correctOptionIds', 'correct_option_ids', [])),
        selectedOptionIds: normalizeStringArray(getValue(data, 'selectedOptionIds', 'selected_option_ids', [])),
        options: normalizeOptions(getValue(data, 'options', 'options', [])),
        totalVotes: Number(getValue(data, 'totalVotes', 'total_votes', 0))
    };
}

function buildOptionProgressWidth(value) {
    const percent = Math.max(0, Math.min(Number(value || 0), 100));

    if (percent <= 0) {
        return '0px';
    }

    if (percent >= 100) {
        return 'calc(100% - 36px)';
    }

    return `calc(${percent}% - ${(36 * percent / 100).toFixed(2)}px)`;
}

function renderPollNode(node, options = {}) {
    addCreateDocumentOption(options);
    const document = options.createDocument();
    const poll = normalizePollData(node);

    if (options.target === 'email') {
        return {element: document.createElement('div')};
    }

    if (!poll.pollId && !poll.title && !poll.description && poll.options.length === 0) {
        return renderEmptyContainer(document);
    }

    const card = document.createElement('div');
    card.classList.add('kg-card', 'kg-poll-card', 'not-kg-prose');
    card.setAttribute('data-kg-poll-card', 'true');
    card.setAttribute('data-kg-poll-state', 'published');
    card.setAttribute('data-kg-allow-clickthrough', 'false');
    card.setAttribute('data-poll-type', poll.pollType);
    card.setAttribute('data-poll-status', poll.status);
    card.setAttribute('data-poll-answer-revealed', String(poll.answerRevealed));
    card.setAttribute('data-total-votes', String(poll.totalVotes));

    if (poll.pollId) {
        card.setAttribute('data-poll-id', poll.pollId);
    }

    if (poll.expiresAt) {
        card.setAttribute('data-expires-at', poll.expiresAt);
    }

    if (poll.imageSrc) {
        const image = document.createElement('img');
        image.classList.add('kg-poll-card-image');
        image.setAttribute('src', poll.imageSrc);
        image.setAttribute('alt', poll.title || 'Poll cover');
        image.setAttribute('loading', 'lazy');
        card.appendChild(image);
    }

    const header = document.createElement('div');
    header.classList.add('kg-poll-card-header');

    if (poll.title) {
        const title = document.createElement('h3');
        title.classList.add('kg-poll-card-title');
        title.textContent = poll.title;
        header.appendChild(title);
    }

    card.appendChild(header);

    if (poll.description) {
        const description = document.createElement('p');
        description.classList.add('kg-poll-card-description');
        description.textContent = poll.description;
        card.appendChild(description);
    }

    /*
     * 选项 + 图表区域:
     * - 桌面端 (≥768px): 选项在左, 图表在右 (由 CSS order 控制)
     * - 移动端: 上下排列, 图表在上, 选项在下 (默认 flex-direction: column)
     *
     * SSR 阶段不画图表, 只放一个隐藏的占位 div; 客户端 poll.js 拉到 trends 接口
     * 真实数据后再 reveal 并填充 SVG, 避免 SSR 占位先闪一下再被覆盖.
     */
    const body = document.createElement('div');
    body.classList.add('kg-poll-card-body');

    if (poll.options.length > 0) {
        const chartWrap = document.createElement('div');
        chartWrap.classList.add('kg-poll-card-chart');
        chartWrap.setAttribute('hidden', 'hidden');
        body.appendChild(chartWrap);
    }

    const optionsContainer = document.createElement('div');
    optionsContainer.classList.add('kg-poll-card-options');

    for (const [index, option] of poll.options.entries()) {
        const optionElement = document.createElement('div');
        optionElement.classList.add('kg-poll-card-option');
        optionElement.setAttribute('data-option-id', option.id);
        optionElement.setAttribute('data-option-index', String(index));
        optionElement.setAttribute('data-vote-count', String(option.voteCount));
        optionElement.setAttribute('data-vote-rate', String(option.voteRate));
        optionElement.setAttribute('data-selected', String(poll.selectedOptionIds.includes(option.id)));
        optionElement.setAttribute('data-correct', String(poll.correctOptionIds.includes(option.id)));

        const fill = document.createElement('div');
        fill.classList.add('kg-poll-card-option-fill');
        fill.setAttribute('aria-hidden', 'true');
        fill.style.width = `${Math.max(0, Math.min(option.voteRate || 0, 100))}%`;
        optionElement.appendChild(fill);

        const optionContent = document.createElement('div');
        optionContent.classList.add('kg-poll-card-option-content');

        // 文字 + Result 徽章用一个 inline-flex 容器包起来, 这样在 option-content 的
        // space-between 布局里它们整体被推到左侧, 不会被 badge 拆到中间.
        const optionText = document.createElement('div');
        optionText.classList.add('kg-poll-card-option-text');

        const optionTextLabel = document.createElement('span');
        optionTextLabel.classList.add('kg-poll-card-option-text-label');
        optionTextLabel.textContent = option.text || `Option ${index + 1}`;
        optionText.appendChild(optionTextLabel);

        // Result 徽章 — 答案公布后, 正确选项的文字旁边会显示一个绿色 "Result" 标签.
        // 默认 hidden, CSS 在 [data-poll-answer-revealed="true"] + [data-correct="true"] 下显示.
        const resultBadge = document.createElement('span');
        resultBadge.classList.add('kg-poll-card-option-result-badge');
        resultBadge.setAttribute('aria-hidden', 'true');
        resultBadge.textContent = 'Result';
        optionText.appendChild(resultBadge);

        optionContent.appendChild(optionText);

        const optionResult = document.createElement('div');
        optionResult.classList.add('kg-poll-card-option-result');

        const correctIcon = document.createElement('span');
        correctIcon.classList.add('kg-poll-card-option-correct');
        correctIcon.setAttribute('aria-hidden', 'true');
        correctIcon.innerHTML = '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="currentColor"></circle><path d="M5.1 8.1 7 10l3.9-4" stroke="#000000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"></path></svg>';
        optionResult.appendChild(correctIcon);

        const optionRate = document.createElement('span');
        optionRate.classList.add('kg-poll-card-option-rate');
        optionRate.textContent = `${Number(option.voteRate || 0).toFixed(2)}%`;
        optionResult.appendChild(optionRate);

        optionContent.appendChild(optionResult);

        // 底部细进度条 — 始终渲染, 宽度跟 voteRate%. 颜色由 CSS 控:
        //   正确选项 -> #0caa27, 其它 -> rgba(255, 255, 255, 0.12).
        const optionProgress = document.createElement('div');
        optionProgress.classList.add('kg-poll-card-option-progress');
        optionProgress.setAttribute('aria-hidden', 'true');
        optionProgress.style.width = buildOptionProgressWidth(option.voteRate || 0);
        optionContent.appendChild(optionProgress);

        optionElement.appendChild(optionContent);

        optionsContainer.appendChild(optionElement);
    }

    body.appendChild(optionsContainer);
    card.appendChild(body);

    const meta = document.createElement('div');
    meta.classList.add('kg-poll-card-meta');

    const votes = document.createElement('div');
    votes.classList.add('kg-poll-card-votes');
    votes.textContent = `${new Intl.NumberFormat('en-US').format(Number(poll.totalVotes || 0))} Votes`;
    meta.appendChild(votes);

    const metaStatus = document.createElement('div');
    metaStatus.classList.add('kg-poll-card-meta-status');

    /*
     * 到期时间总是输出一个 hidden 的空占位 (不在这里填 lexical 节点里残留的 expiresAt).
     * 客户端 poll.js hydrate 后, 用 /members/api/polls/:id 返回的真实 expires_at 来决定:
     *   - 接口给到值 -> 填 span + 去掉 hidden
     *   - 接口空值 -> 保持 hidden
     * 这样刷新页面时不会先闪一下"旧的到期日"再被收掉.
     */
    const expires = document.createElement('div');
    expires.classList.add('kg-poll-card-expiry');
    expires.setAttribute('hidden', 'hidden');
    expires.innerHTML = '<svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.4"></circle><path d="M8 5v3.2l2 1.2" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.4"></path></svg><span></span>';
    metaStatus.appendChild(expires);

    const ended = document.createElement('span');
    ended.classList.add('kg-poll-card-ended');
    ended.textContent = 'Ended';
    if (!poll.answerRevealed) {
        ended.setAttribute('hidden', 'hidden');
    }
    metaStatus.appendChild(ended);

    meta.appendChild(metaStatus);

    card.appendChild(meta);

    const feedback = document.createElement('p');
    feedback.classList.add('kg-poll-card-feedback');
    feedback.setAttribute('hidden', 'hidden');
    card.appendChild(feedback);

    return {element: card};
}

module.exports = renderPollNode;
