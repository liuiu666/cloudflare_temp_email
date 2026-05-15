-- Add inferred original/forwarded recipient field to raw_mails
ALTER TABLE raw_mails ADD COLUMN original_recipient TEXT;

CREATE INDEX IF NOT EXISTS idx_raw_mails_original_recipient
ON raw_mails(original_recipient);
