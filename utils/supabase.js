import { createClient } from '@supabase/supabase-js'

// These grab the secret keys you just put in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// This creates the actual bridge you will use across your app
export const supabase = createClient(supabaseUrl, supabaseAnonKey)