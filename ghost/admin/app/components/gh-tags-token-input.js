import Component from '@glimmer/component';
import {TrackedArray} from 'tracked-built-ins';
import {action} from '@ember/object';
import {escapeNqlString} from '../utils/escape-nql-string';
import {inject as service} from '@ember/service';

const SEARCH_DEBOUNCE_MS = 250;

export default class GhTagsTokenInput extends Component {
    @service store;
    @service tagsManager;

    _knownTags = new TrackedArray();

    _initialTagsMeta = null;
    _hasLoadedInitialTags = false;
    _searchedTagsQuery = null;
    _searchedTagsMeta = null;

    _powerSelectAPI = null;

    constructor() {
        super(...arguments);
        this.addInitialTags(this.args.selected?.toArray ? this.args.selected.toArray() : (this.args.selected || []));
    }

    get availableTags() {
        const selectedTags = this.args.selected || [];
        return this.tagsManager.sortTags(this._initialTags.filter(tag => !selectedTags.includes(tag)));
    }

    // pm.org:按维度类型过滤候选(@typeFilter 传入时生效)
    _matchesTypeFilter(tag) {
        if (!this.args.typeFilter) {
            return true;
        }
        return tag.get('type') === this.args.typeFilter;
    }

    // if we only have one page of tags available or we've already loaded all tags
    // then we can use the client-side search
    get useServerSideSearch() {
        const hasLoadedAnyTags = !!this._initialTagsMeta;
        const hasLoadedAllTags = hasLoadedAnyTags && parseInt(this._initialTagsMeta.pagination.pages, 10) === parseInt(this._initialTagsMeta.pagination.page, 10);

        return !hasLoadedAllTags;
    }

    @action
    addInitialTags(tags) {
        // 候选池收全部(同类型)tag,不在加载时排除已选;是否作为候选显示由 availableTags
        // 动态用 !selected.includes 过滤。这样取消选择的 tag 能立刻回到下拉。
        const existing = this._initialTags;
        const toAdd = tags.filter(tag => this._matchesTypeFilter(tag) && !existing.includes(tag));
        this._initialTags.push(...toAdd);
    }

    @action
    addSearchedTags(tags) {
        const existing = this._searchedTags;
        const toAdd = tags.filter(tag => this._matchesTypeFilter(tag) && !existing.includes(tag));
        this._searchedTags.push(...toAdd);
    }

    @action
    registerPowerSelectAPI(api) {
        this._powerSelectAPI = api;
    }

    @action
    async loadInitialTags() {
        if (!this._hasLoadedInitialTags) {
            await this.loadMoreTagsTask.perform(false);
            this._hasLoadedInitialTags = true;
        }
    }

    @task
    *loadMoreTagsTask() {
        const isSearch = !!this._powerSelectAPI.searchText;
        if (isSearch) {
            if (!this.useServerSideSearch) {
                return;
            }

            if (this.searchTagsTask.isRunning) {
                return;
            }

            if (this._searchedTagsMeta?.pagination && this._searchedTagsMeta.pagination.pages <= this._searchedTagsMeta.pagination.page) {
                return;
            }

            const page = this._searchedTagsMeta.pagination.page + 1;
            const searchOptions = {page};
            if (this.args.typeFilter) {
                searchOptions.filter = `type:${this.args.typeFilter}`;
            }
            const tags = yield this.tagsManager.searchTagsTask.perform(this._searchedTagsQuery, searchOptions);
            this.addSearchedTags(tags.toArray());
            this._searchedTagsMeta = tags.meta;
        } else {
            if (this._initialTagsMeta?.pagination && this._initialTagsMeta.pagination.pages <= this._initialTagsMeta.pagination.page) {
                return;
            }

            const page = this._initialTagsMeta?.pagination.page ? this._initialTagsMeta.pagination.page + 1 : 1;
            const query = {limit: PAGE_SIZE, page, order: 'name asc'};
            if (this.args.typeFilter) {
                query.filter = `type:${this.args.typeFilter}`;
            }
            const tags = yield this.store.query('tag', query);
            this.addInitialTags(tags.toArray());
            this._initialTagsMeta = tags.meta;
        }
    }

    @task
    *searchTagsTask(term) {
        this._searchedTagsQuery = term;
        const searchOptions = {};
        if (this.args.typeFilter) {
            searchOptions.filter = `type:${this.args.typeFilter}`;
        }
        const tags = yield this.tagsManager.searchTagsTask.perform(term, searchOptions);
        this._searchedTagsMeta = tags.meta;

        // we need to create a tracked array for vertical-collection to update as new options are loaded
        // because we can't rely on power-select re-rendering as @options changes via auto template updates
        this._searchedTags = new TrackedArray();
        this.addSearchedTags(tags.toArray());
        return this._searchedTags;
    }

    @action
    showCreateWhen(term) {
        const availableTagNames = this._searchedTags.map(tag => tag.name.toLowerCase());
        availableTagNames.push(...this.args.selected.map(tag => tag.name.toLowerCase()));
    }
    @action
    loadTagsPage({limit, page}) {
        return this.store.query('tag', {limit, page, order: 'name asc'}).then((tags) => {
            this._addKnownTags(tags.toArray());
            return tags;
        });
    }

    @action
    searchTagsPage(term, {limit, page}) {
        return this.store.query('tag', {filter: `tags.name:~${escapeNqlString(term)}`, limit, page, order: 'name asc'}).then((tags) => {
            this._addKnownTags(tags.toArray());
            return tags;
        });
    }

    @action
    sortTags(tags) {
        return this.tagsManager.sortTags(tags);
    }

    @action
    showCreateWhen(term, tags) {
        const availableTagNames = tags.map(tag => tag.name.toLowerCase());
        availableTagNames.push(...(this.args.selected || []).map(tag => tag.name.toLowerCase()));

        const foundMatchingTagName = availableTagNames.includes(term.toLowerCase());
        return !foundMatchingTagName;
    }

    get searchDebounceMs() {
        return SEARCH_DEBOUNCE_MS;
    }

    @action
    updateTags(newTags) {
        let currentTags = this.args.selected || [];

        // destroy new+unsaved tags that are no longer selected
        currentTags.forEach(function (tag) {
            if (!newTags.includes(tag) && tag.get('isNew')) {
                tag.destroyRecord();
            }
        });

        // call the onChange callback
        if (this.args.onChange) {
            this.args.onChange(newTags);
        }
    }

    @action
    createTag(tagNameAttr) {
        let currentTags = this.args.selected || [];
        let currentTagNames = currentTags.map(tag => tag.get('name').toLowerCase());
        let tagToAdd;

        tagNameAttr = tagNameAttr.trim();

        // abort if tag is already selected
        if (currentTagNames.includes(tagNameAttr.toLowerCase())) {
            return;
        }

        // find existing tag if there is one
        tagToAdd = this._findTagByName(tagNameAttr);

        // create new tag if no match
        if (!tagToAdd) {
            tagToAdd = this.store.createRecord('tag', {
                name: tagNameAttr,
                // pm.org:内联新建自动归入当前字段维度
                type: this.args.typeFilter || null
            });

            // set to public/internal based on the tag name
            tagToAdd.updateVisibility();
        }

        // call the onCreate callback or default to adding the tag
        if (this.args.onCreate) {
            return this.args.onCreate(tagToAdd);
        } else {
            // default behavior: add to selected tags
            const newTags = [...currentTags, tagToAdd];
            this.updateTags(newTags);
        }
    }

    // methods

    _findTagByName(name) {
        let withMatchingName = function (tag) {
            if (tag.__isSuggestion__) {
                return false;
            }
            return tag.name.toLowerCase() === name.toLowerCase();
        };

        return this._knownTags.find(withMatchingName);
    }

    _addKnownTags(tags) {
        const knownTagIds = new Set(this._knownTags.map(tag => tag.id));
        const deduplicatedTags = tags.filter(tag => !knownTagIds.has(tag.id));
        this._knownTags.push(...deduplicatedTags);
    }
}
