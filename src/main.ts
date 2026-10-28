import '@fontsource-variable/manrope/wght.css';
import '@fontsource-variable/bricolage-grotesque/wght.css';
import './app.css';
import { mount } from 'svelte';
import { isTauri } from '@tauri-apps/api/core';
import App from './App.svelte';
import Update from './lib/Update.svelte';
import { config } from './lib/supabase';

// The release desktop app updates itself; the web and local builds don't.
if (config.release && isTauri()) mount(Update, { target: document.body });

export default mount(App, { target: document.getElementById('app')! });
