INSERT INTO user_service_activations (user_id, service)
SELECT '42245e69-bf8e-49ca-94eb-911b23a86ebe', 'nres'
WHERE NOT EXISTS (
  SELECT 1 FROM user_service_activations
  WHERE user_id='42245e69-bf8e-49ca-94eb-911b23a86ebe' AND service='nres'
);

INSERT INTO user_roles (user_id, practice_id, role, can_view_narp_identifiable, can_export_narp_identifiable)
VALUES ('42245e69-bf8e-49ca-94eb-911b23a86ebe', '85cd140c-2980-40df-8e19-0ffc8a9346d5', 'practice_manager', true, true);