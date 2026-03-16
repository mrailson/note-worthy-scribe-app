ALTER TABLE public.profiles DROP CONSTRAINT valid_nhs_email;

ALTER TABLE public.profiles ADD CONSTRAINT valid_nhs_email CHECK (
  email ~~* '%@nhs.net' OR
  email ~~* '%@nhs.uk' OR
  email ~~* '%.nhs.uk' OR
  email = 'egplearning@gmail.com'
);