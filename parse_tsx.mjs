import { parse } from '@babel/parser';
import fs from 'fs';

const code = fs.readFileSync('src/pages/robo/RoboSimulationTab.tsx', 'utf8');

try {
    parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
    });
    console.log('No syntax errors found');
} catch (e) {
    console.log('Syntax Error:', e.message);
    console.log('Location:', e.loc);
}
