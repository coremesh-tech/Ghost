const {createAddColumnMigration} = require('../../utils');

// RATUS: Google 登录 —— 存 Google 账号的稳定标识 (id_token 的 sub)。
// 只按邮箱认人的话,用户在 Google 侧改了邮箱就会被当成新用户再建一个会员。
module.exports = createAddColumnMigration('members', 'google_sub', {
    type: 'string',
    maxlength: 191,
    nullable: true,
    unique: true
});
