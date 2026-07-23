-- Promote a user to admin by email.
-- Run in Supabase SQL editor after the user has signed up at least once
-- (the on_auth_user_created trigger must have created their profiles row).

update public.profiles
set role = 'admin'
where email = 'admin@gmail.com';

-- Verify:
select id, email, role from public.profiles where email = 'admin@gmail.com';
gghjhgj