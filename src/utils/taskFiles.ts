// src/utils/taskFiles.ts

const DOCUMENT_FOLDER_PATTERN = /-(estimate|documents)\//i;
const SUSPECT_LATIN1_PATTERN = /[ÃÐÒÑÂäöüÄÖÜß]/;

/** Checks whether the URL points to a document (estimate or other docs) rather than a regular attachment. */
export function isDocumentUrl(url?: string | null): boolean {
    if (!url) return false;
    return DOCUMENT_FOLDER_PATTERN.test(url);
}

/**
 * Splits attachment URLs into documents and the rest of attachments, merging with already stored documents.
 * Returns arrays without duplicates.
 */
export function splitAttachmentsAndDocuments(
    attachments: unknown,
    existingDocuments: unknown
): { attachments: string[]; documents: string[] } {
    const docs = Array.isArray(existingDocuments)
        ? existingDocuments.filter((u): u is string => typeof u === 'string')
        : [];
    const attArray = Array.isArray(attachments)
        ? attachments.filter((u): u is string => typeof u === 'string')
        : [];

    const filteredAttachments: string[] = [];
    for (const url of attArray) {
        if (isDocumentUrl(url)) {
            docs.push(url);
        } else {
            filteredAttachments.push(url);
        }
    }

    return {
        attachments: filteredAttachments,
        documents: Array.from(new Set(docs)),
    };
}

/**
 * Extracts a human-friendly filename from URL with best-effort latin1→utf8 fix for Cyrillic names.
 */
export function extractFileNameFromUrl(url?: string, fallback = 'Вложение'): string {
    if (!url) return fallback;
    const rawName = url.split('/').pop() || url;
    const decoded = safeDecodeURIComponent(rawName);

    if (SUSPECT_LATIN1_PATTERN.test(decoded)) {
        const fixed = tryDecodeLatin1(decoded);
        if (fixed) return fixed;
    }

    return decoded || fallback;
}

function safeDecodeURIComponent(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function tryDecodeLatin1(value: string): string | null {
    try {
        const bytes = Uint8Array.from(value, (ch) => ch.charCodeAt(0));
        return new TextDecoder('utf-8').decode(bytes);
    } catch {
        return null;
    }
}
