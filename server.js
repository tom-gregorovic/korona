const express = require("express");
const fetch = require('node-fetch');

const fs = require('fs');
const util = require('util');

const app = express();

var lastData = null; // array of Covid data per state
var lastDataDate = null;

const parse = (a, i) => {
  if (!a || !a.length || a.length <= i || !a[i]) {
    return 0;
  }

  return parseInt(a[i]);
}
const nowDate = (days = 0) => {
  const now = new Date(new Date() - days * 24 * 60 * 60 * 1000);
  return now.getFullYear().toString() + "-" + ("0" + (now.getMonth() + 1).toString()).slice(-2) + "-" + ("0" + now.getDate().toString()).slice(-2);
};
const swapDate = d => d ? d.toString().slice(3, 5) + '/' + d.toString().slice(0, 2) + '/' + d.toString().slice(6, 10) : d;
const fixDate = d => d ? d.toString().slice(4, 6) + '/' + d.toString().slice(6, 8) + '/' + d.toString().slice(0, 4) : d;

const csv = res => 
  res.text().then(text => text.split("\n").slice(1).map(l => l.trim().split(";").map(v => v.trim())));

const group = (xs, key, sum) => 
  Object.values(xs.reduce((rv, x) => {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {})).map(i => [i[0][0], i.reduce((s, v) => s + parse(v, sum), 0)]);

const narrativa = (country) => { return { 
  url: () => `https://api.covid19tracking.narrativa.com/api/country/${country}?date_from=${nowDate(20)}&date_to=${nowDate()}`,
  data: r => r.json().then(d => { return Object.values(d.dates).slice(0, -1); }), date: d => new Date(d.info.date.replace("CET", "")), cases: d => d.countries[country].today_new_open_cases
}; };

const dataSources = [
  { country: "Česká republika", continent: "Evropa", population: 10690000,
  url: () => "https://onemocneni-aktualne.mzcr.cz/api/v2/covid-19/nakaza.json",
  data: r => r.json().then(d => d.data), date: d => new Date(d.datum), cases: d => d.prirustkovy_pocet_nakazenych},
  { country: "USA", continent: "Amerika", population: 328200000,
  url: () => "https://api.covidtracking.com/v1/us/daily.json",
  data: r => r.json().then(d => d), date: d => new Date(fixDate(d.date)), cases: d => d.positiveIncrease},
  { country: "Německo", continent: "Evropa", population: 83020000,
  url: () => 'https://services7.arcgis.com/mOBPykOjAyBO2ZKk/arcgis/rest/services/RKI_COVID19/FeatureServer/0/query?f=json&where=Geschlecht<>%27unbekannt%27%20AND%20Altersgruppe<>%27unbekannt%27&returnGeometry=false&spatialRel=esriSpatialRelIntersects&outFields=*&groupByFieldsForStatistics=Meldedatum&orderByFields=Meldedatum%20desc&outStatistics=%5B%7B"statisticType"%3A"sum"%2C"onStatisticField"%3A"AnzahlFall"%2C"outStatisticFieldName"%3A"cases"%7D%5D&cacheHint=true',
  data: r => r.json().then(d => d.features), date: d => new Date(d.attributes.Meldedatum), cases: d => d.attributes.cases},
  { country: "Slovensko", continent: "Evropa", population: 5458000,
  url: () => "https://mapa.covid.chat/export/csv",
  data: r => csv(r), date: d => new Date(swapDate(d[0])), cases: d => parse(d, 5)},
  { country: "Rakousko", continent: "Evropa", population: 8859000,
  url: () => "https://covid19-dashboard.ages.at/data/CovidFaelle_Timeline.csv",
  data: r => csv(r).then(a => group(a, 0, 4)), date: d => new Date(swapDate(d[0])), cases: d => parse(d, 1)},
  { country: "Rusko", continent: "Evropa", population: 146100000, ...narrativa("Russia") },
  { country: "Polsko", continent: "Evropa", population: 37970000, ...narrativa("Poland") },
  { country: "Maďarsko", continent: "Evropa", population: 9770000, ...narrativa("Hungary") },
  { country: "Švédsko", continent: "Evropa", population: 10230000, ...narrativa("Sweden") },
];

const getData = () => new Promise((resolve, reject) => {
  if (lastData && lastDataDate && ((new Date() - lastDataDate) / (60 * 60 * 1000) < 0.25)) { 
    return resolve(lastData);
  }

  const dataPromises = dataSources.map(info => { console.log(info.url()); return fetch(info.url()).then(r => info.data(r))
    .then(d => { console.log(info.url(), d.length); return Promise.resolve(d.map(i => { return { info, date: info.date(i), cases: info.cases(i) }; }));})
    .catch(e => { return { info, error: e.toString() }; } ); });

  return Promise.all(dataPromises).then(countries => {
    lastData = countries.filter(c => c.length > 0).map(
      countryData => {
        countryData.sort((a, b) => b.date - a.date);
        var countryDataToday = countryData[0];

        const date = countryDataToday.date;
        const dataDay = Math.floor((new Date() - new Date(date)) / (24 * 60 *60 * 1000));

        var day = 0;
        while (!countryDataToday.cases && day < countryData.length - 1) {
          day++;
          countryDataToday = countryData[day];
        }

        const countryDataWeekAgo = day + 7 < countryData.length ? countryData[day + 7] : [];

        const population = countryDataToday.info.population;

        const cases = countryDataToday.cases;

        const casesRel = cases && population ? Math.round(cases / (population / 100000) * 100) / 100 : null;

        const casesRWA = cases && countryDataWeekAgo.cases ? 
          Math.round(cases / countryDataWeekAgo.cases * 100) : null;

        const cases7D = countryData.slice(day, day + 7).reduce((res, v) => res + v.cases, 0);
        const cases7_14D = countryData.slice(day + 5, day + 12).reduce((res, v) => res + v.cases, 0);

        const cases7DA = Math.round(cases7D / 7 * 100) / 100;
        const rSimple = cases7_14D > 0 ? Math.round(cases7D / cases7_14D * 100) / 100 : null;

        return { country: countryData[0].info.country, day: day + dataDay, continent: countryData[0].info.continent, cases, casesRel, casesRWA, cases7DA, rSimple,
        error: countryData[0].error };
      }
    );
    lastDataDate = new Date();

    return resolve(lastData);
  }).catch(e => console.error(e));
});

const dataUrl = 'https://opendata.ecdc.europa.eu/covid19/casedistribution/csv/data.csv';

const getDataECDC = () => new Promise((resolve, reject) => {
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