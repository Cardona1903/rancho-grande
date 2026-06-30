import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://vuzfuucdxbxfwiuylvuj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1emZ1dWNkeGJ4ZndpdXlsdnVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NTQxMTMsImV4cCI6MjA5ODMzMDExM30.wPvEWVWrvVnvC8Yj_rh_XTBzOR_zM1vNd9n2A-FL8Rw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
