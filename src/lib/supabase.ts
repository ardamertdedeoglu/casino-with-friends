import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.CASINO_SUPABASE_URL || 'https://dttyruqikdadyqthycuu.supabase.co'
const supabaseAnonKey = process.env.CASINO_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0dHlydXFpa2RhZHlxdGh5Y3V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0OTMyMDQsImV4cCI6MjA3MjA2OTIwNH0.6Ewm-gJ8moPxBcm7yQ_M4tDMJPpfKpU-H84yIADic-U'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
