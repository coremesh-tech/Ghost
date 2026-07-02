const {createAddColumnMigration} = require('../../utils');

// pm.org 分类 tag:给 tags 增加体裁子类字段 subgroup(syndicated/original,仅 type=genre 有意义)
module.exports = createAddColumnMigration('tags', 'subgroup', {
    type: 'string',
    maxlength: 50,
    nullable: true
});
