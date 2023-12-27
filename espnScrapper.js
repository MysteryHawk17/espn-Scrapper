const baseUrl = 'https://www.espncricinfo.com';
const axios = require("axios")
const cheerio = require("cheerio");
const path = require('path');
const fs = require("fs").promises;
const ExcelJS = require("exceljs");
const apiCall = async (url) => {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.log(error);
        return error;
    }
}


const getAllMatchesPage = async (url) => {
    const data = await apiCall(url + '/series/indian-premier-league-2023-1345038');
    const $ = cheerio.load(data);
    const link = $("a[title='View All Results']");
    const exten = link.attr("href");
    console.log(exten);
    console.log(url + exten);
    await getAllGamesPages(url + exten)
}
const allData = {};

const getAllGamesPages = async (url) => {
    const newData = await apiCall(url);
    const $ = cheerio.load(newData);
    
    const linkElememt = $('div.ds-grow.ds-px-4.ds-border-r.ds-border-line-default-translucent > a.ds-no-tap-higlight')
    console.log(linkElememt.length);


    for (let i = 0; i < linkElememt.length; i++) {
        let link = $(linkElememt[i]).attr('href');
        console.log(baseUrl + link);
        await matchDetails(baseUrl + link);
       
    }
}



const matchDetails = async (url) => {
    const data = await apiCall(url);
    const $ = cheerio.load(data);
    const teams = $("div.ci-team-score.ds-flex.ds-justify-between.ds-items-center.ds-text-typo.ds-mb-2 > div.ds-flex.ds-items-center.ds-min-w-0.ds-mr-1");
    const teamBattingResult = $("table.ds-w-full.ds-table.ds-table-md.ds-table-auto.ci-scorecard-table");
    const result = $("p.ds-text-tight-m.ds-font-regular.ds-truncate.ds-text-typo").text();
    const locationDetails = $('div.ds-text-tight-m.ds-font-regular.ds-text-typo-mid3').text();
    const location = locationDetails.split(',')[1];
    const date = locationDetails.split(',')[2] + locationDetails.split(',')[3];
    
    for (var i = 0; i < teamBattingResult.length; i++) {
        const teamName = $(teams[i]).attr('title');
        const folderPath = `/${teamName}`
        fs.access(folderPath)
            .then(() => {
                
            })
            .catch(async () => {
                const teamFolder = `iplFolder/${teamName}`;
                await createFolder(teamFolder);
            });
        if (!(teamName in allData)) {
            allData[teamName] = {};
        }
        const $$ = cheerio.load(teamBattingResult[i]);
        const playerDetail = $$('tr[class=""]')

        for (let j = 0; j < playerDetail.length - 2; j++) {
            const player = cheerio.load(playerDetail[j]);
            const playerDetails = {};
            playerDetails.name = player("a.ds-inline-flex.ds-items-start.ds-leading-none").attr('title');
            playerDetails.run = player("strong").text();
            playerDetails.balls = $(player("td.ds-w-0.ds-whitespace-nowrap.ds-min-w-max.ds-text-right")[1]).text();
            playerDetails.fours = $(player("td.ds-w-0.ds-whitespace-nowrap.ds-min-w-max.ds-text-right")[3]).text();
            playerDetails.sixes = $(player("td.ds-w-0.ds-whitespace-nowrap.ds-min-w-max.ds-text-right")[4]).text();
            playerDetails.strikeRate = $(player("td.ds-w-0.ds-whitespace-nowrap.ds-min-w-max.ds-text-right")[5]).text();
            playerDetails.location = location;
            playerDetails.result = result;
            playerDetails.date = date;
            const playerSheetPath = `iplFolder/${teamName}/${playerDetails.name}.xlsx`;

            try {
                await fs.access(playerSheetPath);
                await updatePlayerSheet(playerSheetPath, playerDetails);
                console.log(`Updated sheet for ${playerDetails.name}`);
            } catch (error) {
                const teamFolder = `iplFolder/${teamName}`
                const playerSheetPath = path.join(teamFolder, `${playerDetails.name}.xlsx`);
                await createPlayerSheet(playerSheetPath, playerDetails);
                console.log(`Created sheet for ${playerDetails.name}`);
                
            }
            if (!(playerDetails.name in allData[teamName])) {
                
                allData[teamName][playerDetails.name] = [playerDetails];
            } else {
                
                allData[teamName][playerDetails.name].push(playerDetails);
            }
        }

    }
    

}


async function updatePlayerSheet(playerSheetPath, playerDetails) {
    const workbook = new ExcelJS.Workbook();

    
    await workbook.xlsx.readFile(playerSheetPath);

    
    const worksheet = workbook.getWorksheet(1);

    
    const newRow = worksheet.addRow([
        playerDetails.name,
        playerDetails.run,
        playerDetails.balls,
        playerDetails.fours,
        playerDetails.sixes,
        playerDetails.strikeRate,
        playerDetails.location,
        playerDetails.result,
        playerDetails.date
    ]);

    
    await workbook.xlsx.writeFile(playerSheetPath);
}

async function createPlayerSheet(playerSheetPath, playerDetails) {
    const teamFolder = path.dirname(playerSheetPath);
    await fs.mkdir(teamFolder, { recursive: true });
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('PlayerData');
    
   
    worksheet.addRow([
        'Name', 'Run', 'Balls', 'Fours', 'Sixes', 'Strike Rate', 'Location', 'Result', 'Date'
    ]);

   
    worksheet.addRow([
        playerDetails.name,
        playerDetails.run,
        playerDetails.balls,
        playerDetails.fours,
        playerDetails.sixes,
        playerDetails.strikeRate,
        playerDetails.location,
        playerDetails.result,
        playerDetails.date
    ]);

    // Save the new workbook
    await workbook.xlsx.writeFile(playerSheetPath);
}

//create folder 

const createFolder = async (folderPath) => {
    try {
        await fs.mkdir(folderPath, { recursive: true });
        console.log(`Folder created: ${folderPath}`);
    } catch (err) {
        console.error(`Error creating folder ${folderPath}:`, err);
    }
};

const main = async () => {
    await createFolder("iplFolder");
    await getAllMatchesPage(baseUrl);
    const jsonString = JSON.stringify(allData, null, 2);

    try {
        await fs.writeFile('output.json', jsonString, 'utf8');
        console.log('JSON data written to output.json');
    } catch (err) {
        console.error('Error writing to file:', err);
    }
}

main();
