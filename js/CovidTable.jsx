import React, { useEffect, useMemo, useState } from 'react';
import { useTable, useSortBy } from 'react-table';
import { fetch } from 'whatwg-fetch';

const favourite = ['Česká republika', 'Slovensko', 'Rakousko', 'Německo', 'Polsko', 'Maďarsko', 
'Španělsko', 'Itálie', 'Velká Britanie', 'Francie',
'Švédsko', 'Rusko', 'USA'];

const names = [];

const CovidTable = (props) => {
  const [loading, setLoading] = useState();
  const [error, setError] = useState();
  const [data, setData] = useState();
  const [europe, setEurope] = useState();
  const [world, setWorld] = useState();

  const fetchData = () => {
    setError('');
    setLoading(true);

    fetch("/api/data").then(resp => resp.json()).then(json => {
      setLoading(false);

      json.forEach(r => {
        const index = favourite.indexOf(r.country);
        r.name = r.country.replaceAll("_", " ");

        if (r.day) {
        r.name = <>{r.name}<sup>{'-' + r.day}</sup></>;
        }

        r.casesRel = r.casesRel ? r.casesRel.toFixed(2) : null;
        r.cases7DA = r.cases7DA ? r.cases7DA.toFixed(2) : null;
        r.rSimple = r.rSimple ? r.rSimple.toFixed(2) : null;
      });

      setData(json);

    }).catch(err => {
      console.error(err);
      setLoading(false);
      setError(true);
    });
  };

  useEffect(() => { fetchData(); }, []);

  const Table = ({ columns, data }) => {
    const {
      getTableProps,
      getTableBodyProps,
      headerGroups,
      rows,
      prepareRow,
    } = useTable(
      {
        columns,
        data,
      },
      useSortBy
    )
  
    return (
        <table {...getTableProps()}>
          <thead>
            {headerGroups.map(headerGroup => (
              <tr {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map(column => (
                  // Add the sorting props to control sorting. For this example
                  // we can add them into the header props
                  <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                    {column.render('Header')}
                    {/* Add a sort direction indicator */}
                    <span>
                      {column.isSorted
                        ? column.isSortedDesc
                          ? ' ▼'
                          : ' ▲'
                        : ''}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()}>
            {rows.map(
              (row, i) => {
                prepareRow(row);
                return (
                  <tr {...row.getRowProps()}>
                    {row.cells.map((cell, i) => {
                      return (
                        <td {...cell.getCellProps()} className={i > 0 ? "cell-number" : null}>{cell.render('Cell')}</td>
                      )
                    })}
                  </tr>
                )}
            )}
          </tbody>
        </table>
    )
  }

  const columns = useMemo(() => [
    {
      Header: 'Stát',
      accessor: 'name',
    },
    {
      Header: 'Nové případy COVID-19',
      columns: [
        {
          Header: 'Počet',
          accessor: 'cases',
        },
        {
          Header: 'na 100k obyvatel',
          accessor: 'casesRel',
        },
        {
          Header: '% před týdnem',
          accessor: 'casesRWA',
        },
        {
          Header: '7-denní průměr',
          accessor: 'cases7DA',
        },
      ],
    },
    {
      Header: 'Jednoduché R',
      accessor: 'rSimple',
    },
  ]);

  const tableData = data || [];
  const Info = () => 
  <>
    {!!loading && !error && <p>data se načítají...</p>}
    {!!error && <p>Nastala chyba!</p>}
  </>;

  return (
    <div id="CovidTable">
      <Table columns={columns} data={tableData.filter(r => favourite.indexOf(r.country) >= 0)} />
      <Info/>
      <h3><a href="#" onClick={() => setEurope(!europe)}>Evropa</a></h3>
      {!!europe && <><Table columns={columns} data={tableData.filter(r => r.continent == "Evropa")} />
      <Info/></>}
      <h3><a href="#" onClick={() => setWorld(!world)}>Celý svět</a></h3>
      {!!world && <><Table columns={columns} data={tableData} />
      <Info/></>}
      <br/><small>Data © ECDC [2005-2019]</small>
    </div>
  );
}

export default CovidTable;