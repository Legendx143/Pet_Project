# Pet-Care database

`supabase/migrations/202610080001_create_profiles.sql` is the database migration for Pet-Care.

It creates `public.profiles`, with the normalized email as its primary key and a unique `user_id` that references Supabase Auth. Passwords are **not** added to this table: Supabase Auth stores them in its private `auth.users` system schema using secure password hashing.

Apply the migration in the Supabase SQL Editor after creating the project, or run it with the Supabase CLI against the linked project. The table has Row Level Security enabled; an authenticated user can only read their own profile.
