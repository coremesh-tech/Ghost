const {createAddColumnMigration} = require('../../utils');

// pm.org 分层订阅:newsletter 记录哪些 pages 的订阅者归属到本 newsletter(JSON 数组文本)
module.exports = createAddColumnMigration('newsletters', 'subscription_pages', {
    type: 'text',
    maxlength: 65535,
    nullable: true
});
