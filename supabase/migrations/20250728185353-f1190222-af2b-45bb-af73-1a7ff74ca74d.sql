-- Grant Enhanced Access module to Amanda Taylor and Malcolm Railson
SELECT grant_user_module('dbefd7c1-47f5-41de-a58e-ab739558af16'::UUID, 'enhanced_access'::app_module);
SELECT grant_user_module('e3aea82f-451b-40fb-8681-2b579a92dc3a'::UUID, 'enhanced_access'::app_module);

-- Also grant them basic meeting recorder access if they don't have it
SELECT grant_user_module('dbefd7c1-47f5-41de-a58e-ab739558af16'::UUID, 'meeting_recorder'::app_module);
SELECT grant_user_module('e3aea82f-451b-40fb-8681-2b579a92dc3a'::UUID, 'meeting_recorder'::app_module);