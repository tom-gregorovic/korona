const express = require("express");
const fetch = require('node-fetch');

const fs = require('fs');
const util = require('util');

const app = express();

var lastData = null; // array of Covid data per state
var lastDataDate = null;

const dataUrl = 'https://opendata.ecdc.europa.eu/covid19/casedistribution/csv/data.csv';

const getData = () => new Promise((resolve, reject) => {
  if (lastData && lastDataDate && ((new Date() - lastDataDate) / (60 * 60 * 1000) < 2)) { 
    return resolve(lastData);
  }

  return fetch(dataUrl).then(resp => resp.buffer()).then(buffer => {
    const rawData = new String(buffer).split("\n").map(l => l.trim().split(',')).slice(1);
    /*
    ['dateRep', 'day', 'month', 'year', 'cases', 'deaths', 'countriesAndTerritories',
      'geoId', 'countryterritoryCode', 'popData2019', 'continentExp', 'Cumulative_number_for_14_days_of_COVID-19_cases_per_100000'
    ],
      */
    
    const countries = rawData.map(r => r[6]).filter((c, i, a) => (a.indexOf(c) == i) && c);

    lastData = countries.map(
      country => {
        const countryData = rawData.filter(r => r[6] == country);
        var countryDataToday = countryData[0];

        const date = countryDataToday[0].slice(6, 10) + '/' + countryDataToday[0].slice(3, 5) + '/' + countryDataToday[0].slice(0, 2);
        const dataDay = Math.floor(new Date() / (24 * 60 *60 * 1000)) - Math.floor(new Date(date) / (24 * 60 *60 * 1000))

        var day = 0;
        while ((!countryDataToday[4] || !parseInt(countryDataToday[4])) && day < countryData.length - 1) {
          day++;
          countryDataToday = countryData[day];
        }

        const countryDataWeekAgo = day + 7 < countryData.length ? countryData[day + 7] : [];

        const population = countryDataToday.length && countryDataToday[9] ? parseInt(countryDataToday[9]) / 100000 : null;

        const cases = countryDataToday.length && countryDataToday[4] ? parseInt(countryDataToday[4]) : null;
        const deaths = countryDataToday.length && countryDataToday[5] ? parseInt(countryDataToday[5]) : null;

        const casesRel = cases && population ? Math.round(cases / population * 100) / 100 : null;
        const deathsRel = deaths && population ? Math.round(deaths / population * 100) / 100 : null;

        const casesRWA = cases && countryDataWeekAgo.length && countryDataWeekAgo[4] && parseInt(countryDataWeekAgo[4]) ? 
          Math.round(cases / parseInt(countryDataWeekAgo[4]) * 100) : null;

        const cases7D = countryData.slice(day, day + 7).reduce((res, v) => res + parseInt(v[4]), 0);
        const cases7_14D = countryData.slice(day + 5, day + 12).reduce((res, v) => res + parseInt(v[4]), 0);

        const cases7DA = Math.round(cases7D / 7 * 100) / 100;
        const rSimple = cases7_14D > 0 ? Math.round(cases7D / cases7_14D * 100) / 100 : null;

        return { country, day: day + dataDay, continent: countryData[0][10], cases, deaths, casesRel, deathsRel, casesRWA, cases7DA, rSimple };
      }
    );
    lastDataDate = new Date();

    return resolve(lastData);
  });
});

app.use(express.static('public'));

app.get('/api/data', (req, res) => {
  getData().then(data => { 
    return data ? res.json(data) : res.status(500); }
  ).catch(error => {
    console.error(error);
    res.status(500).send(error.toString());
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`App listening on port ${port}!`));