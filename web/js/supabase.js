import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

// A sessão fica guardada no navegador, então o login sobrevive a recarregar a página.
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
