import * as cheerio from 'cheerio';
const res = await fetch('https://www.dnit.gov.py/web/portal-institucional/normativas', {
  headers: { 'User-Agent': 'Mozilla/5.0' }
});
const html = await res.text();
const $ = cheerio.load(html);
const items = [];
try {
  $('div.card__item').each((_, el) => {
    const title = $(el).find('h5.card__item-title').text().trim();
    const linkEl = $(el).find('a.card__item-link');
    let link = linkEl.attr('href');
    const desc = $(el).find('p.card__item-description').text().trim();
    if (title && link) {
      link = link.startsWith('http') ? link : new URL(link, 'https://www.dnit.gov.py').href;
      items.push({ titulo: title, link, fecha_publicacion: desc });
    }
  });
  console.log('OK:', items.length, 'items');
  items.forEach(i => console.log(' -', i.titulo));
} catch(e) {
  console.log('ERROR:', e.message);
  console.log(e.stack);
}