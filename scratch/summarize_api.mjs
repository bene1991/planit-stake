import fs from 'fs';

async function summarize() {
    const supabaseUrl = "https://zswefmaedkdvbzakuzod.supabase.co";
    const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2VmbWFlZGtkdmJ6YWt1em9kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjE0MDA1NSwiZXhwIjoyMDg3NzE2MDU1fQ.CTHHkEianuuaSzQgZdHrxHukBCl86MjauTGvjiFhbwA";
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    console.log(`Summarizing API Requests for ${todayIso.split('T')[0]}`);

    let allLogs = [];
    let page = 0;
    const pageSize = 1000;

    while (true) {
        const url = `${supabaseUrl}/rest/v1/api_cache?select=cache_key,created_at&created_at=gte.${todayIso}&limit=${pageSize}&offset=${page * pageSize}`;
        const res = await fetch(url, {
            headers: {
                'apikey': apiKey,
                'Authorization': `Bearer ${apiKey}`
            }
        });
        const data = await res.json();
        if (!data || data.length === 0) break;
        allLogs = allLogs.concat(data);
        page++;
        if (data.length < pageSize) break;
        if (allLogs.length > 20000) break; // Safety
    }

    const summary = {};
    allLogs.forEach(entry => {
        const ep = entry.cache_key.split('?')[0];
        summary[ep] = (summary[ep] || 0) + 1;
    });

    console.log("\nRequests by Endpoint:");
    Object.entries(summary).sort((a,b) => b[1] - a[1]).forEach(([ep, count]) => {
        console.log(`${ep}: ${count}`);
    });

    console.log(`\nTotal unique requests today (recorded in cache): ${allLogs.length}`);
}

summarize();
