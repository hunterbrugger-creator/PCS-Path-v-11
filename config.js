// PCS Path configuration.
//
// Leave both values empty to run in DEMO MODE: everything works, and data is
// saved only in this browser.
//
// To use the real backend, create a free Supabase project (see SETUP.md), then
// paste its Project URL and its "anon" / "publishable" key below. That key is
// designed to be public; the database's row level security rules decide who
// can see and change what. Never put the "service_role" / secret key here.
window.PCS_CONFIG = {
  supabaseUrl: 'https://woutdyofkoqakaorhllu.supabase.co',
  supabaseAnonKey: 'sb_publishable_fI5iLQvEfKwDuhzdF-hcAQ_KF46q8nF'
};
