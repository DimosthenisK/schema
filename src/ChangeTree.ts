import { Schema } from "./annotations";
import { ArraySchema } from "./types/ArraySchema";
import { MapSchema } from "./types/MapSchema";

type FieldKey = string | number | symbol;

export class ChangeTree {
    changed: boolean = false;
    changes: FieldKey[] = [];
    allChanges: FieldKey[] = [];

    /**
     * `MapSchema` / `ArraySchema`
     */
    indexMap: Map<any, FieldKey>;
    indexChange: Map<any, FieldKey>;

    /**
     * parent link & field name
     */
    parent: ChangeTree;
    parentField: FieldKey;

    linkedTrees: ChangeTree[] = [];

    protected trackAllChanges: boolean;

    constructor (parentField: FieldKey = null, parent?: ChangeTree, trackAllChanges: boolean = false) {
        this.parent = parent;
        this.parentField = parentField;

        this.trackAllChanges = trackAllChanges;
    }

    link(linkedTree: ChangeTree) {
        this.linkedTrees.push(linkedTree);
    }

    change(field: FieldKey) {
        this.changed = true;

        if (this.changes.indexOf(field) === -1) {
            this.changes.push(field);
        }

        if (this.allChanges.indexOf(field) === -1) {
            this.allChanges.push(field);
        }

        if (this.parent) {
            this.parent.change(this.parentField);
        }
    }

    mapIndex(instance: any, key: FieldKey) {
        if (!this.indexMap) {
            this.indexMap = new Map<any, FieldKey>();
            this.indexChange = new Map<any, FieldKey>();
        }

        this.indexMap.set(instance, key);
    }

    getIndex (instance: any) {
        return this.indexMap && this.indexMap.get(instance);
    }

    deleteIndex(instance: any) {
        this.indexMap.delete(instance);
    }

    mapIndexChange(instance: any, key: FieldKey) {
        this.indexChange.set(instance, key);
    }

    getIndexChange (instance: any) {
        return this.indexChange && this.indexChange.get(instance);
    }

    deleteIndexChange(instance: any) {
        this.indexChange.delete(instance);
    }

    changeAll(obj: Schema | ArraySchema | MapSchema) {
        const keys = Object.keys(obj);

        for (const key of keys) {
            this.change(key);
        }
    }

    discard() {
        this.changed = false;
        this.changes = [];

        if (this.indexChange) {
            this.indexChange.clear();
        }
    }

/*
    markAsUnchanged() {
        const schema = this._schema;
        const changes = this.$changes;

        for (const field in changes) {
            const type = schema[field];
            const value = changes[field];

            // skip unchagned fields
            if (value === undefined) { continue; }

            if ((type as any)._schema) {
                (value as Schema).markAsUnchanged();

            } else if (Array.isArray(type)) {
                // encode Array of type
                for (let i = 0, l = value.length; i < l; i++) {
                    const index = value[i];
                    const item = this[`_${field}`][index];

                    if (typeof(type[0]) !== "string") { // is array of Schema
                        (item as Schema).markAsUnchanged();
                    }
                }

            } else if ((type as any).map) {
                const keys = value;
                const mapKeys = Object.keys(this[`_${field}`]);

                for (let i = 0; i < keys.length; i++) {
                    const key = mapKeys[keys[i]] || keys[i];
                    const item = this[`_${field}`][key];

                    if (item instanceof Schema) {
                        item.markAsUnchanged();
                    }
                }
            }
        }

        this.changed = false;
        this.$changes = {};
    }
*/

}