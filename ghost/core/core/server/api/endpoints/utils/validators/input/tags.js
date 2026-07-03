const jsonSchema = require('../utils/json-schema');
const adminApiSchema = require('@tryghost/admin-api-schema');

// pm.org 自定义分类 tag 字段(type / subgroup)。
//
// @tryghost/admin-api-schema 是已发布的 npm 包,其 `tags` 定义用
// additionalProperties:false,配合 ajv 的 removeAdditional,会把这两个未知字段
// 在输入校验阶段静默剥掉,导致落库为 NULL。
//
// 早先靠 pnpm patch 给包内的 tags.json 打补丁,但发布打包(scripts/pack.js →
// ghost-cli / Docker 安装)会丢掉 patch,生产/测试装到的是原版包,补丁失效。
// 这里改为在源码运行时向缓存的 schema 定义注入这两个字段:随源码走,打包与
// `ghost update` 都不会丢。
//
// 原理:adminApiSchema.get('tags') 与包内校验路径都是 require('./schemas/tags'),
// 命中同一个模块缓存对象,故此处的修改对后续校验生效。ajv 按 $id 缓存已编译
// schema、且 `tags` 定义在首次 tag 校验时才 addSchema;本文件在服务启动、任何
// tag 请求之前即被加载,注入早于首次编译,安全。幂等:已存在则跳过。
(function injectTagCustomFields() {
    const tagsDefinition = adminApiSchema.get('tags');
    const properties = tagsDefinition
        && tagsDefinition.definitions
        && tagsDefinition.definitions.tag
        && tagsDefinition.definitions.tag.properties;

    if (properties && !properties.type) {
        properties.type = {
            type: ['string', 'null'],
            enum: ['genre', 'segment', 'topic', 'function', null]
        };
        properties.subgroup = {
            type: ['string', 'null'],
            enum: ['syndicated', 'original', null]
        };
    }
})();

module.exports = {
    add: jsonSchema.validate,
    edit: jsonSchema.validate
};
