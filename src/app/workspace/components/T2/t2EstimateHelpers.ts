// src/app/workspace/components/T2/t2EstimateHelpers.ts

export const DEFAULT_BS_PREFIXES = ['IR', 'BU', 'HB'] as const;

export type BsPrefix = (typeof DEFAULT_BS_PREFIXES)[number];

export type ExtractBsNumbersOptions = {
    /**
     * Допустимые префиксы БС, по умолчанию IR / BU / HB
     */
    prefixes?: string[];
    /**
     * Удалять дубликаты (по умолчанию true)
     */
    dedupe?: boolean;
};

/**
 * Извлекает номера БС из произвольной строки сметы.
 * Примеры:
 *  - "ЭВ-IR001345-IR001746" → ["IR001345", "IR001746"]
 *  - "BU0123, HB00045" → ["BU0123", "HB00045"]
 */
export function extractBsNumbersFromString(
    raw?: string | null,
    options: ExtractBsNumbersOptions = {}
): string[] {
    if (!raw) return [];

    const { prefixes = DEFAULT_BS_PREFIXES, dedupe = true } = options;

    if (!prefixes.length) return [];

    // Собираем паттерн вида: (IR|BU|HB)\d+
    const escapedPrefixes = prefixes.map((p) =>
        p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const pattern = `(?:${escapedPrefixes.join('|')})\\d+`;
    const re = new RegExp(pattern, 'gi');

    const seen = new Set<string>();
    const result: string[] = [];

    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
        const norm = m[0].toUpperCase().trim();
        if (!norm) continue;

        if (dedupe) {
            if (seen.has(norm)) continue;
            seen.add(norm);
        }

        result.push(norm);
    }

    return result;
}
