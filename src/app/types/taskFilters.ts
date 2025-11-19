export interface TaskFilters {
    manager?: string | null;
    executor?: string | null;
    status: string;
    priority: string;
    dueFrom?: Date | null;
    dueTo?: Date | null;
}

export interface TaskFilterOptions {
    managers: string[];
    executors: string[];
    statuses: string[];
    priorities: string[];
}

export const defaultTaskFilters: TaskFilters = {
    manager: null,
    executor: null,
    status: '',
    priority: '',
    dueFrom: null,
    dueTo: null,
};
