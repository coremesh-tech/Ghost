import Service from '@ember/service';
import {task, timeout} from 'ember-concurrency';
import {tracked} from '@glimmer/tracking';

export default class TagsManagerService extends Service {
    @tracked tagsScreenInfinityModel = null;

    sortTags(tags = []) {
        return tags
            .filter(tag => tag.get('id') !== null) // exclude unsaved tags
            .sort((tagA, tagB) => tagA.name.localeCompare(tagB.name, undefined, {ignorePunctuation: true}));
    }

    @task({restartable: true})
    *searchTagsTask(term, {page = 1, filter} = {}) {
        // debounce the search
        yield timeout(250);
        const safeTerm = term.replace(/'/g, `\\'`);
        // pm.org:可叠加维度过滤(如 type:topic),不传则同原行为
        const nameFilter = `tags.name:~'${safeTerm}'`;
        const combinedFilter = filter ? `${nameFilter}+${filter}` : nameFilter;
        return yield this.store.query('tag', {filter: combinedFilter, limit: 100, page, order: 'name asc'});
    }
}
