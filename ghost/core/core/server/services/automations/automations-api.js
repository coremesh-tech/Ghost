"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.browse = browse;
exports.read = read;
exports.edit = edit;
exports.requestPoll = requestPoll;
exports._resetTestDatabase = _resetTestDatabase;
/* eslint-disable @typescript-eslint/no-require-imports */
const errors_1 = __importDefault(require("@tryghost/errors"));
const tpl_1 = __importDefault(require("@tryghost/tpl"));
const bson_objectid_1 = __importDefault(require("bson-objectid"));
const zod_1 = require("zod");
const fake_database_automations_repository_1 = require("./fake-database-automations-repository");
const domainEvents = require('@tryghost/domain-events');
const StartAutomationsPollEvent = require('./events/start-automations-poll-event');
const temporaryFakeAutomationsDatabase = require('./temporary-fake-database');
const MAX_AUTOMATION_ACTIONS = 20;
const messages = {
    automationNotFound: 'Automation not found.',
    invalidAutomationPayload: 'Automation edit payload must include status, actions, and edges.',
    invalidAutomationStatus: 'Automation status must be one of: active, inactive.',
    duplicateAutomationActionIdentity: 'Automation action identifiers must be unique.',
    invalidAutomationEdgeEndpoint: 'Automation edges must reference actions in the submitted graph.',
    duplicateAutomationEdge: 'Automation edges must be unique.',
    invalidAutomationEdge: 'Automation edges cannot connect an action to itself.',
    invalidAutomationGraphShape: 'Automation graph must be a single linear path without branches or cycles.'
};
const objectIdSchema = zod_1.z.string().refine(value => bson_objectid_1.default.isValid(value));
const waitActionSchema = zod_1.z.object({
    id: objectIdSchema,
    type: zod_1.z.literal('wait'),
    data: zod_1.z.object({
        wait_hours: zod_1.z.number().int().positive()
    }).strict()
}).strict();
const sendEmailActionSchema = zod_1.z.object({
    id: objectIdSchema,
    type: zod_1.z.literal('send_email'),
    data: zod_1.z.object({
        email_subject: zod_1.z.string().min(1),
        email_lexical: zod_1.z.string().refine((value) => {
            try {
                JSON.parse(value);
                return true;
            }
            catch {
                return false;
            }
        }),
        email_sender_name: zod_1.z.string().nullable(),
        email_sender_email: zod_1.z.string().nullable(),
        email_sender_reply_to: zod_1.z.string().nullable(),
        email_design_setting_id: zod_1.z.string().min(1)
    }).strict()
}).strict();
const edgeSchema = zod_1.z.object({
    source_action_id: objectIdSchema,
    target_action_id: objectIdSchema
}).strict();
const editAutomationDataSchema = zod_1.z.object({
    status: zod_1.z.enum(['active', 'inactive']),
    actions: zod_1.z.array(zod_1.z.discriminatedUnion('type', [
        waitActionSchema,
        sendEmailActionSchema
    ])).min(1).max(MAX_AUTOMATION_ACTIONS),
    edges: zod_1.z.array(edgeSchema)
}).strict();
let testDatabase = null;
const repository = (0, fake_database_automations_repository_1.createFakeDatabaseAutomationsRepository)({
    getDatabase: () => {
        if (process.env.NODE_ENV?.startsWith('testing')) {
            testDatabase ??= temporaryFakeAutomationsDatabase.createTemporaryFakeAutomationsDatabase();
            return testDatabase;
        }
        return temporaryFakeAutomationsDatabase.getTemporaryFakeAutomationsDatabase();
    }
});
async function browse() {
    return await repository.browse();
}
async function read(automationId) {
    const automation = await repository.getById(automationId);
    if (!automation) {
        throw new errors_1.default.NotFoundError({
            message: (0, tpl_1.default)(messages.automationNotFound)
        });
    }
    return automation;
}
async function edit(automationId, data) {
    const parsedData = validateEditData(data);
    const automation = await repository.edit(automationId, parsedData);
    if (!automation) {
        throw new errors_1.default.NotFoundError({
            message: (0, tpl_1.default)(messages.automationNotFound)
        });
    }
    return automation;
}
function validateEditData(data) {
    const result = editAutomationDataSchema.safeParse(data);
    if (!result.success) {
        if (result.error.issues.some(issue => issue.path[0] === 'status')) {
            throwValidationError(messages.invalidAutomationStatus, 'status');
        }
        throwValidationError(buildInvalidAutomationPayloadMessage(result.error.issues));
    }
    validateGraph(result.data.actions, result.data.edges);
    return result.data;
}
function buildInvalidAutomationPayloadMessage(issues) {
    if (!issues.length) {
        return messages.invalidAutomationPayload;
    }
    const issueSummaries = issues.slice(0, 3).map((issue) => {
        const path = issue.path.length ? issue.path.join('.') : 'payload';
        return `${path}: ${issue.message}`;
    });
    return `${messages.invalidAutomationPayload} ${issueSummaries.join('; ')}.`;
}
function validateGraph(actions, edges) {
    const actionIdentities = new Set();
    // Every action in the submitted graph must have a unique ObjectId so edges
    // can refer to a single, unambiguous node.
    for (const action of actions) {
        if (actionIdentities.has(action.id)) {
            throwValidationError(messages.duplicateAutomationActionIdentity, 'actions');
        }
        actionIdentities.add(action.id);
    }
    const edgeIdentities = new Set();
    const outgoing = new Map();
    const incoming = new Map();
    // Edges are stored without ids, so source/target pairs are their identity.
    // While collecting them, also track incoming/outgoing degree so we can
    // reject branches before checking the full path shape.
    for (const edge of edges) {
        if (!actionIdentities.has(edge.source_action_id) || !actionIdentities.has(edge.target_action_id)) {
            throwValidationError(messages.invalidAutomationEdgeEndpoint, 'edges');
        }
        if (edge.source_action_id === edge.target_action_id) {
            throwValidationError(messages.invalidAutomationEdge, 'edges');
        }
        const edgeIdentity = `${edge.source_action_id}->${edge.target_action_id}`;
        if (edgeIdentities.has(edgeIdentity)) {
            throwValidationError(messages.duplicateAutomationEdge, 'edges');
        }
        edgeIdentities.add(edgeIdentity);
        if (outgoing.has(edge.source_action_id) || incoming.has(edge.target_action_id)) {
            throwValidationError(messages.invalidAutomationGraphShape, 'edges');
        }
        outgoing.set(edge.source_action_id, edge.target_action_id);
        incoming.set(edge.target_action_id, edge.source_action_id);
    }
    validateLinearGraph(actionIdentities, outgoing, incoming);
}
function validateLinearGraph(actionIdentities, outgoing, incoming) {
    // A single-action automation is valid only when it has no edges.
    if (actionIdentities.size === 1) {
        if (outgoing.size !== 0 || incoming.size !== 0) {
            throwValidationError(messages.invalidAutomationGraphShape, 'edges');
        }
        return;
    }
    // A linear path with N actions must have exactly N - 1 edges.
    if (outgoing.size !== actionIdentities.size - 1) {
        throwValidationError(messages.invalidAutomationGraphShape, 'edges');
    }
    const heads = [...actionIdentities].filter(identity => !incoming.has(identity));
    const tails = [...actionIdentities].filter(identity => !outgoing.has(identity));
    // A valid path has one start node with no incoming edge and one end node
    // with no outgoing edge.
    if (heads.length !== 1 || tails.length !== 1) {
        throwValidationError(messages.invalidAutomationGraphShape, 'edges');
    }
    const visited = new Set();
    let cursor = heads[0];
    // Walk from the head through outgoing edges. Revisiting a node means a
    // cycle; visiting fewer nodes than submitted means the graph is disconnected.
    while (cursor) {
        if (visited.has(cursor)) {
            throwValidationError(messages.invalidAutomationGraphShape, 'edges');
        }
        visited.add(cursor);
        cursor = outgoing.get(cursor);
    }
    if (visited.size !== actionIdentities.size) {
        throwValidationError(messages.invalidAutomationGraphShape, 'edges');
    }
}
function throwValidationError(message, property) {
    throw new errors_1.default.ValidationError({
        message,
        property
    });
}
function requestPoll() {
    domainEvents.dispatch(StartAutomationsPollEvent.create());
}
function _resetTestDatabase() {
    if (process.env.NODE_ENV?.startsWith('testing')) {
        testDatabase = null;
    }
}
