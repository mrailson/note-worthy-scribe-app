DELETE FROM public.meeting_action_items
WHERE meeting_id IN (
  '1950cad3-3e44-479c-befc-10b365015b4f',
  'cbe9aa81-b6ee-439a-a119-c2a388609aa0'
);

INSERT INTO public.meeting_action_items (
  meeting_id,
  user_id,
  action_text,
  assignee_name,
  assignee_type,
  due_date,
  priority,
  status,
  sort_order
) VALUES
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Resend urology research details to Pratima', 'Lisa', 'custom', 'No date specified', 'Medium', 'Open', 0),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Review UHN urology research details and engage with the KGH urology team', 'Pratima', 'custom', 'No date specified', 'Medium', 'Open', 1),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Resend email to Fatima regarding linkage to EDI Lead', 'Lisa', 'custom', 'No date specified', 'Medium', 'Open', 2),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Provide high-level funding breakdown for OPIT £8 million across activities and research, following Friday funder meeting', 'Paul / ICB Lead', 'custom', 'Following Friday 1 May 2026 meeting', 'Medium', 'Open', 3),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Provide written summary of practical support service routes and descriptions (PCN/ARD level and local authority perspectives) to support Spring transition communications', 'System leads (ICB primary care and local authority)', 'custom', 'Approximately June 2026 (referral closure date)', 'Medium', 'Open', 4),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Follow up to obtain and circulate minutes of the proactive care oversight meeting held 21 April 2026', 'Simon / Minute-taker', 'custom', 'No date specified', 'Medium', 'Open', 5),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Arrange for Glen (or a colleague) to present a WorkWell programme update at the next meeting', 'Paul / Relevant lead', 'custom', 'Next meeting', 'Medium', 'Open', 6),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Investigate completeness of primary care vaping/smoking coding and NARP pull-through; report on coding consistency', 'Data team', 'custom', 'No date specified', 'Medium', 'Open', 7),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Circulate maternity community engagement communication pack; obtain maternity comms plan and timescales from the team; share patient engagement feedback with the group', 'Lisa', 'custom', 'No date specified', 'Medium', 'Open', 8),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Circulate Women''s and Girls'' Health Strategy launch summary and working group details', 'Lisa', 'custom', 'No date specified', 'Medium', 'Open', 9),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Follow up with Morgan (NHFT) regarding attendance and engagement at future meetings', 'Paul / Relevant lead', 'custom', 'No date specified', 'Medium', 'Open', 10),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Circulate summary and working groups list from the UHL–UHN health equalities session (20 May 2026)', 'ICB Lead', 'custom', 'By next meeting', 'Medium', 'Open', 11),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Coordinate with Chris Ainsworth regarding a Women''s Health Strategy update for the next meeting agenda', 'ICB Lead', 'custom', 'Next meeting', 'Medium', 'Open', 12),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Meet with WNC consultant to gather information on the "Big Conversation" opportunity (May–June 2026); brief the group at next meeting', 'ICB Lead', 'custom', '30 April 2026; report at next meeting', 'Medium', 'Open', 13),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Develop a community engagement and patient feedback approach for the outcomes framework using accessible, simplified language', 'ICB Lead', 'custom', 'Post-21 May 2026 workshop', 'Medium', 'Open', 14),
('1950cad3-3e44-479c-befc-10b365015b4f', 'e3aea82f-451b-40fb-8681-2b579a92dc3a', 'Raise awareness of the Action for Happiness initiative across relevant ICB forums and structures; report back with recommendations on governance and commissioning clarity', 'ICB Lead', 'custom', 'To report back with recommendations', 'Medium', 'Open', 15);