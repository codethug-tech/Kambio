-- ============================================================
-- Kambio MVP — Initial Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE listing_type AS ENUM ('cambio', 'trueque', 'servicio');
CREATE TYPE listing_status AS ENUM ('active', 'paused', 'completed', 'hidden');
CREATE TYPE trade_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE report_target AS ENUM ('user', 'listing');
CREATE TYPE currency_type AS ENUM ('bs', 'usd', 'zelle', 'paypal', 'crypto', 'cash', 'other');

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE public.users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id       UUID UNIQUE,                    -- links to Supabase Auth uid
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  phone         TEXT,
  city          TEXT,
  state         TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  rating        NUMERIC(3,2) DEFAULT 0,
  trades_count  INTEGER DEFAULT 0,
  is_blocked    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LISTINGS
-- ============================================================

CREATE TABLE public.listings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          listing_type NOT NULL,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  offer_text    TEXT NOT NULL,
  want_text     TEXT NOT NULL,
  currency_type currency_type DEFAULT 'other',
  city          TEXT,
  state         TEXT,
  neighborhood  TEXT,
  status        listing_status DEFAULT 'active',
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_listings_user_id   ON public.listings(user_id);
CREATE INDEX idx_listings_status    ON public.listings(status);
CREATE INDEX idx_listings_type      ON public.listings(type);
CREATE INDEX idx_listings_city      ON public.listings(city);
CREATE INDEX idx_listings_category  ON public.listings(category);

-- ============================================================
-- LISTING PHOTOS
-- ============================================================

CREATE TABLE public.listing_photos (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id  UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  "order"     INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FAVORITES
-- ============================================================

CREATE TABLE public.favorites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  listing_id  UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, listing_id)
);

-- ============================================================
-- CHAT THREADS
-- ============================================================

CREATE TABLE public.chat_threads (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id  UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seller_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (listing_id, buyer_id)
);

CREATE INDEX idx_threads_buyer  ON public.chat_threads(buyer_id);
CREATE INDEX idx_threads_seller ON public.chat_threads(seller_id);

-- ============================================================
-- CHAT MESSAGES
-- ============================================================

CREATE TABLE public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id   UUID NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_thread ON public.chat_messages(thread_id);

-- ============================================================
-- TRADES
-- ============================================================

CREATE TABLE public.trades (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id  UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  thread_id   UUID REFERENCES public.chat_threads(id),
  buyer_id    UUID NOT NULL REFERENCES public.users(id),
  seller_id   UUID NOT NULL REFERENCES public.users(id),
  status      trade_status DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RATINGS
-- ============================================================

CREATE TABLE public.ratings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id    UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  rater_id    UUID NOT NULL REFERENCES public.users(id),
  rated_id    UUID NOT NULL REFERENCES public.users(id),
  score       SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (trade_id, rater_id)   -- one rating per person per trade
);

-- ============================================================
-- REPORTS
-- ============================================================

CREATE TABLE public.reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id  UUID NOT NULL REFERENCES public.users(id),
  target_type  report_target NOT NULL,
  target_id    UUID NOT NULL,
  reason       TEXT NOT NULL,
  resolved     BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUNCTION: update updated_at on row change
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_trades_updated_at
  BEFORE UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCTION: recalculate user rating after new rating inserted
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET rating = (
    SELECT ROUND(AVG(score)::numeric, 2)
    FROM public.ratings
    WHERE rated_id = NEW.rated_id
  ),
  trades_count = (
    SELECT COUNT(*)
    FROM public.ratings
    WHERE rated_id = NEW.rated_id
  )
  WHERE id = NEW.rated_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_rating
  AFTER INSERT ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION refresh_user_rating();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_photos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports         ENABLE ROW LEVEL SECURITY;

-- Users: anyone can read, only self can write
CREATE POLICY "users_read_all"   ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = auth_id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = auth_id);

-- Listings: active listings readable by all; owner can CRUD
CREATE POLICY "listings_read_active"   ON public.listings FOR SELECT USING (status != 'hidden');
CREATE POLICY "listings_insert_auth"   ON public.listings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.id = user_id)
);
CREATE POLICY "listings_update_owner"  ON public.listings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.id = user_id)
);
CREATE POLICY "listings_delete_owner"  ON public.listings FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.id = user_id)
);

-- Listing photos: readable by all
CREATE POLICY "photos_read_all"   ON public.listing_photos FOR SELECT USING (true);
CREATE POLICY "photos_owner_write" ON public.listing_photos FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.listings l
    JOIN public.users u ON u.id = l.user_id
    WHERE l.id = listing_id AND u.auth_id = auth.uid()
  )
);

-- Favorites: user can manage own
CREATE POLICY "favorites_own" ON public.favorites USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.id = user_id)
);

-- Chat threads: only participants
CREATE POLICY "threads_participants" ON public.chat_threads FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND (u.id = buyer_id OR u.id = seller_id))
);
CREATE POLICY "threads_insert" ON public.chat_threads FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.id = buyer_id)
);

-- Messages: only thread participants
CREATE POLICY "messages_participants" ON public.chat_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.chat_threads t
    JOIN public.users u ON u.auth_id = auth.uid()
    WHERE t.id = thread_id AND (u.id = t.buyer_id OR u.id = t.seller_id)
  )
);
CREATE POLICY "messages_send" ON public.chat_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.id = sender_id)
);

-- Trades: participants only
CREATE POLICY "trades_participants" ON public.trades FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND (u.id = buyer_id OR u.id = seller_id))
);
CREATE POLICY "trades_insert" ON public.trades FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.id = buyer_id)
);
CREATE POLICY "trades_update_participants" ON public.trades FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND (u.id = buyer_id OR u.id = seller_id))
);

-- Ratings: trade participants
CREATE POLICY "ratings_read" ON public.ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert" ON public.ratings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.id = rater_id)
);

-- Reports: own only
CREATE POLICY "reports_insert" ON public.reports FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.id = reporter_id)
);
