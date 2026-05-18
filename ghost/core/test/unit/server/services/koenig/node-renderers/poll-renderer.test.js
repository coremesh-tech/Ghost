const assert = require('node:assert/strict');
const config = require('../../../../../../core/shared/config');
const {callRenderer} = require('../test-utils');

describe('services/koenig/node-renderers/poll-renderer', function () {
    function getTestData(overrides = {}) {
        return {
            pollId: 'poll_123',
            title: 'What should we ship next?',
            description: 'Choose the feature you want first.',
            imageSrc: 'https://example.com/poll.jpg',
            expiresAt: '2026-06-01T12:00:00.000Z',
            pollType: 'single',
            status: 'published',
            answerRevealed: false,
            correctOptionIds: [],
            selectedOptionIds: ['option_b'],
            options: [
                {id: 'option_a', text: 'Native polls', voteCount: 8, voteRate: 40},
                {id: 'option_b', text: 'Theme hydration', voteCount: 12, voteRate: 60}
            ],
            totalVotes: 20,
            ...overrides
        };
    }

    function renderForWeb(data, options) {
        return callRenderer('poll', data, options);
    }

    function renderForEmail(data, options) {
        return callRenderer('poll', data, {...options, target: 'email'});
    }

    describe('web', function () {
        it('renders a poll card with cover image, header, description, options and meta', function () {
            const result = renderForWeb(getTestData());
            const card = result.element;

            assert.ok(card, 'returns a card element');
            assert.equal(card.tagName.toLowerCase(), 'div');
            assert.ok(card.classList.contains('kg-card'));
            assert.ok(card.classList.contains('kg-poll-card'));
            assert.ok(card.classList.contains('not-kg-prose'));
            assert.equal(card.getAttribute('data-kg-poll-card'), 'true');
            assert.equal(card.getAttribute('data-poll-id'), 'poll_123');
            assert.equal(card.getAttribute('data-poll-type'), 'single');
            assert.equal(card.getAttribute('data-poll-status'), 'published');
            assert.equal(card.getAttribute('data-poll-answer-revealed'), 'false');
            assert.equal(card.getAttribute('data-total-votes'), '20');
            assert.equal(card.getAttribute('data-expires-at'), '2026-06-01T12:00:00.000Z');
            assert.equal(
                card.getAttribute('data-prediction-markets-api-url'),
                config.get('PREDICTIONMARKETS_API_URL')
            );

            const image = card.querySelector('.kg-poll-card-image');
            assert.ok(image, 'image is rendered');
            assert.equal(image.getAttribute('src'), 'https://example.com/poll.jpg');
            assert.equal(image.getAttribute('alt'), 'What should we ship next?');

            const title = card.querySelector('.kg-poll-card-title');
            assert.ok(title);
            assert.equal(title.textContent, 'What should we ship next?');

            const description = card.querySelector('.kg-poll-card-description');
            assert.ok(description);
            assert.equal(description.textContent, 'Choose the feature you want first.');

            // 选项区块结构保持不变 (内容/属性)
            const options = card.querySelectorAll('.kg-poll-card-option');
            assert.equal(options.length, 2);

            assert.equal(options[0].getAttribute('data-option-id'), 'option_a');
            assert.equal(options[0].getAttribute('data-vote-rate'), '40');
            assert.equal(options[0].getAttribute('data-selected'), 'false');
            assert.equal(
                options[0].querySelector('.kg-poll-card-option-text-label').textContent,
                'Native polls'
            );
            assert.equal(
                options[0].querySelector('.kg-poll-card-option-rate').textContent,
                '40.00%'
            );
            assert.equal(
                options[0].querySelector('.kg-poll-card-option-fill').style.width,
                '40%'
            );
            assert.equal(
                options[0].querySelector('.kg-poll-card-option-progress').parentElement.className,
                'kg-poll-card-option-content'
            );
            assert.equal(
                options[0].querySelector('.kg-poll-card-option-progress').style.width,
                'calc(40% - 14.4px)'
            );
            // Result 徽章占位永远在 DOM 里, 由 CSS 在 [data-poll-answer-revealed][data-correct] 下显示
            assert.equal(
                options[0].querySelector('.kg-poll-card-option-result-badge').textContent,
                'Result'
            );

            assert.equal(options[1].getAttribute('data-option-id'), 'option_b');
            assert.equal(options[1].getAttribute('data-vote-rate'), '60');
            assert.equal(options[1].getAttribute('data-selected'), 'true');
            assert.equal(
                options[1].querySelector('.kg-poll-card-option-text-label').textContent,
                'Theme hydration'
            );
            assert.equal(
                options[1].querySelector('.kg-poll-card-option-rate').textContent,
                '60.00%'
            );

            // meta + feedback 仍存在
            assert.equal(card.querySelector('.kg-poll-card-votes').textContent, '20 Votes');

            // expiry 占位现在 SSR 一律 hidden + 空 span (避免刷新时闪一段旧日期), 等客户端 hydrate
            const expiry = card.querySelector('.kg-poll-card-expiry');
            assert.ok(expiry, 'expiry placeholder is always rendered');
            assert.equal(expiry.getAttribute('hidden'), 'hidden');
            assert.equal(expiry.querySelector('span').textContent, '');

            const metaStatus = card.querySelector('.kg-poll-card-meta-status');
            assert.ok(metaStatus, 'expiry and ended are wrapped together');
            assert.equal(metaStatus.querySelector('.kg-poll-card-expiry'), expiry);

            const ended = card.querySelector('.kg-poll-card-ended');
            assert.ok(ended, 'ended label placeholder is rendered');
            assert.equal(ended.textContent, 'Ended');
            assert.equal(ended.getAttribute('hidden'), 'hidden');

            assert.ok(card.querySelector('.kg-poll-card-feedback'));
            assert.equal(card.querySelector('.kg-poll-card-feedback').getAttribute('hidden'), 'hidden');
        });

        it('shows the ended label in SSR when the answer has already been revealed', function () {
            const result = renderForWeb(getTestData({
                answerRevealed: true
            }));
            const ended = result.element.querySelector('.kg-poll-card-ended');

            assert.ok(ended);
            assert.equal(ended.hasAttribute('hidden'), false);
        });

        it('wraps the trend chart and options inside a body container with the chart first', function () {
            const result = renderForWeb(getTestData());
            const card = result.element;

            // 新的 body 包了 chart + options, chart 在 DOM 顺序的最前面
            const body = card.querySelector('.kg-poll-card-body');
            assert.ok(body, 'body wrapper exists');

            const children = Array.from(body.children);
            assert.equal(children.length, 2, 'body has exactly chart + options as children');
            assert.ok(
                children[0].classList.contains('kg-poll-card-chart'),
                'first child is chart (rendered on the left of options on desktop)'
            );
            assert.ok(
                children[1].classList.contains('kg-poll-card-options'),
                'second child is options'
            );
        });

        it('renders an empty hidden chart shell and waits for real trends data on the client', function () {
            const result = renderForWeb(getTestData());
            const card = result.element;

            const chart = card.querySelector('.kg-poll-card-chart');
            assert.ok(chart);
            assert.equal(chart.getAttribute('hidden'), 'hidden');
            assert.equal(chart.children.length, 0, 'server should not render fake chart contents');
        });

        it('renders nothing meaningful when all poll content is missing', function () {
            const result = renderForWeb(getTestData({
                pollId: '',
                title: '',
                description: '',
                options: []
            }));

            assert.equal(result.html, '');
        });
    });

    describe('email', function () {
        it('renders empty div in email', function () {
            const result = renderForEmail(getTestData());
            assert.equal(result.html, '<div></div>');
        });
    });
});
