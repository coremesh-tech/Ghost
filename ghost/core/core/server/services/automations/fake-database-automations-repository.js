"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFakeDatabaseAutomationsRepository = createFakeDatabaseAutomationsRepository;
const errors_1 = __importDefault(require("@tryghost/errors"));
const tpl_1 = __importDefault(require("@tryghost/tpl"));
const bson_objectid_1 = __importDefault(require("bson-objectid"));
const messages = {
    invalidAutomationActionRevision: 'Automation action "{actionId}" of type "{actionType}" is missing required revision field "{field}".',
    conflictingAutomationActionId: 'Automation action "{actionId}" already exists and cannot be inserted.',
    conflictingAutomationActionType: 'Automation action "{actionId}" already exists with a different type.'
};
function createFakeDatabaseAutomationsRepository({ getDatabase }) {
    return {
        async browse() {
            const database = getDatabase();
            return withTransaction(database, () => {
                const rows = loadAutomations(database).map(row => buildAutomationSummary(row));
                return {
                    data: rows,
                    meta: {
                        pagination: buildPagination(rows.length)
                    }
                };
            });
        },
        async getById(id) {
            const database = getDatabase();
            return withTransaction(database, () => {
                const automation = loadAutomation(database, id);
                if (!automation) {
                    return null;
                }
                return buildAutomation(database, automation);
            });
        },
        async edit(id, data) {
            const database = getDatabase();
            return withTransaction(database, () => {
                const automation = loadAutomation(database, id);
                if (!automation) {
                    return null;
                }
                const updatedAutomation = updateAutomation(database, {
                    ...automation,
                    status: data.status,
                    updated_at: new Date().toISOString()
                });
                replaceAutomationGraph(database, updatedAutomation.id, data.actions, data.edges);
                return buildAutomation(database, updatedAutomation);
            });
        }
    };
}
function withTransaction(database, operation) {
    database.exec('BEGIN TRANSACTION');
    try {
        const result = operation();
        database.exec('COMMIT');
        return result;
    }
    catch (error) {
        database.exec('ROLLBACK');
        throw error;
    }
}
function loadAutomation(database, automationId) {
    const automation = database.prepare(`
        SELECT id, slug, name, status, created_at, updated_at
        FROM automations
        WHERE id = ?
    `).get(automationId);
    return automation ?? null;
}
function loadAutomations(database) {
    return database.prepare(`
        SELECT id, slug, name, status, created_at, updated_at
        FROM automations
        ORDER BY created_at, id
    `).all();
}
function updateAutomation(database, automation) {
    database.prepare(`
        UPDATE automations
        SET status = :status,
            updated_at = :updated_at
        WHERE id = :id
    `).run({
        id: automation.id,
        status: automation.status,
        updated_at: automation.updated_at
    });
    return requireAutomation(loadAutomation(database, automation.id), automation.id);
}
function replaceAutomationGraph(database, automationId, actions, edges) {
    const existingActions = loadAutomationActionRows(database, automationId);
    const existingActionIds = new Set(existingActions.map(action => action.id));
    const submittedActionIds = new Set(actions.map(action => action.id));
    const now = new Date().toISOString();
    for (const action of actions) {
        if (existingActionIds.has(action.id)) {
            const existingAction = existingActions.find(({ id }) => id === action.id);
            if (existingAction?.type !== action.type) {
                throw new errors_1.default.ValidationError({
                    message: (0, tpl_1.default)(messages.conflictingAutomationActionType, {
                        actionId: action.id
                    }),
                    property: 'actions.type'
                });
            }
        }
        else {
            if (loadActionOwner(database, action.id)) {
                throw new errors_1.default.ValidationError({
                    message: (0, tpl_1.default)(messages.conflictingAutomationActionId, {
                        actionId: action.id
                    }),
                    property: 'actions.id'
                });
            }
            insertAction(database, {
                id: action.id,
                created_at: now,
                updated_at: now,
                automation_id: automationId,
                type: action.type
            });
        }
        // TODO (NY-1283): Deduplicate revisions before inserting them.
        insertActionRevision(database, action.id, action, now);
    }
    for (const existingAction of existingActions) {
        if (!submittedActionIds.has(existingAction.id)) {
            softDeleteAction(database, existingAction.id, now);
        }
    }
    deleteAutomationEdges(database, automationId);
    for (const edge of edges) {
        insertActionEdge(database, edge);
    }
}
function loadAutomationActionRows(database, automationId) {
    return database.prepare(`
        SELECT id, type
        FROM automation_actions
        WHERE automation_id = ?
            AND deleted_at IS NULL
    `).all(automationId);
}
function loadActionOwner(database, actionId) {
    const row = database.prepare(`
        SELECT automation_id
        FROM automation_actions
        WHERE id = ?
    `).get(actionId);
    return row?.automation_id ?? null;
}
function insertAction(database, action) {
    database.prepare(`
        INSERT INTO automation_actions
        (id, created_at, updated_at, automation_id, type) VALUES
        (:id, :created_at, :updated_at, :automation_id, :type)
    `).run(action);
}
function softDeleteAction(database, actionId, deletedAt) {
    database.prepare(`
        UPDATE automation_actions
        SET deleted_at = :deleted_at,
            updated_at = :updated_at
        WHERE id = :id
    `).run({
        id: actionId,
        deleted_at: deletedAt,
        updated_at: deletedAt
    });
}
function insertActionRevision(database, actionId, action, createdAt) {
    const revision = buildActionRevision(actionId, action, getNextRevisionCreatedAt(database, actionId, createdAt));
    database.prepare(`
        INSERT INTO automation_action_revisions
        (
            id,
            created_at,
            action_id,
            wait_hours,
            email_subject,
            email_lexical,
            email_sender_name,
            email_sender_email,
            email_sender_reply_to,
            email_design_setting_id
        ) VALUES (
            :id,
            :created_at,
            :action_id,
            :wait_hours,
            :email_subject,
            :email_lexical,
            :email_sender_name,
            :email_sender_email,
            :email_sender_reply_to,
            :email_design_setting_id
        )
    `).run(revision);
}
function getNextRevisionCreatedAt(database, actionId, requestedCreatedAt) {
    const row = database.prepare(`
        SELECT MAX(created_at) AS created_at
        FROM automation_action_revisions
        WHERE action_id = ?
    `).get(actionId);
    if (!row?.created_at) {
        return requestedCreatedAt;
    }
    const requestedTime = new Date(requestedCreatedAt).getTime();
    const latestTime = new Date(row.created_at).getTime();
    if (requestedTime > latestTime) {
        return requestedCreatedAt;
    }
    return new Date(latestTime + 1).toISOString();
}
function buildActionRevision(actionId, action, createdAt) {
    if (action.type === 'wait') {
        return {
            id: (0, bson_objectid_1.default)().toString(),
            created_at: createdAt,
            action_id: actionId,
            wait_hours: action.data.wait_hours,
            email_subject: null,
            email_lexical: null,
            email_sender_name: null,
            email_sender_email: null,
            email_sender_reply_to: null,
            email_design_setting_id: null
        };
    }
    return {
        id: (0, bson_objectid_1.default)().toString(),
        created_at: createdAt,
        action_id: actionId,
        wait_hours: null,
        email_subject: action.data.email_subject,
        email_lexical: action.data.email_lexical,
        email_sender_name: action.data.email_sender_name,
        email_sender_email: action.data.email_sender_email,
        email_sender_reply_to: action.data.email_sender_reply_to,
        email_design_setting_id: action.data.email_design_setting_id
    };
}
function deleteAutomationEdges(database, automationId) {
    database.prepare(`
        DELETE FROM automation_action_edges
        WHERE source_action_id IN (
            SELECT id
            FROM automation_actions
            WHERE automation_id = ?
        )
    `).run(automationId);
}
function insertActionEdge(database, edge) {
    database.prepare(`
        INSERT INTO automation_action_edges
        (source_action_id, target_action_id) VALUES
        (:source_action_id, :target_action_id)
    `).run({
        source_action_id: edge.source_action_id,
        target_action_id: edge.target_action_id
    });
}
function requireAutomation(automation, id) {
    if (!automation) {
        throw new errors_1.default.InternalServerError({
            message: `Updated automation "${id}" could not be loaded.`
        });
    }
    return automation;
}
function buildAutomation(database, automation) {
    return {
        ...buildAutomationSummary(automation),
        actions: loadActionRows(database, automation.id).map(row => buildActionPayload(row)),
        edges: loadEdgeRows(database, automation.id).map(row => buildEdgePayload(row))
    };
}
function buildAutomationSummary(automation) {
    return {
        id: automation.id,
        slug: automation.slug,
        name: automation.name,
        status: automation.status,
        created_at: serializeDate(automation.created_at),
        updated_at: serializeDate(automation.updated_at)
    };
}
function serializeDate(date) {
    const normalizedDate = new Date(date);
    normalizedDate.setMilliseconds(0);
    return normalizedDate.toISOString();
}
function loadActionRows(database, automationId) {
    return database.prepare(`
        SELECT
            a.id AS id,
            a.type AS type,
            r.wait_hours AS wait_hours,
            r.email_subject AS email_subject,
            r.email_lexical AS email_lexical,
            r.email_sender_name AS email_sender_name,
            r.email_sender_email AS email_sender_email,
            r.email_sender_reply_to AS email_sender_reply_to,
            r.email_design_setting_id AS email_design_setting_id
        FROM automation_actions a
        INNER JOIN automation_action_revisions r ON r.action_id = a.id
        WHERE a.automation_id = ?
            AND a.deleted_at IS NULL
            AND r.created_at = (
                SELECT MAX(created_at)
                FROM automation_action_revisions
                WHERE action_id = a.id
            )
        ORDER BY a.created_at, a.id
    `).all(automationId);
}
function loadEdgeRows(database, automationId) {
    return database.prepare(`
        SELECT e.source_action_id, e.target_action_id
        FROM automation_action_edges e
        INNER JOIN automation_actions source_action ON source_action.id = e.source_action_id
            AND source_action.deleted_at IS NULL
        INNER JOIN automation_actions target_action ON target_action.id = e.target_action_id
            AND target_action.deleted_at IS NULL
            AND target_action.automation_id = source_action.automation_id
        WHERE source_action.automation_id = ?
        ORDER BY e.source_action_id, e.target_action_id
    `).all(automationId);
}
function buildActionPayload(row) {
    switch (row.type) {
        case 'wait':
            return {
                id: row.id,
                type: 'wait',
                data: {
                    wait_hours: requireValue(row, 'wait_hours')
                }
            };
        case 'send_email':
            return {
                id: row.id,
                type: 'send_email',
                data: {
                    email_subject: requireValue(row, 'email_subject'),
                    email_lexical: requireValue(row, 'email_lexical'),
                    email_sender_name: row.email_sender_name,
                    email_sender_email: row.email_sender_email,
                    email_sender_reply_to: row.email_sender_reply_to,
                    email_design_setting_id: requireValue(row, 'email_design_setting_id')
                }
            };
    }
}
function requireValue(row, field) {
    const value = row[field];
    if (value === null) {
        throw new errors_1.default.InternalServerError({
            message: (0, tpl_1.default)(messages.invalidAutomationActionRevision, {
                actionId: row.id,
                actionType: row.type,
                field
            })
        });
    }
    return value;
}
function buildEdgePayload(edge) {
    return {
        source_action_id: edge.source_action_id,
        target_action_id: edge.target_action_id
    };
}
function buildPagination(total) {
    return {
        page: 1,
        pages: 1,
        limit: 'all',
        total,
        prev: null,
        next: null
    };
}
