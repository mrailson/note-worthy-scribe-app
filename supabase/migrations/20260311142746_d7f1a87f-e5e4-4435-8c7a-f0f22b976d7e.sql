-- Update status to completed since all remaining signatories have signed
UPDATE approval_documents 
SET status = 'completed', completed_at = now(),
    signature_placement = '{"method":"stamp","positions":{"257677eb-dd39-4467-a7e9-d3b6e7db9aeb":{"height":6,"page":2,"width":14,"x":28.7,"y":18.5},"9c2f5eed-8d5c-4038-a56f-9935263d07af":{"height":6,"page":2,"width":14,"x":11,"y":18.4}}}'::jsonb
WHERE id = '601722a5-1d32-48de-a4a3-e9b058aedbc2';