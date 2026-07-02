const {createAddColumnMigration} = require('../../utils');

// pm.org 分类 tag:给 tags 增加分类维度字段 type(genre/segment/topic/function)
module.exports = createAddColumnMigration('tags', 'type', {
    type: 'string',
    maxlength: 50,
    nullable: true
});
