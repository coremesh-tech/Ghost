const errors = require('@tryghost/errors');
const {KoenigDecoratorNode} = require('@tryghost/kg-default-nodes');
const renderPollNode = require('../../services/koenig/node-renderers/poll-renderer');

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

    return options.map((option) => {
        return {
            id: option?.id?.toString?.() ?? '',
            text: option?.text?.toString?.() ?? '',
            voteCount: Number(option?.voteCount ?? option?.vote_count ?? 0),
            voteRate: Number(option?.voteRate ?? option?.vote_rate ?? 0)
        };
    });
}

class PollNode extends KoenigDecoratorNode {
    constructor(data = {}, key) {
        super(key);

        this.__pollId = getValue(data, 'pollId', 'poll_id', '');
        this.__title = getValue(data, 'title', 'title', '');
        this.__description = getValue(data, 'description', 'description', '');
        this.__imageSrc = getValue(data, 'imageSrc', 'image_src', '');
        this.__expiresAt = getValue(data, 'expiresAt', 'expires_at', '');
        this.__pollType = getValue(data, 'pollType', 'poll_type', 'single');
        this.__status = getValue(data, 'status', 'status', 'draft');
        this.__answerRevealed = Boolean(getValue(data, 'answerRevealed', 'answer_revealed', false));
        this.__correctOptionIds = normalizeStringArray(getValue(data, 'correctOptionIds', 'correct_option_ids', []));
        this.__selectedOptionIds = normalizeStringArray(getValue(data, 'selectedOptionIds', 'selected_option_ids', []));
        this.__options = normalizeOptions(getValue(data, 'options', 'options', []));
        this.__totalVotes = Number(getValue(data, 'totalVotes', 'total_votes', 0));
        this.__version = Number(getValue(data, 'version', 'version', 1));
    }

    static getType() {
        return 'poll';
    }

    static clone(node) {
        return new PollNode(node.getDataset(), node.__key);
    }

    static importJSON(serializedNode) {
        return new PollNode(serializedNode);
    }

    getDataset() {
        return {
            pollId: this.__pollId,
            title: this.__title,
            description: this.__description,
            imageSrc: this.__imageSrc,
            expiresAt: this.__expiresAt,
            pollType: this.__pollType,
            status: this.__status,
            answerRevealed: this.__answerRevealed,
            correctOptionIds: [...this.__correctOptionIds],
            selectedOptionIds: [...this.__selectedOptionIds],
            options: this.__options.map(option => ({...option})),
            totalVotes: this.__totalVotes
        };
    }

    exportJSON() {
        return {
            type: 'poll',
            version: this.__version || 1,
            ...this.getDataset()
        };
    }

    exportDOM(options = {}) {
        const render = options.nodeRenderers?.poll || renderPollNode;

        if (typeof render === 'object') {
            const versionRenderer = render[this.__version || 1];

            if (!versionRenderer) {
                throw new errors.InternalServerError({
                    message: `[PollNode] Renderer for poll version ${this.__version || 1} is required`
                });
            }

            return versionRenderer(this, options);
        }

        return render(this, options);
    }

    isEmpty() {
        return false;
    }
}

module.exports = PollNode;
