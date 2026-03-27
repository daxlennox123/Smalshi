ALTER TABLE markets
ADD COLUMN option_a text DEFAULT 'Yes' NOT NULL,
ADD COLUMN option_b text DEFAULT 'No' NOT NULL,
ADD COLUMN p_initial numeric DEFAULT 0.5 NOT NULL,
ADD COLUMN i_initial numeric DEFAULT 10 NOT NULL;

ALTER TABLE bets
ADD COLUMN prob_at_time numeric;
