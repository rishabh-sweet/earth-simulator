// Supabase client for Wanderglobe cloud sync. Shared by both the landing page
// (user upsert on login) and the globe app (pins / trips / challenges sync,
// plus read-only shared globes).
//
// The anon (publishable) key is safe to ship in the browser — row access is
// governed by the table policies in supabase/schema.sql. If Supabase is ever
// unreachable, every caller falls back to localStorage silently (see cloudSync).

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://oatzactosbwpomyjqlbt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Oi_OScKXlCYww2cWiw03Cw_D7YT4Nnj';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false }, // we use our own localStorage identity, not Supabase Auth
});
