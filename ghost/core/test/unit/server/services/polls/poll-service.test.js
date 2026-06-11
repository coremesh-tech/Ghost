const assert = require('node:assert/strict');
const {buildPollViewerHeaders, extractPollNodeFromLexical, normalizePollNode} = require('../../../../../core/server/services/polls/poll-service');

describe('services/polls/poll-service', function () {
    it('builds prediction market viewer headers from a member session', function () {
        const headers = buildPollViewerHeaders({
            uuid: 'member_123',
            name: 'Ghost Member',
            email: 'member@example.com'
        });

        assert.deepEqual(headers, {
            'X-User-Id': 'member_123',
            'X-User-Name': 'Ghost Member',
            'X-User-Role': 'member',
            'X-User-Email': 'member@example.com'
        });
    });

    it('normalizes poll node data', function () {
        const poll = normalizePollNode({
            poll_id: 'poll_123',
            title: 'Question',
            description: 'Description',
            image_src: 'https://example.com/poll.jpg',
            expires_at: '2026-06-01T12:00:00.000Z',
            poll_type: 'single',
            status: 'published',
            answer_revealed: false,
            correct_option_ids: ['a'],
            selected_option_ids: ['b'],
            options: [
                {id: 'a', text: 'Yes', vote_count: 8, vote_rate: 40},
                {id: 'b', text: 'No', vote_count: 12, vote_rate: 60}
            ],
            total_votes: 20
        });

        assert.deepEqual(poll, {
            pollId: 'poll_123',
            title: 'Question',
            description: 'Description',
            imageSrc: 'https://example.com/poll.jpg',
            expiresAt: '2026-06-01T12:00:00.000Z',
            pollType: 'single',
            status: 'published',
            answerRevealed: false,
            correctOptionIds: ['a'],
            selectedOptionIds: ['b'],
            options: [
                {id: 'a', text: 'Yes', voteCount: 8, voteRate: 40, sortOrder: 0},
                {id: 'b', text: 'No', voteCount: 12, voteRate: 60, sortOrder: 1}
            ],
            totalVotes: 20
        });
    });

    it('extracts a poll node from lexical by poll id', function () {
        const lexical = JSON.stringify({
            root: {
                children: [
                    {type: 'paragraph', version: 1, children: []},
                    {
                        type: 'poll',
                        version: 1,
                        pollId: 'poll_123',
                        title: 'Question',
                        description: '',
                        imageSrc: '',
                        expiresAt: '',
                        pollType: 'single',
                        status: 'published',
                        answerRevealed: false,
                        correctOptionIds: [],
                        selectedOptionIds: [],
                        options: [
                            {id: 'a', text: 'Yes', voteCount: 8, voteRate: 40},
                            {id: 'b', text: 'No', voteCount: 12, voteRate: 60}
                        ],
                        totalVotes: 20
                    }
                ]
            }
        });

        const poll = extractPollNodeFromLexical(lexical, 'poll_123');

        assert.equal(poll.pollId, 'poll_123');
        assert.equal(poll.title, 'Question');
        assert.equal(poll.options.length, 2);
        assert.equal(poll.totalVotes, 20);
    });
});
