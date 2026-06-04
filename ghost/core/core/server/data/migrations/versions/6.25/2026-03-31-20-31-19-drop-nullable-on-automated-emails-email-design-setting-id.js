const {createDropNullableMigration} = require('../../utils');

// MySQL cannot change nullability on a foreign-key column unless foreign key checks
// are temporarily disabled for the session. Other similar migrations in Ghost use the
// same escape hatch for FK-backed columns.
module.exports = createDropNullableMigration('automated_emails', 'email_design_setting_id', {disableForeignKeyChecks: true});
