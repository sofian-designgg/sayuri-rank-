/**
 * Test local de la carte sans Discord : écrit sayuri-rank-test.png à la racine du projet.
 * Utile si les assets sont en place mais le bot pas encore lancé.
 */

const fs = require('fs');
const path = require('path');
const { generateSayuriCard, mockRankData } = require('./generateSayuriCard');

async function main() {
  try {
    const attachment = await generateSayuriCard(null, mockRankData);
    const buf = attachment.attachment;
    const out = path.join(__dirname, '..', 'sayuri-rank-test.png');
    fs.writeFileSync(out, buf);
    console.log('OK — image écrite :', out);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
