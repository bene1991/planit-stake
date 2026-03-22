import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/api-football`;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function test(label, headers) {
    console.log(`Testing: ${label}`);
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify({
            endpoint: 'fixtures',
            params: { id: 1398599 }
        })
    });
    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text.substring(0, 100));
}

async function runTests() {
    const legacyKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNDAwNTUsImV4cCI6MjA4NzcxNjA1NX0.aUjcFT8bnBot2L8pqqb5Z1xUbs78LkO6CRSz1vCkZ2E';
    const pubKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    await test("Authorization + apikey (Service)", { 'Authorization': `Bearer ${key}`, 'apikey': key });
    await test("Legacy Key (Authorization)", { 'Authorization': `Bearer ${legacyKey}` });
    await test("Legacy Key (apikey)", { 'apikey': legacyKey });
    await test("Publishable Key (Authorization)", { 'Authorization': `Bearer ${pubKey}` });
    await test("Publishable Key (apikey)", { 'apikey': pubKey });
}

runTests();
