"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.poll = void 0;
const poll = async ({ 
// TODO(NY-1286) This ESLint suppression will be removed once we implement polling.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
enqueueAnotherPollAt }) => {
    // TODO(NY-1311) Once we're using real tables, we should remove this conditional.
    if (process.env.NODE_ENV !== 'development'
        && !process.env.NODE_ENV?.startsWith('test')) {
        return;
    }
    // TODO(NY-1286) Implement polling. For now, this function is a skeleton.
};
exports.poll = poll;
