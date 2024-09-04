const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');

const url = 'https://www.upwork.com/nx/search/jobs/?client_hires=1-9,10-&location=Canada&nbs=1&q=graphic%20designer&sort=recency';

async function fetchJobsAndNotify() {
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new', 
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(120000);

        // Aller à l'URL spécifiée
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Injecter un script pour déclencher un événement une fois que les jobs sont chargés
        await page.evaluate(() => {
            const checkJobsLoaded = setInterval(() => {
                const jobs = document.querySelectorAll('.job-tile');
                if (jobs.length > 0) {
                    document.dispatchEvent(new Event('jobsLoaded'));
                    clearInterval(checkJobsLoaded);
                }
            }, 1000);
        });

        // Attendre que l'événement 'jobsLoaded' soit déclenché
        await page.waitForEvent('jobsLoaded', { timeout: 120000 });

        // Obtenir le contenu HTML de la page
        const html = await page.content();
        fs.writeFileSync('pageContent.html', html); 

        const $ = cheerio.load(html);
        const jobs = [];

        $('.job-tile').each((index, element) => {
            const title = $(element).find('.job-title a').text().trim();
            const link = 'https://www.upwork.com' + $(element).find('.job-title a').attr('href');
            const description = $(element).find('.job-description').text().trim();

            if (title && link) {
                jobs.push({ title, link, description });
            }
        });

        if (jobs.length === 0) {
            console.log('No new jobs found.');
            return;
        }

        console.log('Jobs found and processed successfully!');
    } catch (error) {
        console.error('Error fetching or processing jobs:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

fetchJobsAndNotify();
