const assert = require('node:assert/strict');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');

const googleAuth = require('../../../../../core/server/services/members/google-auth');
const settingsHelpers = require('../../../../../core/server/services/settings-helpers');
const configUtils = require('../../../../utils/config-utils');

const CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
const STATE_SECRET = 'a-members-validation-key';

const makeIdToken = (overrides = {}) => {
    const payload = Object.assign({
        iss: 'https://accounts.google.com',
        aud: CLIENT_ID,
        exp: Math.floor(Date.now() / 1000) + 600,
        email: 'Jamie@Example.com',
        email_verified: true,
        name: 'Jamie',
        sub: '1234567890',
        nonce: 'the-nonce'
    }, overrides);

    // 我们只 decode 不验签(id_token 是服务端直连 Google token 端点换来的),
    // 所以这里用什么密钥签都行
    return jwt.sign(payload, 'irrelevant');
};

describe('Members Google auth', function () {
    beforeEach(function () {
        sinon.stub(settingsHelpers, 'getMembersValidationKey').returns(STATE_SECRET);
    });

    afterEach(async function () {
        sinon.restore();
        await configUtils.restore();
    });

    describe('isEnabled', function () {
        it('is off unless enabled and fully configured', async function () {
            assert.equal(googleAuth.isEnabled(), false);

            await configUtils.set('members:googleAuth', {enabled: true, clientId: CLIENT_ID});
            assert.equal(googleAuth.isEnabled(), false, 'missing clientSecret should keep it off');

            await configUtils.set('members:googleAuth', {
                enabled: true,
                clientId: CLIENT_ID,
                clientSecret: 'shh'
            });
            assert.equal(googleAuth.isEnabled(), true);
        });
    });

    describe('state', function () {
        it('round-trips redirect + popup + nonce', function () {
            const {state, nonce} = googleAuth.createState({redirect: '/some/post/', popup: true});
            const decoded = googleAuth.verifyState(state);

            assert.equal(decoded.r, '/some/post/');
            assert.equal(decoded.popup, true);
            assert.equal(decoded.nonce, nonce);
        });

        it('rejects a tampered state', function () {
            const {state} = googleAuth.createState({redirect: '/x/'});
            assert.throws(() => googleAuth.verifyState(`${state}tampered`));
        });

        it('rejects a state signed with another key', function () {
            const foreign = jwt.sign({nonce: 'x', r: '/', popup: false}, 'another-key', {expiresIn: 60});
            assert.throws(() => googleAuth.verifyState(foreign));
        });
    });

    describe('getAuthorizationUrl', function () {
        it('includes the params Google needs', async function () {
            await configUtils.set('members:googleAuth', {
                enabled: true,
                clientId: CLIENT_ID,
                clientSecret: 'shh'
            });

            const url = new URL(googleAuth.getAuthorizationUrl({
                state: 'the-state',
                nonce: 'the-nonce',
                callbackUrl: 'https://example.com/members/api/auth/google/callback'
            }));

            assert.equal(url.searchParams.get('client_id'), CLIENT_ID);
            assert.equal(url.searchParams.get('response_type'), 'code');
            assert.equal(url.searchParams.get('state'), 'the-state');
            assert.equal(url.searchParams.get('nonce'), 'the-nonce');
            assert.equal(url.searchParams.get('prompt'), 'select_account');
            assert.equal(
                url.searchParams.get('redirect_uri'),
                'https://example.com/members/api/auth/google/callback'
            );
        });
    });

    describe('getCallbackUrl', function () {
        const fakeReq = (host, protocol = 'https') => ({
            get: header => (header === 'host' ? host : undefined),
            protocol
        });

        beforeEach(async function () {
            await configUtils.set('url', 'https://www.predictionmarkets.org');
            await configUtils.set('alternativeDomains', ['www.informarket.org']);
        });

        it('derives from the request host when it is the site host or an alternative domain', async function () {
            await configUtils.set('members:googleAuth', {enabled: true, clientId: CLIENT_ID, clientSecret: 'shh', callbackUrl: ''});

            assert.equal(
                googleAuth.getCallbackUrl(fakeReq('www.informarket.org')),
                'https://www.informarket.org/members/api/auth/google/callback'
            );
            assert.equal(
                googleAuth.getCallbackUrl(fakeReq('localhost:2368', 'http')),
                'http://localhost:2368/members/api/auth/google/callback'
            );
        });

        it('falls back to the site url for hosts outside the allowlist', async function () {
            await configUtils.set('members:googleAuth', {enabled: true, clientId: CLIENT_ID, clientSecret: 'shh', callbackUrl: ''});

            assert.equal(
                googleAuth.getCallbackUrl(fakeReq('evil.example.com')),
                'https://www.predictionmarkets.org/members/api/auth/google/callback'
            );
        });

        it('picks the matching entry from a configured list, defaulting to the first', async function () {
            await configUtils.set('members:googleAuth', {
                enabled: true,
                clientId: CLIENT_ID,
                clientSecret: 'shh',
                callbackUrl: [
                    'https://www.predictionmarkets.org/members/api/auth/google/callback',
                    'https://www.informarket.org/members/api/auth/google/callback'
                ]
            });

            assert.equal(
                googleAuth.getCallbackUrl(fakeReq('www.informarket.org')),
                'https://www.informarket.org/members/api/auth/google/callback'
            );
            assert.equal(
                googleAuth.getCallbackUrl(fakeReq('unknown.example.com')),
                'https://www.predictionmarkets.org/members/api/auth/google/callback'
            );
        });

        it('uses a configured string verbatim', async function () {
            await configUtils.set('members:googleAuth', {
                enabled: true,
                clientId: CLIENT_ID,
                clientSecret: 'shh',
                callbackUrl: 'https://localhost/members/api/auth/google/callback'
            });

            assert.equal(
                googleAuth.getCallbackUrl(fakeReq('www.informarket.org')),
                'https://localhost/members/api/auth/google/callback'
            );
        });
    });

    describe('decodeAndValidateIdToken', function () {
        beforeEach(async function () {
            await configUtils.set('members:googleAuth', {
                enabled: true,
                clientId: CLIENT_ID,
                clientSecret: 'shh'
            });
        });

        it('returns a normalised profile for a valid token', function () {
            const profile = googleAuth.decodeAndValidateIdToken(makeIdToken(), 'the-nonce');

            assert.equal(profile.email, 'jamie@example.com', 'email should be lowercased');
            assert.equal(profile.name, 'Jamie');
            assert.equal(profile.sub, '1234567890');
        });

        it('rejects an unverified email', function () {
            assert.throws(
                () => googleAuth.decodeAndValidateIdToken(makeIdToken({email_verified: false}), 'the-nonce'),
                /not verified/
            );
        });

        it('rejects a token for another client', function () {
            assert.throws(
                () => googleAuth.decodeAndValidateIdToken(makeIdToken({aud: 'someone-else'}), 'the-nonce'),
                /audience/
            );
        });

        it('rejects an unexpected issuer', function () {
            assert.throws(
                () => googleAuth.decodeAndValidateIdToken(makeIdToken({iss: 'https://evil.example'}), 'the-nonce'),
                /issuer/
            );
        });

        it('rejects an expired token', function () {
            const exp = Math.floor(Date.now() / 1000) - 10;
            assert.throws(
                () => googleAuth.decodeAndValidateIdToken(makeIdToken({exp}), 'the-nonce'),
                /Expired/
            );
        });

        it('rejects a nonce mismatch', function () {
            assert.throws(
                () => googleAuth.decodeAndValidateIdToken(makeIdToken(), 'a-different-nonce'),
                /Nonce mismatch/
            );
        });

        it('rejects a token with no email', function () {
            assert.throws(
                () => googleAuth.decodeAndValidateIdToken(makeIdToken({email: undefined}), 'the-nonce'),
                /no email/
            );
        });
    });
});
