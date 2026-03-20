-- Insert missing NRES Document Vault subfolders per V1.2 folder structure document
-- 01. Governance subfolders
INSERT INTO shared_drive_folders (id, name, parent_id, created_by, path, scope) VALUES
('ffa8b1ea-e2a5-40bf-9adb-352311a6f86c', 'Meeting Papers', '88389c75-a748-4562-bb83-1b597a7b12ec', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '88389c75-a748-4562-bb83-1b597a7b12ec/Meeting Papers', 'nres_vault'),
('01bf19aa-43fd-4cdd-a3d5-a47fdf3ecf9d', 'Minutes and Actions', '88389c75-a748-4562-bb83-1b597a7b12ec', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '88389c75-a748-4562-bb83-1b597a7b12ec/Minutes and Actions', 'nres_vault'),
('18adbeb8-acf4-4746-8775-1b07f384d27e', 'Terms of Reference', '88389c75-a748-4562-bb83-1b597a7b12ec', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '88389c75-a748-4562-bb83-1b597a7b12ec/Terms of Reference', 'nres_vault'),
('30da1c84-9250-4f3f-8d02-d331d922f780', 'Board Decisions Log', '88389c75-a748-4562-bb83-1b597a7b12ec', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '88389c75-a748-4562-bb83-1b597a7b12ec/Board Decisions Log', 'nres_vault'),
('fd063e84-3c0b-4378-bb2f-5b9321bd4c9d', 'Clinical Safety Reports', '45605fca-a62f-440d-a067-623cc5df262c', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '45605fca-a62f-440d-a067-623cc5df262c/Clinical Safety Reports', 'nres_vault'),
('2fbf7247-d0db-41db-85c9-92341add17a1', 'Significant Events', '45605fca-a62f-440d-a067-623cc5df262c', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '45605fca-a62f-440d-a067-623cc5df262c/Significant Events', 'nres_vault'),
('dd0de14f-6698-45d3-9433-1bcd85aba8aa', 'Medicines Management', '45605fca-a62f-440d-a067-623cc5df262c', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '45605fca-a62f-440d-a067-623cc5df262c/Medicines Management', 'nres_vault'),
('ffbb26ec-118b-49e9-9290-79a64a54b6f3', 'Risk Register (Live)', 'ba5eda36-4035-4ff7-88f8-a635f77029ce', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'ba5eda36-4035-4ff7-88f8-a635f77029ce/Risk Register (Live)', 'nres_vault'),
('878df4cf-d3dc-4487-9f42-376d171e612d', 'Issue Log', 'ba5eda36-4035-4ff7-88f8-a635f77029ce', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'ba5eda36-4035-4ff7-88f8-a635f77029ce/Issue Log', 'nres_vault'),
('5d8cafca-14b0-48b1-b722-ea7191084ebc', 'Escalations', 'ba5eda36-4035-4ff7-88f8-a635f77029ce', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'ba5eda36-4035-4ff7-88f8-a635f77029ce/Escalations', 'nres_vault'),
('44a78393-db6b-41d2-9d6c-7876c434e361', 'ICB Service Specification', 'ce9dd187-ce58-4c98-bb21-c468df5cb573', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'ce9dd187-ce58-4c98-bb21-c468df5cb573/ICB Service Specification', 'nres_vault'),
('99067b65-9af9-41b0-b408-6bf800491b8f', 'Practice Agreements', 'ce9dd187-ce58-4c98-bb21-c468df5cb573', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'ce9dd187-ce58-4c98-bb21-c468df5cb573/Practice Agreements', 'nres_vault'),
('4c14e18c-91ec-4427-af39-8d175bdf533c', 'SNO Agreement (PML)', 'ce9dd187-ce58-4c98-bb21-c468df5cb573', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'ce9dd187-ce58-4c98-bb21-c468df5cb573/SNO Agreement (PML)', 'nres_vault'),
('40271c74-ac29-42f0-9a8c-96156a71be98', 'Subcontractor Agreements', 'ce9dd187-ce58-4c98-bb21-c468df5cb573', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'ce9dd187-ce58-4c98-bb21-c468df5cb573/Subcontractor Agreements', 'nres_vault'),
-- 02. Operations subfolders
('76633ec0-96f8-4358-ac89-ad6c6df713ee', 'Rotas and Schedules', '1cad8538-81e0-4866-b4ef-978666927ae1', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '1cad8538-81e0-4866-b4ef-978666927ae1/Rotas and Schedules', 'nres_vault'),
('4096c356-e9d1-4205-ad10-f0a77f2abe73', 'Capacity Planning', '1cad8538-81e0-4866-b4ef-978666927ae1', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '1cad8538-81e0-4866-b4ef-978666927ae1/Capacity Planning', 'nres_vault'),
('a8f187ce-171c-4dfa-92e1-1c008cf8d8b2', 'Site Allocations', '1cad8538-81e0-4866-b4ef-978666927ae1', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '1cad8538-81e0-4866-b4ef-978666927ae1/Site Allocations', 'nres_vault'),
('3e05657a-235f-457f-88fa-534a7df28e81', 'Clinical SOPs', 'cfcc24ca-89be-4163-b9ed-c8abaa072943', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'cfcc24ca-89be-4163-b9ed-c8abaa072943/Clinical SOPs', 'nres_vault'),
('3f3b4de6-9765-4bff-bf99-4de5434d2295', 'Administrative SOPs', 'cfcc24ca-89be-4163-b9ed-c8abaa072943', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'cfcc24ca-89be-4163-b9ed-c8abaa072943/Administrative SOPs', 'nres_vault'),
('995184e8-10bd-4504-b5fe-de8eb1012e61', 'Emergency Procedures', 'cfcc24ca-89be-4163-b9ed-c8abaa072943', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'cfcc24ca-89be-4163-b9ed-c8abaa072943/Emergency Procedures', 'nres_vault'),
('40623b8e-a653-477e-b848-870269e07aa5', 'Practice Contacts', 'f16b82db-7340-4928-84a5-f345d3dfd6f2', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'f16b82db-7340-4928-84a5-f345d3dfd6f2/Practice Contacts', 'nres_vault'),
('cdadf106-6f41-4b5e-9f8a-0584b14bb2f5', 'Escalation Pathways', 'f16b82db-7340-4928-84a5-f345d3dfd6f2', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'f16b82db-7340-4928-84a5-f345d3dfd6f2/Escalation Pathways', 'nres_vault'),
('2be34921-718e-4592-82cd-2648fb681a0d', 'Practice-Specific Notes', 'f16b82db-7340-4928-84a5-f345d3dfd6f2', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'f16b82db-7340-4928-84a5-f345d3dfd6f2/Practice-Specific Notes', 'nres_vault'),
('4e3652e6-443f-493f-b0dd-b822cd13ba48', 'Templates', 'c5c70af8-80d4-43e2-a0e0-ab1bba0a45ef', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'c5c70af8-80d4-43e2-a0e0-ab1bba0a45ef/Templates', 'nres_vault'),
('e30aebbb-cc00-4a3a-a9d6-5525217687e9', 'Patient Information Leaflets', 'c5c70af8-80d4-43e2-a0e0-ab1bba0a45ef', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'c5c70af8-80d4-43e2-a0e0-ab1bba0a45ef/Patient Information Leaflets', 'nres_vault'),
-- 03. Performance & Reporting
('c78399e8-6002-4f10-9357-761d6215fa85', 'ICB Reporting', '899f04e8-697e-4840-b8cc-5e898e54796a', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '899f04e8-697e-4840-b8cc-5e898e54796a/ICB Reporting', 'nres_vault'),
('69690b8d-ab70-47e3-95a4-2a287020db64', 'Monthly Returns', 'c78399e8-6002-4f10-9357-761d6215fa85', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'c78399e8-6002-4f10-9357-761d6215fa85/Monthly Returns', 'nres_vault'),
('479f6bac-72f0-48e3-8206-882a746309b9', 'Quarterly Reviews', 'c78399e8-6002-4f10-9357-761d6215fa85', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'c78399e8-6002-4f10-9357-761d6215fa85/Quarterly Reviews', 'nres_vault'),
('6c4e1814-18e8-43d9-a04d-18cbb5dc4cb9', 'Annual Report', 'c78399e8-6002-4f10-9357-761d6215fa85', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'c78399e8-6002-4f10-9357-761d6215fa85/Annual Report', 'nres_vault'),
('84d4189d-6444-4f9d-9b21-80772b2f5b90', 'KPI Dashboard Exports', 'c78399e8-6002-4f10-9357-761d6215fa85', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'c78399e8-6002-4f10-9357-761d6215fa85/KPI Dashboard Exports', 'nres_vault'),
('121b5659-4bdd-43c8-9fe0-65d04880e693', 'Activity Data', '899f04e8-697e-4840-b8cc-5e898e54796a', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '899f04e8-697e-4840-b8cc-5e898e54796a/Activity Data', 'nres_vault'),
('b43c3de7-7e25-41d0-acd4-5a8bd5bf8d5b', 'Appointment Volumes', '121b5659-4bdd-43c8-9fe0-65d04880e693', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '121b5659-4bdd-43c8-9fe0-65d04880e693/Appointment Volumes', 'nres_vault'),
('6e32d74f-b2f1-48aa-a0c6-7d4a3a6a60ca', 'DNA Rates', '121b5659-4bdd-43c8-9fe0-65d04880e693', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '121b5659-4bdd-43c8-9fe0-65d04880e693/DNA Rates', 'nres_vault'),
('a1d22c33-2e8e-4c1b-b2a4-8ef0e1c4f3d7', 'Utilisation Reports', '121b5659-4bdd-43c8-9fe0-65d04880e693', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '121b5659-4bdd-43c8-9fe0-65d04880e693/Utilisation Reports', 'nres_vault'),
('d8f45a12-3b67-4c89-9e12-7a5b6c8d9e0f', 'By Practice Analysis', '121b5659-4bdd-43c8-9fe0-65d04880e693', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '121b5659-4bdd-43c8-9fe0-65d04880e693/By Practice Analysis', 'nres_vault'),
('e2f56b23-4c78-4d9a-af23-8b6c7d9e0f1a', 'Quality Metrics', '899f04e8-697e-4840-b8cc-5e898e54796a', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '899f04e8-697e-4840-b8cc-5e898e54796a/Quality Metrics', 'nres_vault'),
('f3a67c34-5d89-4eab-b034-9c7d8e0f1a2b', 'Patient Outcomes', 'e2f56b23-4c78-4d9a-af23-8b6c7d9e0f1a', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'e2f56b23-4c78-4d9a-af23-8b6c7d9e0f1a/Patient Outcomes', 'nres_vault'),
('a4b78d45-6e9a-4fbc-c145-ad8e9f1a2b3c', 'Clinical Audits', 'e2f56b23-4c78-4d9a-af23-8b6c7d9e0f1a', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'e2f56b23-4c78-4d9a-af23-8b6c7d9e0f1a/Clinical Audits', 'nres_vault'),
('b5c89e56-7fab-4acd-d256-be9f0a2b3c4d', 'Access Standards', 'e2f56b23-4c78-4d9a-af23-8b6c7d9e0f1a', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'e2f56b23-4c78-4d9a-af23-8b6c7d9e0f1a/Access Standards', 'nres_vault'),
('c6d9af67-8abc-4bde-e367-cfa01b3c4d5e', 'Benchmarking', '899f04e8-697e-4840-b8cc-5e898e54796a', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '899f04e8-697e-4840-b8cc-5e898e54796a/Benchmarking', 'nres_vault'),
-- 04. Finance
('d7eab078-9bcd-4cef-f478-d0b12c4d5e6f', 'Budget and Forecasting', '2a4af3b7-c044-456a-8b41-aa4a6139b64d', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '2a4af3b7-c044-456a-8b41-aa4a6139b64d/Budget and Forecasting', 'nres_vault'),
('e8fbc189-acde-4df0-a589-e1c23d5e6f7a', 'Annual Budget', 'd7eab078-9bcd-4cef-f478-d0b12c4d5e6f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'd7eab078-9bcd-4cef-f478-d0b12c4d5e6f/Annual Budget', 'nres_vault'),
('f9acd29a-bdef-4ea1-b69a-f2d34e6f7a8b', 'Monthly Forecasts', 'd7eab078-9bcd-4cef-f478-d0b12c4d5e6f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'd7eab078-9bcd-4cef-f478-d0b12c4d5e6f/Monthly Forecasts', 'nres_vault'),
('0abde3ab-cef0-4fb2-c7ab-a3e45f7a8b9c', 'Variance Reports', 'd7eab078-9bcd-4cef-f478-d0b12c4d5e6f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'd7eab078-9bcd-4cef-f478-d0b12c4d5e6f/Variance Reports', 'nres_vault'),
('1bcef4bc-dfa1-4ac3-d8bc-b4f56a8b9cad', 'Income and Claims', '2a4af3b7-c044-456a-8b41-aa4a6139b64d', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '2a4af3b7-c044-456a-8b41-aa4a6139b64d/Income and Claims', 'nres_vault'),
('2cdf05cd-eab2-4bd4-e9cd-c5a67b9cadbe', 'ICB Invoices', '1bcef4bc-dfa1-4ac3-d8bc-b4f56a8b9cad', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '1bcef4bc-dfa1-4ac3-d8bc-b4f56a8b9cad/ICB Invoices', 'nres_vault'),
('3dea16de-fbc3-4ce5-fade-d6b78cadbecf', 'Practice Recharges', '1bcef4bc-dfa1-4ac3-d8bc-b4f56a8b9cad', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '1bcef4bc-dfa1-4ac3-d8bc-b4f56a8b9cad/Practice Recharges', 'nres_vault'),
('4efb27ef-acd4-4df6-abef-e7c89dbecfd0', 'ARRS Funding', '1bcef4bc-dfa1-4ac3-d8bc-b4f56a8b9cad', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '1bcef4bc-dfa1-4ac3-d8bc-b4f56a8b9cad/ARRS Funding', 'nres_vault'),
('5fac38fa-bde5-4ea7-bcfa-f8d9aecfd0e1', 'Expenditure', '2a4af3b7-c044-456a-8b41-aa4a6139b64d', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '2a4af3b7-c044-456a-8b41-aa4a6139b64d/Expenditure', 'nres_vault'),
('6abd49ab-cef6-4fb8-cdab-a9eabfd0e1f2', 'Staff Costs', '5fac38fa-bde5-4ea7-bcfa-f8d9aecfd0e1', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '5fac38fa-bde5-4ea7-bcfa-f8d9aecfd0e1/Staff Costs', 'nres_vault'),
('7bce5abc-dfa7-4ac9-debc-bafbcae0e1f2', 'Premises', '5fac38fa-bde5-4ea7-bcfa-f8d9aecfd0e1', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '5fac38fa-bde5-4ea7-bcfa-f8d9aecfd0e1/Premises', 'nres_vault'),
('8cdf6bcd-eab8-4bda-efcd-cbacdbf1f2a3', 'Supplies and Equipment', '5fac38fa-bde5-4ea7-bcfa-f8d9aecfd0e1', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '5fac38fa-bde5-4ea7-bcfa-f8d9aecfd0e1/Supplies and Equipment', 'nres_vault'),
('9dea7cde-fbc9-4ceb-fade-dcbdeca2a3b4', 'Financial Statements', '2a4af3b7-c044-456a-8b41-aa4a6139b64d', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '2a4af3b7-c044-456a-8b41-aa4a6139b64d/Financial Statements', 'nres_vault'),
-- 05. Workforce
('aefb8def-acda-4dfc-abef-edcefdb3b4c5', 'Establishment', 'd696b967-2e41-4ea2-b2d2-f197c57da41b', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'd696b967-2e41-4ea2-b2d2-f197c57da41b/Establishment', 'nres_vault'),
('bfac9efa-bdeb-4ead-bcfa-fedfaec4c5d6', 'Funded Posts', 'aefb8def-acda-4dfc-abef-edcefdb3b4c5', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'aefb8def-acda-4dfc-abef-edcefdb3b4c5/Funded Posts', 'nres_vault'),
('cabdafab-cefc-4fbe-cdab-afea0fd5d6e7', 'Vacancies and Recruitment', 'aefb8def-acda-4dfc-abef-edcefdb3b4c5', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'aefb8def-acda-4dfc-abef-edcefdb3b4c5/Vacancies and Recruitment', 'nres_vault'),
('dbcebabc-dfad-4acf-debc-bafb1ae6e7f8', 'Organisation Chart', 'aefb8def-acda-4dfc-abef-edcefdb3b4c5', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'aefb8def-acda-4dfc-abef-edcefdb3b4c5/Organisation Chart', 'nres_vault'),
('ecdfcbcd-eabe-4bda-efcd-cbac2bf7f8a9', 'HR Documentation', 'd696b967-2e41-4ea2-b2d2-f197c57da41b', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'd696b967-2e41-4ea2-b2d2-f197c57da41b/HR Documentation', 'nres_vault'),
('fdeadcde-fbcf-4ceb-fade-dcbd3ca8a9ba', 'Contracts (Templates)', 'ecdfcbcd-eabe-4bda-efcd-cbac2bf7f8a9', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'ecdfcbcd-eabe-4bda-efcd-cbac2bf7f8a9/Contracts (Templates)', 'nres_vault'),
('aefbedef-acda-4dfc-abef-edce4db9bacb', 'Policies', 'ecdfcbcd-eabe-4bda-efcd-cbac2bf7f8a9', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'ecdfcbcd-eabe-4bda-efcd-cbac2bf7f8a9/Policies', 'nres_vault'),
('bfacfefa-bdeb-4ead-bcfa-fede5ecacbdc', 'Training and Development', 'd696b967-2e41-4ea2-b2d2-f197c57da41b', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'd696b967-2e41-4ea2-b2d2-f197c57da41b/Training and Development', 'nres_vault'),
('cabeafab-cefc-4fbe-cdab-afef6fdbdced', 'Induction Materials', 'bfacfefa-bdeb-4ead-bcfa-fede5ecacbdc', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'bfacfefa-bdeb-4ead-bcfa-fede5ecacbdc/Induction Materials', 'nres_vault'),
('dbcfbabc-dfad-4acf-debc-bafa7aecdefe', 'Mandatory Training Log', 'bfacfefa-bdeb-4ead-bcfa-fede5ecacbdc', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'bfacfefa-bdeb-4ead-bcfa-fede5ecacbdc/Mandatory Training Log', 'nres_vault'),
('ecdacbcd-eabe-4bda-efcd-cbab8bfdefaf', 'CPD Records', 'bfacfefa-bdeb-4ead-bcfa-fede5ecacbdc', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'bfacfefa-bdeb-4ead-bcfa-fede5ecacbdc/CPD Records', 'nres_vault'),
('fdebdcde-fbcf-4ceb-fade-dcbc9caefaba', 'Workforce Reports', 'd696b967-2e41-4ea2-b2d2-f197c57da41b', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'd696b967-2e41-4ea2-b2d2-f197c57da41b/Workforce Reports', 'nres_vault'),
-- 06. Quality & Safety
('a1b2c3d4-1234-4567-8901-111111111111', 'CQC Compliance', '86a0ec79-1723-4007-a389-1cf7d8dcb0cc', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '86a0ec79-1723-4007-a389-1cf7d8dcb0cc/CQC Compliance', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-111111111112', 'Registration Documents', 'a1b2c3d4-1234-4567-8901-111111111111', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-111111111111/Registration Documents', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-111111111113', 'Self-Assessment', 'a1b2c3d4-1234-4567-8901-111111111111', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-111111111111/Self-Assessment', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-111111111114', 'Evidence Portfolio', 'a1b2c3d4-1234-4567-8901-111111111111', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-111111111111/Evidence Portfolio', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-222222222221', 'Incidents and Complaints', '86a0ec79-1723-4007-a389-1cf7d8dcb0cc', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '86a0ec79-1723-4007-a389-1cf7d8dcb0cc/Incidents and Complaints', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-222222222222', 'Incident Reports', 'a1b2c3d4-1234-4567-8901-222222222221', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-222222222221/Incident Reports', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-222222222223', 'Complaints Log', 'a1b2c3d4-1234-4567-8901-222222222221', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-222222222221/Complaints Log', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-222222222224', 'Learning and Actions', 'a1b2c3d4-1234-4567-8901-222222222221', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-222222222221/Learning and Actions', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-333333333331', 'Patient Feedback', '86a0ec79-1723-4007-a389-1cf7d8dcb0cc', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '86a0ec79-1723-4007-a389-1cf7d8dcb0cc/Patient Feedback', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-333333333332', 'FFT Results', 'a1b2c3d4-1234-4567-8901-333333333331', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-333333333331/FFT Results', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-333333333333', 'Surveys', 'a1b2c3d4-1234-4567-8901-333333333331', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-333333333331/Surveys', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-333333333334', 'Compliments', 'a1b2c3d4-1234-4567-8901-333333333331', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-333333333331/Compliments', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-444444444441', 'Safeguarding', '86a0ec79-1723-4007-a389-1cf7d8dcb0cc', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '86a0ec79-1723-4007-a389-1cf7d8dcb0cc/Safeguarding', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-444444444442', 'Policies', 'a1b2c3d4-1234-4567-8901-444444444441', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-444444444441/Policies', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-444444444443', 'Training Records', 'a1b2c3d4-1234-4567-8901-444444444441', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-444444444441/Training Records', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-444444444444', 'Referral Pathways', 'a1b2c3d4-1234-4567-8901-444444444441', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-444444444441/Referral Pathways', 'nres_vault'),
-- 07. IT & Digital
('a1b2c3d4-1234-4567-8901-555555555551', 'Systems Documentation', '421f20f6-c77e-4a40-97aa-2a45990cd025', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '421f20f6-c77e-4a40-97aa-2a45990cd025/Systems Documentation', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-555555555552', 'TPP/EMIS Interop Guides', 'a1b2c3d4-1234-4567-8901-555555555551', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-555555555551/TPP EMIS Interop Guides', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-555555555553', 'System Access Protocols', 'a1b2c3d4-1234-4567-8901-555555555551', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-555555555551/System Access Protocols', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-555555555554', 'Configuration Settings', 'a1b2c3d4-1234-4567-8901-555555555551', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-555555555551/Configuration Settings', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-666666666661', 'Information Governance', '421f20f6-c77e-4a40-97aa-2a45990cd025', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '421f20f6-c77e-4a40-97aa-2a45990cd025/Information Governance', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-666666666662', 'DPIAs', 'a1b2c3d4-1234-4567-8901-666666666661', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-666666666661/DPIAs', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-666666666663', 'Data Sharing Agreements', 'a1b2c3d4-1234-4567-8901-666666666661', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-666666666661/Data Sharing Agreements', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-666666666664', 'Privacy Notices', 'a1b2c3d4-1234-4567-8901-666666666661', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-666666666661/Privacy Notices', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-777777777771', 'Digital Tools', '421f20f6-c77e-4a40-97aa-2a45990cd025', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '421f20f6-c77e-4a40-97aa-2a45990cd025/Digital Tools', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-777777777772', 'Patient Access Solutions', 'a1b2c3d4-1234-4567-8901-777777777771', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-777777777771/Patient Access Solutions', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-777777777773', 'Booking Systems', 'a1b2c3d4-1234-4567-8901-777777777771', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-777777777771/Booking Systems', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-888888888881', 'Cyber Security', '421f20f6-c77e-4a40-97aa-2a45990cd025', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '421f20f6-c77e-4a40-97aa-2a45990cd025/Cyber Security', 'nres_vault'),
-- 08. Estates & Facilities
('a1b2c3d4-1234-4567-8901-999999999991', 'Site Information', '04dc5ab6-7c21-4cc2-ae51-092f3b333c58', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '04dc5ab6-7c21-4cc2-ae51-092f3b333c58/Site Information', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-999999999992', 'Practice Site Profiles', 'a1b2c3d4-1234-4567-8901-999999999991', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-999999999991/Practice Site Profiles', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-999999999993', 'Room Allocations', 'a1b2c3d4-1234-4567-8901-999999999991', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-999999999991/Room Allocations', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-999999999994', 'Access Arrangements', 'a1b2c3d4-1234-4567-8901-999999999991', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-999999999991/Access Arrangements', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-aaaaaaaaaaaa', 'Health and Safety', '04dc5ab6-7c21-4cc2-ae51-092f3b333c58', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '04dc5ab6-7c21-4cc2-ae51-092f3b333c58/Health and Safety', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-aaaaaaaaaa02', 'Risk Assessments', 'a1b2c3d4-1234-4567-8901-aaaaaaaaaaaa', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-aaaaaaaaaaaa/Risk Assessments', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-aaaaaaaaaa03', 'Fire Safety', 'a1b2c3d4-1234-4567-8901-aaaaaaaaaaaa', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-aaaaaaaaaaaa/Fire Safety', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-aaaaaaaaaa04', 'Infection Control', 'a1b2c3d4-1234-4567-8901-aaaaaaaaaaaa', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-aaaaaaaaaaaa/Infection Control', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-bbbbbbbbbb01', 'Equipment', '04dc5ab6-7c21-4cc2-ae51-092f3b333c58', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '04dc5ab6-7c21-4cc2-ae51-092f3b333c58/Equipment', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-bbbbbbbbbb02', 'Asset Register', 'a1b2c3d4-1234-4567-8901-bbbbbbbbbb01', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-bbbbbbbbbb01/Asset Register', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-bbbbbbbbbb03', 'Calibration Records', 'a1b2c3d4-1234-4567-8901-bbbbbbbbbb01', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-bbbbbbbbbb01/Calibration Records', 'nres_vault'),
-- 09. Archive & Reference
('a1b2c3d4-1234-4567-8901-cccccccccc01', 'Pre-Go-Live (Planning Phase)', '4e517464-b711-4f8c-87e2-6c438dfed47a', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '4e517464-b711-4f8c-87e2-6c438dfed47a/Pre-Go-Live (Planning Phase)', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-cccccccccc02', 'Business Case', 'a1b2c3d4-1234-4567-8901-cccccccccc01', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-cccccccccc01/Business Case', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-cccccccccc03', 'Mobilisation Documents', 'a1b2c3d4-1234-4567-8901-cccccccccc01', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-cccccccccc01/Mobilisation Documents', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-cccccccccc04', 'Procurement Records', 'a1b2c3d4-1234-4567-8901-cccccccccc01', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-cccccccccc01/Procurement Records', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-dddddddddd01', 'Previous Years', '4e517464-b711-4f8c-87e2-6c438dfed47a', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '4e517464-b711-4f8c-87e2-6c438dfed47a/Previous Years', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-dddddddddd02', '2026-27', 'a1b2c3d4-1234-4567-8901-dddddddddd01', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-dddddddddd01/2026-27', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-dddddddddd03', '2027-28', 'a1b2c3d4-1234-4567-8901-dddddddddd01', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-dddddddddd01/2027-28', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-eeeeeeeeee01', 'Superseded Documents', '4e517464-b711-4f8c-87e2-6c438dfed47a', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', '4e517464-b711-4f8c-87e2-6c438dfed47a/Superseded Documents', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-eeeeeeeeee02', 'Old Policies', 'a1b2c3d4-1234-4567-8901-eeeeeeeeee01', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-eeeeeeeeee01/Old Policies', 'nres_vault'),
('a1b2c3d4-1234-4567-8901-eeeeeeeeee03', 'Previous Versions', 'a1b2c3d4-1234-4567-8901-eeeeeeeeee01', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'a1b2c3d4-1234-4567-8901-eeeeeeeeee01/Previous Versions', 'nres_vault')
ON CONFLICT DO NOTHING;

-- Insert permissions: Malcolm=owner, Amanda Taylor=editor, 26 NRES/PML users=viewer
DO $$
DECLARE
  fid uuid;
  vid uuid;
  folder_ids uuid[];
  viewer_ids uuid[] := ARRAY[
    '049f2e36-5c95-431f-b3a3-16e8ac652e19','05c6c785-7ea5-4914-8a9d-8eff1f26da5c',
    '0f36cc1e-1a4d-43cb-a4d3-6e5a5e799ac0','26b95401-77e0-423b-938b-574e8e8bfc8c',
    '31a9cb05-1a66-4c81-811b-8861874c7f5b','36c8f914-79fc-4176-a85e-b8ea686cf7b9',
    '3eecbf7f-4956-4f29-94d6-21910819b0b5','41c27dc3-347c-4246-9f87-230372dda5a6',
    '41e3e546-d33c-4a7b-8b53-912a950a03c2','44727a2c-c8c2-4f27-9903-f17baf9b8161',
    '499654f6-ea42-4c6e-9b97-19beaea5c834','514765c6-bf4e-4586-aa51-29fce84f43ba',
    '5347f446-6950-4961-85e0-94e2a3e6b388','536b1db6-88a7-4468-98b0-7042470e8db9',
    '6b5b9a26-aa01-439a-8d12-a34a2ffd00f9','6bb16b92-5e8b-486d-a8d7-8445f9c7faf7',
    '752f051e-2d41-4201-ad65-d45ff5d1dc5a','7a1e784a-aac7-43d3-a27e-4f0fc6f0286d',
    '7ed97e1c-4f3c-435d-b753-17424c5aab00','8637a642-97d1-4a5a-ba0f-6ea503a4ae3c',
    'abce833a-7df3-4887-8133-68edcc2a36e5','acac7493-e61e-4433-be15-af19cd6ee60e',
    'b1ec0a34-9b4d-46ca-a9ff-330d8ea67a34','d3c8b2ec-5553-4ccf-99c2-f1ea9348d428',
    'd79315d5-1dc6-47c8-9160-600b84d7db59','d9b232a4-020d-453b-8f3c-ec55a97bb63c'
  ];
BEGIN
  SELECT array_agg(id) INTO folder_ids FROM shared_drive_folders WHERE scope = 'nres_vault' AND id IN (
    'ffa8b1ea-e2a5-40bf-9adb-352311a6f86c','01bf19aa-43fd-4cdd-a3d5-a47fdf3ecf9d','18adbeb8-acf4-4746-8775-1b07f384d27e','30da1c84-9250-4f3f-8d02-d331d922f780',
    'fd063e84-3c0b-4378-bb2f-5b9321bd4c9d','2fbf7247-d0db-41db-85c9-92341add17a1','dd0de14f-6698-45d3-9433-1bcd85aba8aa',
    'ffbb26ec-118b-49e9-9290-79a64a54b6f3','878df4cf-d3dc-4487-9f42-376d171e612d','5d8cafca-14b0-48b1-b722-ea7191084ebc',
    '44a78393-db6b-41d2-9d6c-7876c434e361','99067b65-9af9-41b0-b408-6bf800491b8f','4c14e18c-91ec-4427-af39-8d175bdf533c','40271c74-ac29-42f0-9a8c-96156a71be98',
    '76633ec0-96f8-4358-ac89-ad6c6df713ee','4096c356-e9d1-4205-ad10-f0a77f2abe73','a8f187ce-171c-4dfa-92e1-1c008cf8d8b2',
    '3e05657a-235f-457f-88fa-534a7df28e81','3f3b4de6-9765-4bff-bf99-4de5434d2295','995184e8-10bd-4504-b5fe-de8eb1012e61',
    '40623b8e-a653-477e-b848-870269e07aa5','cdadf106-6f41-4b5e-9f8a-0584b14bb2f5','2be34921-718e-4592-82cd-2648fb681a0d',
    '4e3652e6-443f-493f-b0dd-b822cd13ba48','e30aebbb-cc00-4a3a-a9d6-5525217687e9',
    'c78399e8-6002-4f10-9357-761d6215fa85','69690b8d-ab70-47e3-95a4-2a287020db64','479f6bac-72f0-48e3-8206-882a746309b9','6c4e1814-18e8-43d9-a04d-18cbb5dc4cb9','84d4189d-6444-4f9d-9b21-80772b2f5b90',
    '121b5659-4bdd-43c8-9fe0-65d04880e693','b43c3de7-7e25-41d0-acd4-5a8bd5bf8d5b','6e32d74f-b2f1-48aa-a0c6-7d4a3a6a60ca','a1d22c33-2e8e-4c1b-b2a4-8ef0e1c4f3d7','d8f45a12-3b67-4c89-9e12-7a5b6c8d9e0f',
    'e2f56b23-4c78-4d9a-af23-8b6c7d9e0f1a','f3a67c34-5d89-4eab-b034-9c7d8e0f1a2b','a4b78d45-6e9a-4fbc-c145-ad8e9f1a2b3c','b5c89e56-7fab-4acd-d256-be9f0a2b3c4d',
    'c6d9af67-8abc-4bde-e367-cfa01b3c4d5e',
    'd7eab078-9bcd-4cef-f478-d0b12c4d5e6f','e8fbc189-acde-4df0-a589-e1c23d5e6f7a','f9acd29a-bdef-4ea1-b69a-f2d34e6f7a8b','0abde3ab-cef0-4fb2-c7ab-a3e45f7a8b9c',
    '1bcef4bc-dfa1-4ac3-d8bc-b4f56a8b9cad','2cdf05cd-eab2-4bd4-e9cd-c5a67b9cadbe','3dea16de-fbc3-4ce5-fade-d6b78cadbecf','4efb27ef-acd4-4df6-abef-e7c89dbecfd0',
    '5fac38fa-bde5-4ea7-bcfa-f8d9aecfd0e1','6abd49ab-cef6-4fb8-cdab-a9eabfd0e1f2','7bce5abc-dfa7-4ac9-debc-bafbcae0e1f2','8cdf6bcd-eab8-4bda-efcd-cbacdbf1f2a3',
    '9dea7cde-fbc9-4ceb-fade-dcbdeca2a3b4',
    'aefb8def-acda-4dfc-abef-edcefdb3b4c5','bfac9efa-bdeb-4ead-bcfa-fedfaec4c5d6','cabdafab-cefc-4fbe-cdab-afea0fd5d6e7','dbcebabc-dfad-4acf-debc-bafb1ae6e7f8',
    'ecdfcbcd-eabe-4bda-efcd-cbac2bf7f8a9','fdeadcde-fbcf-4ceb-fade-dcbd3ca8a9ba','aefbedef-acda-4dfc-abef-edce4db9bacb',
    'bfacfefa-bdeb-4ead-bcfa-fede5ecacbdc','cabeafab-cefc-4fbe-cdab-afef6fdbdced','dbcfbabc-dfad-4acf-debc-bafa7aecdefe','ecdacbcd-eabe-4bda-efcd-cbab8bfdefaf',
    'fdebdcde-fbcf-4ceb-fade-dcbc9caefaba',
    'a1b2c3d4-1234-4567-8901-111111111111','a1b2c3d4-1234-4567-8901-111111111112','a1b2c3d4-1234-4567-8901-111111111113','a1b2c3d4-1234-4567-8901-111111111114',
    'a1b2c3d4-1234-4567-8901-222222222221','a1b2c3d4-1234-4567-8901-222222222222','a1b2c3d4-1234-4567-8901-222222222223','a1b2c3d4-1234-4567-8901-222222222224',
    'a1b2c3d4-1234-4567-8901-333333333331','a1b2c3d4-1234-4567-8901-333333333332','a1b2c3d4-1234-4567-8901-333333333333','a1b2c3d4-1234-4567-8901-333333333334',
    'a1b2c3d4-1234-4567-8901-444444444441','a1b2c3d4-1234-4567-8901-444444444442','a1b2c3d4-1234-4567-8901-444444444443','a1b2c3d4-1234-4567-8901-444444444444',
    'a1b2c3d4-1234-4567-8901-555555555551','a1b2c3d4-1234-4567-8901-555555555552','a1b2c3d4-1234-4567-8901-555555555553','a1b2c3d4-1234-4567-8901-555555555554',
    'a1b2c3d4-1234-4567-8901-666666666661','a1b2c3d4-1234-4567-8901-666666666662','a1b2c3d4-1234-4567-8901-666666666663','a1b2c3d4-1234-4567-8901-666666666664',
    'a1b2c3d4-1234-4567-8901-777777777771','a1b2c3d4-1234-4567-8901-777777777772','a1b2c3d4-1234-4567-8901-777777777773',
    'a1b2c3d4-1234-4567-8901-888888888881',
    'a1b2c3d4-1234-4567-8901-999999999991','a1b2c3d4-1234-4567-8901-999999999992','a1b2c3d4-1234-4567-8901-999999999993','a1b2c3d4-1234-4567-8901-999999999994',
    'a1b2c3d4-1234-4567-8901-aaaaaaaaaaaa','a1b2c3d4-1234-4567-8901-aaaaaaaaaa02','a1b2c3d4-1234-4567-8901-aaaaaaaaaa03','a1b2c3d4-1234-4567-8901-aaaaaaaaaa04',
    'a1b2c3d4-1234-4567-8901-bbbbbbbbbb01','a1b2c3d4-1234-4567-8901-bbbbbbbbbb02','a1b2c3d4-1234-4567-8901-bbbbbbbbbb03',
    'a1b2c3d4-1234-4567-8901-cccccccccc01','a1b2c3d4-1234-4567-8901-cccccccccc02','a1b2c3d4-1234-4567-8901-cccccccccc03','a1b2c3d4-1234-4567-8901-cccccccccc04',
    'a1b2c3d4-1234-4567-8901-dddddddddd01','a1b2c3d4-1234-4567-8901-dddddddddd02','a1b2c3d4-1234-4567-8901-dddddddddd03',
    'a1b2c3d4-1234-4567-8901-eeeeeeeeee01','a1b2c3d4-1234-4567-8901-eeeeeeeeee02','a1b2c3d4-1234-4567-8901-eeeeeeeeee03'
  );

  IF folder_ids IS NULL THEN RETURN; END IF;

  FOREACH fid IN ARRAY folder_ids LOOP
    INSERT INTO shared_drive_permissions (target_id, target_type, user_id, permission_level, granted_by, is_inherited, actions)
    VALUES (fid, 'folder', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'owner', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', false, ARRAY['view','edit','delete','share','upload']::permission_action[])
    ON CONFLICT DO NOTHING;

    INSERT INTO shared_drive_permissions (target_id, target_type, user_id, permission_level, granted_by, is_inherited, actions)
    VALUES (fid, 'folder', 'dbefd7c1-47f5-41de-a58e-ab739558af16', 'editor', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', false, ARRAY['view','edit','upload']::permission_action[])
    ON CONFLICT DO NOTHING;

    FOREACH vid IN ARRAY viewer_ids LOOP
      INSERT INTO shared_drive_permissions (target_id, target_type, user_id, permission_level, granted_by, is_inherited, actions)
      VALUES (fid, 'folder', vid, 'viewer', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', false, ARRAY['view']::permission_action[])
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;