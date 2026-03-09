CREATE POLICY "Users can delete audit log for own documents"
ON approval_audit_log
FOR DELETE
TO authenticated
USING (
  document_id IN (
    SELECT id FROM approval_documents WHERE sender_id = auth.uid()
  )
);