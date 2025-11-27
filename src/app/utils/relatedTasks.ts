import type { CurrentStatus, PriorityLevel, RelatedTaskRef } from '@/app/types/taskTypes';

function extractId(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        if (typeof (obj.toHexString as (() => string)) === 'function') {
            const hex = (obj.toHexString as () => string)();
            if (hex) return hex;
        }
        if (obj._id) {
            return extractId(obj._id);
        }
        if (typeof (obj.toString as (() => string)) === 'function') {
            const raw = obj.toString();
            const match = raw.match(/[a-fA-F0-9]{24}/);
            if (match) return match[0];
            return raw.trim();
        }
    }
    return null;
}

export function normalizeRelatedTasks(raw?: unknown): RelatedTaskRef[] {
    if (!Array.isArray(raw)) return [];

    return raw
        .map((item) => {
            if (!item) return null;
            if (typeof item === 'string') {
                const trimmed = item.trim();
                return trimmed ? ({ _id: trimmed } as RelatedTaskRef) : null;
            }

            const normalizedId = extractId(item);
            if (!normalizedId) return null;

            const result: RelatedTaskRef = { _id: normalizedId };
            const record = item as Record<string, unknown>;

            if (typeof record.taskId === 'string') result.taskId = record.taskId;
            if (typeof record.taskName === 'string') result.taskName = record.taskName;
            if (typeof record.bsNumber === 'string') result.bsNumber = record.bsNumber;
            if (typeof record.status === 'string') {
                result.status = record.status as CurrentStatus;
            }
            if (typeof record.priority === 'string') {
                result.priority = record.priority as PriorityLevel;
            }

            return result;
        })
        .filter((item): item is RelatedTaskRef => Boolean(item && item._id));
}
