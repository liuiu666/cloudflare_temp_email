type RawMailInsertOptions = {
    db: D1Database;
    source: string;
    address: string;
    messageId: string | null;
    originalRecipient?: string | null;
    raw?: string;
    rawBlob?: ArrayBuffer;
    useCurrentTimestamp?: boolean;
};

export async function insertRawMail(options: RawMailInsertOptions): Promise<boolean> {
    if (options.rawBlob) {
        try {
            return await runRawMailInsert(options, [
                "source",
                "address",
                "raw_blob",
                "message_id",
                "original_recipient",
            ], [
                options.source,
                options.address,
                options.rawBlob,
                options.messageId,
                options.originalRecipient || null,
            ]);
        } catch (error) {
            if (isMissingOriginalRecipientColumn(error)) {
                console.error("original_recipient column missing, falling back to legacy raw_blob insert", error);
                return await runRawMailInsert(options, [
                    "source",
                    "address",
                    "raw_blob",
                    "message_id",
                ], [
                    options.source,
                    options.address,
                    options.rawBlob,
                    options.messageId,
                ]);
            }
            if (isMissingRawBlobColumn(error) || isNoSuchColumnError(error)) {
                console.error("raw_blob column missing, falling back to plaintext insert", error);
                return await insertPlainRawMail(options);
            }
            throw error;
        }
    }

    return await insertPlainRawMail(options);
}

async function insertPlainRawMail(options: RawMailInsertOptions): Promise<boolean> {
    try {
        return await runRawMailInsert(options, [
            "source",
            "address",
            "raw",
            "message_id",
            "original_recipient",
        ], [
            options.source,
            options.address,
            options.raw || "",
            options.messageId,
            options.originalRecipient || null,
        ]);
    } catch (error) {
        if (isMissingOriginalRecipientColumn(error) || isNoSuchColumnError(error)) {
            console.error("original_recipient column missing, falling back to legacy plaintext insert", error);
            return await runRawMailInsert(options, [
                "source",
                "address",
                "raw",
                "message_id",
            ], [
                options.source,
                options.address,
                options.raw || "",
                options.messageId,
            ]);
        }
        throw error;
    }
}

async function runRawMailInsert(
    options: RawMailInsertOptions,
    columns: string[],
    values: unknown[]
): Promise<boolean> {
    const insertColumns = [...columns];
    const placeholders = columns.map(() => "?");
    if (options.useCurrentTimestamp) {
        insertColumns.push("created_at");
        placeholders.push("datetime('now')");
    }
    const result = await options.db.prepare(
        `INSERT INTO raw_mails (${insertColumns.join(", ")}) VALUES (${placeholders.join(", ")})`
    ).bind(...values).run();
    return result.success;
}

function isMissingOriginalRecipientColumn(error: unknown): boolean {
    return String(error).toLowerCase().includes("original_recipient");
}

function isMissingRawBlobColumn(error: unknown): boolean {
    return String(error).toLowerCase().includes("raw_blob");
}

function isNoSuchColumnError(error: unknown): boolean {
    const message = String(error).toLowerCase();
    return message.includes("no such column") || message.includes("has no column");
}
