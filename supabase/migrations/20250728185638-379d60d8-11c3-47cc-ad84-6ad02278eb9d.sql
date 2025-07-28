-- Grant AI4PM and Complaints System access to Malcolm Railson
SELECT grant_user_module('e3aea82f-451b-40fb-8681-2b579a92dc3a'::UUID, 'ai_4_pm'::app_module);
SELECT grant_user_module('e3aea82f-451b-40fb-8681-2b579a92dc3a'::UUID, 'complaints_system'::app_module);