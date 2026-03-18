ALTER TABLE approval_documents ADD COLUMN multi_doc_group_id uuid;
CREATE INDEX idx_approval_docs_multi_group ON approval_documents(multi_doc_group_id) WHERE multi_doc_group_id IS NOT NULL;