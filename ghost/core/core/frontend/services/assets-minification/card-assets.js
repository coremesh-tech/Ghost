const debug = require('@tryghost/debug')('card-assets');
const _ = require('lodash');
const path = require('path');
const config = require('../../../shared/config');
const Minifier = require('./minifier');
const AssetsMinificationBase = require('./assets-minification-base');

const CARD_JS_DEPENDENCIES = {};
const EXCLUDED_CARD_JS = ['poll-lightweight-charts'];

module.exports = class CardAssets extends AssetsMinificationBase {
    constructor(options = {}) {
        super(options);

        this.src = options.src || path.join(config.get('paths').assetSrc, 'cards');
        this.dest = options.dest || config.getContentPath('public');
        this.minifier = new Minifier({src: this.src, dest: this.dest});

        if ('config' in options) {
            this.config = options.config;
        }

        this.files = [];
    }

    /**
     * @override
     */
    generateGlobs() {
        // CASE: The theme has asked for all card assets to be included by default
        if (this.config === true) {
            return {
                'cards.min.css': 'css/*.css',
                'cards.min.js': `js/!(${EXCLUDED_CARD_JS.join('|')}).js`
            };
        }

        // CASE: the theme has declared an include directive, we should include exactly these assets
        // Include rules take precedence over exclude rules.
        if (_.has(this.config, 'include')) {
            const include = this.expandCardNames(this.config.include);
            return {
                'cards.min.css': `css/@(${this.config.include.join('|')}).css`,
                'cards.min.js': `js/@(${include.join('|')}).js`
            };
        }

        // CASE: the theme has declared an exclude directive, we should include exactly these assets
        if (_.has(this.config, 'exclude')) {
            const exclude = this.expandCardNames(this.config.exclude);
            const excludeJs = Array.from(new Set([...exclude, ...EXCLUDED_CARD_JS]));
            return {
                'cards.min.css': `css/!(${this.config.exclude.join('|')}).css`,
                'cards.min.js': `js/!(${excludeJs.join('|')}).js`
            };
        }

        // CASE: theme has asked that no assets be included
        // CASE: we didn't understand config, don't do anything
        return {};
    }

    expandCardNames(names = []) {
        const expanded = new Set(names);

        for (const name of names) {
            const dependencies = CARD_JS_DEPENDENCIES[name] || [];

            for (const dependency of dependencies) {
                expanded.add(dependency);
            }
        }

        return Array.from(expanded);
    }

    hasFile(type) {
        if (this.files.length) {
            return this.files.indexOf(`cards.min.${type}`) > -1;
        }

        return Object.keys(this.generateGlobs()).indexOf(`cards.min.${type}`) > -1;
    }

    invalidate(cardAssetConfig) {
        if (cardAssetConfig) {
            this.config = cardAssetConfig;
        }

        return super.invalidate();
    }

    /**
     * A theme can declare which cards it supports, and we'll do the rest
     *
     * @override
     */
    async load(cardAssetConfig) {
        if (cardAssetConfig) {
            this.config = cardAssetConfig;
        }

        debug('loading with config', this.config);

        const globs = this.generateGlobs();

        debug('globs', globs);

        this.files = await this.minify(globs) || [];
    }
};
