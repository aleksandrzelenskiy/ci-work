// src/utils/bsLocation.ts

export type BsLocationWithAddress = Array<{ address?: string | null }>;

function splitAddresses(value?: string | null): string[] {
    if (!value) return [];
    return value
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean);
}

// Собирает bsAddress на основе массива bsLocation: если БС несколько — конкатенирует адреса через ';'
// При этом учитывает, что адрес в bsLocation мог уже содержать разделители ';' и не раздувает строку.
export function buildBsAddressFromLocations(
    bsLocation: BsLocationWithAddress | null | undefined,
    fallbackAddress?: string | null
): string | undefined {
    const addressesRaw = Array.isArray(bsLocation)
        ? bsLocation.flatMap((loc) => splitAddresses(loc?.address))
        : [];

    // убираем дубли
    const seen = new Set<string>();
    const addresses: string[] = [];
    for (const addr of addressesRaw) {
        if (seen.has(addr)) continue;
        seen.add(addr);
        addresses.push(addr);
    }

    if (addresses.length > 1) {
        return addresses.join('; ');
    }
    if (addresses.length === 1) {
        return addresses[0];
    }

    const fbParts = splitAddresses((fallbackAddress ?? '').toString());
    if (fbParts.length) return fbParts[0];
    return undefined;
}

export function normalizeSingleBsAddress(address?: string | null): string {
    const parts = splitAddresses(address);
    return (parts[0] ?? '').trim();
}

// Возвращает очищенный массив bsLocation: убирает повторные конкатенации адресов.
export function sanitizeBsLocationAddresses<
    T extends { address?: string | null } & Record<string, unknown>
>(
    bsLocation: T[] | null | undefined,
    fallbackAddress?: string | null
): T[] | undefined {
    if (!Array.isArray(bsLocation)) return undefined;
    if (bsLocation.length === 0) return [];

    const addrFromTask = splitAddresses(fallbackAddress);

    // Сначала нормализуем каждую запись (первая часть адреса, trim)
    const normalized = bsLocation.map((loc) => ({
        ...loc,
        address: normalizeSingleBsAddress(loc.address),
    }));

    // Если адресов нет, но в bsAddress несколько частей — распределяем их по списку БС
    if (addrFromTask.length >= normalized.length) {
        const hasAnyAddress = normalized.some((loc) => loc.address);
        if (!hasAnyAddress || normalized.every((loc) => !loc.address)) {
            return normalized.map((loc, idx) => ({
                ...loc,
                address: addrFromTask[idx] ?? '',
            }));
        }
    }

    // Если все адреса одинаковые, но есть несколько частей в bsAddress — распределяем
    const allEqual = normalized.length > 1 && normalized.every((loc) => loc.address === normalized[0].address);
    if (allEqual && addrFromTask.length >= normalized.length) {
        return normalized.map((loc, idx) => ({
            ...loc,
            address: addrFromTask[idx] ?? loc.address ?? '',
        }));
    }

    return normalized;
}
