-- ============================================================
-- Migration: Add missing columns, RPCs, and RLS policies
-- ============================================================

-- 1. Add missing columns to markets
ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS end_date timestamp with time zone,
  ADD COLUMN IF NOT EXISTS option_a text NOT NULL DEFAULT 'Yes',
  ADD COLUMN IF NOT EXISTS option_b text NOT NULL DEFAULT 'No',
  ADD COLUMN IF NOT EXISTS p_initial numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS i_initial numeric NOT NULL DEFAULT 10;

-- 2. Add missing columns to bets
ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS prob_at_time numeric,
  ADD COLUMN IF NOT EXISTS is_exited boolean NOT NULL DEFAULT false;

-- Drop the old shares column constraint if needed (shares was required, now optional)
-- The original schema had "shares integer NOT NULL" but the app no longer uses it.
-- Make it nullable so existing inserts won't break.
ALTER TABLE public.bets
  ALTER COLUMN shares DROP NOT NULL;

-- 3. RLS: Allow users to update their own bets (needed for is_exited)
DROP POLICY IF EXISTS "Users can update own bets." ON public.bets;
CREATE POLICY "Users can update own bets." ON public.bets
  FOR UPDATE USING (auth.uid() = user_id);

-- 4. RLS: Allow creator to update markets (resolution)
DROP POLICY IF EXISTS "Creator can update market." ON public.markets;
CREATE POLICY "Creator can update market." ON public.markets
  FOR UPDATE USING (auth.uid() = creator_id);

-- ============================================================
-- RPC: place_bet
-- Atomically deducts credits and inserts a bet, updating the market price.
-- ============================================================
CREATE OR REPLACE FUNCTION public.place_bet(
  p_market_id uuid,
  p_outcome   text,
  p_amount    integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_credits   integer;
  v_market    markets%ROWTYPE;
  v_pool_yes  numeric := 0;
  v_pool_no   numeric := 0;
  v_new_prob  numeric;
BEGIN
  -- Get caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check credits
  SELECT credits INTO v_credits
  FROM profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_credits IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_credits < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits. You have %¢ but need %¢.', v_credits, p_amount;
  END IF;

  -- Lock market row
  SELECT * INTO v_market
  FROM markets
  WHERE id = p_market_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Market not found';
  END IF;

  IF v_market.resolved THEN
    RAISE EXCEPTION 'Market is already resolved';
  END IF;

  IF v_market.end_date IS NOT NULL AND now() > v_market.end_date THEN
    RAISE EXCEPTION 'Market has closed';
  END IF;

  -- Compute current pool totals from active (non-exited) bets
  SELECT
    COALESCE(SUM(CASE WHEN UPPER(outcome) = 'YES' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN UPPER(outcome) = 'NO'  THEN amount ELSE 0 END), 0)
  INTO v_pool_yes, v_pool_no
  FROM bets
  WHERE market_id = p_market_id AND is_exited = false;

  -- Add this bet to the pool
  IF UPPER(p_outcome) = 'YES' THEN
    v_pool_yes := v_pool_yes + p_amount;
  ELSE
    v_pool_no := v_pool_no + p_amount;
  END IF;

  -- WPAM probability: P = (p_initial * i_initial + pool_yes) / (i_initial + pool_yes + pool_no)
  v_new_prob := (v_market.p_initial * v_market.i_initial + v_pool_yes)
              / (v_market.i_initial + v_pool_yes + v_pool_no);

  -- Deduct credits from user
  UPDATE profiles
  SET credits = credits - p_amount
  WHERE id = v_user_id;

  -- Insert bet record
  INSERT INTO bets (user_id, market_id, outcome, amount, shares, prob_at_time, is_exited)
  VALUES (v_user_id, p_market_id, UPPER(p_outcome), p_amount, p_amount, v_new_prob, false);

  -- Update market prices
  UPDATE markets
  SET
    yes_price = ROUND(v_new_prob * 100),
    no_price  = 100 - ROUND(v_new_prob * 100)
  WHERE id = p_market_id;
END;
$$;

-- ============================================================
-- RPC: resolve_market
-- Resolves market and distributes payouts to winning bettors.
-- ============================================================
CREATE OR REPLACE FUNCTION public.resolve_market(
  p_market_id  uuid,
  p_resolution text   -- 'YES' or 'NO'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_market     markets%ROWTYPE;
  v_res_prob   numeric;
  v_total_pool numeric;
  v_pool_yes   numeric;
  v_pool_no    numeric;
  r            RECORD;
  v_payout     integer;
BEGIN
  v_user_id := auth.uid();

  -- Only creator can resolve
  SELECT * INTO v_market FROM markets WHERE id = p_market_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Market not found'; END IF;
  IF v_market.creator_id <> v_user_id THEN RAISE EXCEPTION 'Only the creator can resolve this market'; END IF;
  IF v_market.resolved THEN RAISE EXCEPTION 'Market already resolved'; END IF;

  -- resolution probability
  IF UPPER(p_resolution) = 'YES' THEN
    v_res_prob := 1.0;
  ELSIF UPPER(p_resolution) = 'NO' THEN
    v_res_prob := 0.0;
  ELSE
    RAISE EXCEPTION 'Resolution must be YES or NO';
  END IF;

  -- Compute pool totals from non-exited bets
  SELECT
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(CASE WHEN UPPER(outcome) = 'YES' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN UPPER(outcome) = 'NO'  THEN amount ELSE 0 END), 0)
  INTO v_total_pool, v_pool_yes, v_pool_no
  FROM bets
  WHERE market_id = p_market_id AND is_exited = false;

  -- Simple proportional payout: winners split the whole pool
  -- Each winner gets back their stake * (total_pool / winning_pool)
  FOR r IN
    SELECT id, user_id, amount, outcome, prob_at_time
    FROM bets
    WHERE market_id = p_market_id AND is_exited = false
  LOOP
    IF UPPER(r.outcome) = UPPER(p_resolution) THEN
      -- Winner: proportional share of total pool
      IF (CASE WHEN UPPER(p_resolution) = 'YES' THEN v_pool_yes ELSE v_pool_no END) > 0 THEN
        v_payout := ROUND(
          r.amount::numeric *
          v_total_pool /
          (CASE WHEN UPPER(p_resolution) = 'YES' THEN v_pool_yes ELSE v_pool_no END)
        );
      ELSE
        v_payout := 0;
      END IF;
      UPDATE profiles SET credits = credits + v_payout WHERE id = r.user_id;
    END IF;
    -- Mark all bets as exited
    UPDATE bets SET is_exited = true WHERE id = r.id;
  END LOOP;

  -- Mark market as resolved
  UPDATE markets
  SET resolved = true, resolution = UPPER(p_resolution)
  WHERE id = p_market_id;
END;
$$;

-- ============================================================
-- RPC: exit_bet
-- Cashout a single bet at the current mark-to-market price.
-- Returns the payout amount.
-- ============================================================
CREATE OR REPLACE FUNCTION public.exit_bet(
  p_bet_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid;
  v_bet       bets%ROWTYPE;
  v_market    markets%ROWTYPE;
  v_pool_yes  numeric := 0;
  v_pool_no   numeric := 0;
  v_curr_prob numeric;
  v_pe        numeric;
  v_pn        numeric;
  v_payout    integer;
BEGIN
  v_user_id := auth.uid();

  -- Lock the bet
  SELECT * INTO v_bet FROM bets WHERE id = p_bet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF v_bet.user_id <> v_user_id THEN RAISE EXCEPTION 'Not your bet'; END IF;
  IF v_bet.is_exited THEN RAISE EXCEPTION 'Bet already exited'; END IF;

  -- Fetch market
  SELECT * INTO v_market FROM markets WHERE id = v_bet.market_id;
  IF v_market.resolved THEN RAISE EXCEPTION 'Market already resolved; use the resolution payout instead'; END IF;

  -- Compute current pool totals (excluding this bet)
  SELECT
    COALESCE(SUM(CASE WHEN UPPER(outcome) = 'YES' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN UPPER(outcome) = 'NO'  THEN amount ELSE 0 END), 0)
  INTO v_pool_yes, v_pool_no
  FROM bets
  WHERE market_id = v_bet.market_id AND is_exited = false AND id <> p_bet_id;

  -- WPAM current probability
  v_curr_prob := (v_market.p_initial * v_market.i_initial + v_pool_yes)
               / GREATEST(v_market.i_initial + v_pool_yes + v_pool_no, 0.0001);

  -- Mark-to-market cashout
  v_pe := GREATEST(0, LEAST(1, COALESCE(v_bet.prob_at_time, 0.5)));
  v_pn := GREATEST(0, LEAST(1, v_curr_prob));

  IF UPPER(v_bet.outcome) = 'YES' THEN
    IF v_pe <= 0 THEN
      v_payout := v_bet.amount;
    ELSE
      v_payout := GREATEST(0, ROUND((v_bet.amount::numeric * v_pn) / v_pe));
    END IF;
  ELSE
    IF v_pe >= 1 THEN
      v_payout := v_bet.amount;
    ELSE
      v_payout := GREATEST(0, ROUND((v_bet.amount::numeric * (1 - v_pn)) / (1 - v_pe)));
    END IF;
  END IF;

  -- Apply
  UPDATE bets SET is_exited = true WHERE id = p_bet_id;
  UPDATE profiles SET credits = credits + v_payout WHERE id = v_user_id;

  -- Recompute and update market price after the bet exits
  SELECT
    COALESCE(SUM(CASE WHEN UPPER(outcome) = 'YES' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN UPPER(outcome) = 'NO'  THEN amount ELSE 0 END), 0)
  INTO v_pool_yes, v_pool_no
  FROM bets
  WHERE market_id = v_bet.market_id AND is_exited = false;

  v_curr_prob := (v_market.p_initial * v_market.i_initial + v_pool_yes)
               / GREATEST(v_market.i_initial + v_pool_yes + v_pool_no, 0.0001);

  UPDATE markets
  SET yes_price = ROUND(v_curr_prob * 100), no_price = 100 - ROUND(v_curr_prob * 100)
  WHERE id = v_bet.market_id;

  RETURN v_payout;
END;
$$;
