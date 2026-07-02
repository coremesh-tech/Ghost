import Component from '@glimmer/component';
import {action} from '@ember/object';
import {tracked} from '@glimmer/tracking';

const TYPES = ['genre', 'segment', 'topic', 'function'];

// pm.org 分类打标:把 post.tags 按维度拆成四个字段,变更时合并回单一 tags 数组。
// 未分类/历史 tag(type 不在四类中)不在字段展示,但保存时保留,避免丢数据。
//
// 关键:各字段 @selected 必须是「稳定引用」——只要该维度的 tag 集合(按 id 签名)没变,
// 就返回同一个数组;否则 getter 每次渲染都产生新数组,GhTagsTokenInput/power-select 会
// 反复重置内部状态、把候选冲掉(表现为「选完就没候选、刷新才回来」)。
// Ember 3.24 无 @cached,这里用手动 memo 实现稳定引用。
export default class GhPsmClassifiedTags extends Component {
    // 版本号:每次更新 tags 后 bump,强制各 getter 重算。
    // (Ember 3.24 对 hasMany 关系的自动追踪不可靠,不能只依赖 post.get('tags') 触发更新)
    @tracked _rev = 0;
    _cache = {};

    get allTags() {
        const tags = this.args.post.get('tags');
        return tags && tags.toArray ? tags.toArray() : (tags || []);
    }

    // 按签名缓存,内容不变返回同一引用(避免引用抖动导致 power-select 重置);
    // 签名带上 _rev,更新后必定失效重算,保证已选及时更新。
    _group(key, predicate) {
        const rev = this._rev;
        const filtered = this.allTags.filter(predicate);
        const sig = `${rev}:` + filtered.map(t => t.get('id') || `new:${t.get('name')}`).join('|');
        const cached = this._cache[key];
        if (cached && cached.sig === sig) {
            return cached.arr;
        }
        this._cache[key] = {sig, arr: filtered};
        return filtered;
    }

    get genreTags() {
        return this._group('genre', tag => tag.get('type') === 'genre');
    }

    get segmentTags() {
        return this._group('segment', tag => tag.get('type') === 'segment');
    }

    get topicTags() {
        return this._group('topic', tag => tag.get('type') === 'topic');
    }

    get functionTags() {
        return this._group('function', tag => tag.get('type') === 'function');
    }

    get otherTags() {
        return this._group('other', tag => !TYPES.includes(tag.get('type')));
    }

    _merge(overrides = {}) {
        const groups = {
            genre: overrides.genre ?? this.genreTags,
            segment: overrides.segment ?? this.segmentTags,
            topic: overrides.topic ?? this.topicTags,
            function: overrides.function ?? this.functionTags
        };

        return [
            ...groups.genre,
            ...groups.segment,
            ...groups.topic,
            ...groups.function,
            ...this.otherTags
        ];
    }

    _save(newTags) {
        // 只更新内存中的 post.tags;不在每次字段变更时立即整篇保存(会触发重渲染冲掉候选)。
        // 标签会随文章的自动保存/发布一起持久化。
        this.args.post.set('tags', newTags);
        // 手动触发各 getter 重算(3.24 hasMany 自动追踪不可靠)
        this._rev += 1;
    }

    @action
    updateGenre(newTags) {
        // 体裁单选:只保留最后选择的一个
        const genre = newTags.length > 1 ? [newTags[newTags.length - 1]] : newTags;
        return this._save(this._merge({genre}));
    }

    @action
    updateSegment(newTags) {
        return this._save(this._merge({segment: newTags}));
    }

    @action
    updateTopic(newTags) {
        return this._save(this._merge({topic: newTags}));
    }

    @action
    updateFunction(newTags) {
        return this._save(this._merge({function: newTags}));
    }
}
