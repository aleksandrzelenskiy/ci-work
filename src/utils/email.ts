export const normalizeEmail = (value?: string | null) =>
    typeof value === 'string' ? value.trim().toLowerCase() : '';

export const formatNameFromEmail = (value: string) => {
    if (!value.includes('@')) return value;
    const local = value.split('@')[0] || value;
    const parts = local.split(/[._-]+/).filter(Boolean);
    if (!parts.length) return value;
    return parts
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};
