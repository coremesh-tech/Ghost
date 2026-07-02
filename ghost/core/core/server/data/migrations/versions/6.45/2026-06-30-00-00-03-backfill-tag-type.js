const {createTransactionalMigration} = require('../../utils');
const logging = require('@tryghost/logging');

// pm.org 分类 tag:按已知 slug 回填 type / subgroup。
// 未覆盖的历史 tag 保持 type=null(前台按普通 tag 渲染),不阻塞。
const SEGMENTS = ['economics-finance', 'politics', 'tech', 'pop-culture'];
const TOPICS = ['ai', 'semiconductor'];
const FUNCTIONS = ['semi-subpage-teach-in'];
const GENRE_SYNDICATED = ['news-flash', 'news'];
const GENRE_ORIGINAL = ['exclusive-news', 'quick-take', 'editorial', 'analysis', 'features', 'profile'];

const ALL = [
    ...SEGMENTS, ...TOPICS, ...FUNCTIONS, ...GENRE_SYNDICATED, ...GENRE_ORIGINAL
];

module.exports = createTransactionalMigration(
    async function up(knex) {
        logging.info('Backfilling tags.type / subgroup by known slugs');

        await knex('tags').whereIn('slug', SEGMENTS).update({type: 'segment'});
        await knex('tags').whereIn('slug', TOPICS).update({type: 'topic'});
        await knex('tags').whereIn('slug', FUNCTIONS).update({type: 'function'});
        await knex('tags').whereIn('slug', GENRE_SYNDICATED).update({type: 'genre', subgroup: 'syndicated'});
        await knex('tags').whereIn('slug', GENRE_ORIGINAL).update({type: 'genre', subgroup: 'original'});
    },
    async function down(knex) {
        logging.info('Clearing backfilled tags.type / subgroup');
        await knex('tags').whereIn('slug', ALL).update({type: null, subgroup: null});
    }
);
