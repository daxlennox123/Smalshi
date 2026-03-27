-- Enable implicit required extensions
create extension if not exists "uuid-ossp";

-- Create profiles table
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  credits integer NOT NULL DEFAULT 10,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Create markets table
CREATE TABLE public.markets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question text NOT NULL,
  description text,
  resolved boolean NOT NULL DEFAULT false,
  resolution text, -- 'YES' or 'NO' or 'CANCELLED'
  yes_price integer NOT NULL DEFAULT 50, -- Out of 100
  no_price integer NOT NULL DEFAULT 50, -- Out of 100
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Markets are viewable by everyone." ON public.markets FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert markets." ON public.markets FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creator can update market." ON public.markets FOR UPDATE USING (auth.uid() = creator_id);

-- Create bets table
CREATE TABLE public.bets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('YES', 'NO')),
  amount integer NOT NULL, -- The cost in credits
  shares integer NOT NULL, -- The number of shares bought
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (id)
);

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bets are viewable by everyone." ON public.bets FOR SELECT USING (true);
CREATE POLICY "Users can insert their own bets." ON public.bets FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger to create profile and grant initial credits on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Strict check for @smtexas.org emails
  IF new.email NOT LIKE '%@smtexas.org' THEN
    RAISE EXCEPTION 'Only @smtexas.org emails are allowed';
  END IF;

  INSERT INTO public.profiles (id, email, credits)
  VALUES (new.id, new.email, 10);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
