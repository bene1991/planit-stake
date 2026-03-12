import fs from 'fs';
const envConfig = fs.readFileSync('.env', 'utf-8')
  .split('\n')
  .filter(line => line.includes('='))
  .reduce((acc, line) => {
    const [key, val] = line.split('=');
    acc[key] = val.replace(/"/g, '').trim();
    return acc;
  }, {});

const PENDINGS = ["1505010", "1505394", "1512527"];

async function main() {
    for (const fId of PENDINGS) {
        
        let goalsStr = '';
        if (fId === '1505010') goalsStr = "65', 90+4'";
        if (fId === '1505394') goalsStr = "38', 56'";
        if (fId === '1512527') goalsStr = "16', 53'";

        console.log(`Updating ${fId}: GREEN ${goalsStr} 1x1`);

        const updateRes = await fetch('https://script.google.com/macros/s/AKfycbzp1ZngBLwh8jwt7TZUGHgohQZSfd-Gpz1-vTISriNzd9YTGINO9ogqB318Vy-9Uqth/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'UPDATE_ALERT',
            fixtureId: fId,
            goalsInterval: goalsStr,
            finalScore: '1x1',
            result: 'GREEN'
          })
        });
        console.log(fId, updateRes.status, await updateRes.text());
    }
}
main();
