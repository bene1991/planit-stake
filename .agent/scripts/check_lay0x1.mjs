import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

let configStrStr = '';
try { configStrStr = fs.readFileSync('/Users/vinicius/TRADE/planit-stake/.env.local', 'utf-8'); } catch(e) {}
if (!configStrStr) {
try { configStrStr = fs.readFileSync('/Users/vinicius/TRADE/planit-stake/.env', 'utf-8'); } catch(e) {}
}

const env = Object.fromEntries(configStrStr.split('\n').filter(line => line.includes('=')).map(line => {
  const [k, ...v] = line.split('=');
  return [k.trim(), v.join('=').trim().replace(/"/g, '')];
}));

const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) {
  console.log("No service key found.");
  // Let's print out what keys we have
  console.log("Keys available:", Object.keys(env));
}

// Let's try inserting via API to see if it works!
