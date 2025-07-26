
declare module 'react-big-calendar' {
    import * as React from 'react';

    export interface Event<T = unknown> {
        id: string | number;
        title: string;
        start: Date;
        end: Date;
        allDay?: boolean;
        resource?: T;
    }


    export interface CalendarProps<E extends Event = Event> {
        localizer: unknown;
        events: E[];

        /* навигация и дата */
        date?: Date;
        defaultView?: 'month' | 'week' | 'day';
        onNavigate?: (date: Date, view: string, action: string) => void;

        /* виды */
        view?: 'month' | 'week' | 'day';
        views?: Record<string, boolean>;
        onView?: (view: string) => void;

        /* кастомные компоненты */
        components?: {
            toolbar?: React.ComponentType<unknown>;
        };

        /* прочее */
        popup?: boolean;
        style?: React.CSSProperties;
        eventPropGetter?: (event: E) => { style?: React.CSSProperties };
        onSelectEvent?: (event: E) => void;
    }

    export const Calendar: React.ComponentType<CalendarProps>;
    export function dateFnsLocalizer(cfg: unknown): unknown;
}
