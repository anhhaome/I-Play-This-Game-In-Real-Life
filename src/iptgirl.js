#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { Low, JSONFile } from 'lowdb';
import { table } from 'table';
import { join } from 'path';
import progressbar from 'string-progressbar';
import moment from 'moment';

const __dirname = process.cwd();

// db init
const file = join(__dirname, 'db.json');
const adapter = new JSONFile(file);
const db = new Low(adapter);

// read or set default data
await db.read();
db.data ||= {
  types: [
    { name: 'hp', detail: 'The Health Point of life. Base on current health.', default: 0, max: 100 },
    { name: 'mp', detail: 'Also called Mana Point, is a state of body and mind which can make actions.', default: 0, max: 100 }
  ],
  actions: []
};
await db.write();

// reducers
const sumReducer = (record, data) => {
  for (const key in record) {
    if (key in data) record[key] += data[key];
  }

  return record;
};

const setReducer = (record, data) => {
  for (const key in record) {
    if (key in data) record[key] = data[key];
  }

  return record;
};

const reducers = {
  sumReducer,
  setReducer
};

// formatter
const hpFormatter = (value, schema) => {
  if (!schema.max) { return value; }

  return progressbar.filledBar(schema.max, value, [20]) + `/${schema.max}`;
};

const formatters = {
  hpFormatter,
  mpFormatter: hpFormatter
};

const reduceActionList = actions => {
  const record = db.data.types.reduce((record, current) => {
    record[current.name] = current.default;
    return record;
  }, {});

  return actions.reduce((summary, current) => {
    const newValue = reducers[`${current.type}Reducer`](summary, current.data);
    return newValue || summary;
  }, record);
};

// command setup
const commander = yargs(hideBin(process.argv));

commander.command('status [date]', 'Print the stats of your character. Default is today.',
  (yargs) => {
    return yargs
      .positional('date', {
        describe: 'Status until specific date',
        default: moment().format('YYYY-MM-DD')
      });
  },
  (argv) => {
    const finalRecord = reduceActionList(db.data.actions.filter(item => moment(item.time).format('YYYY-MM-DD') <= argv.date));

    const data = [
      ['Name', 'Value', 'Detail']
    ];

    for (const key in finalRecord) {
      const typeItem = db.data.types.filter((i) => i.name === key)[0];
      data.push([
        key,
        formatters[`${key}Formatter`] ? formatters[`${key}Formatter`](finalRecord[key], typeItem) : finalRecord[key],
        typeItem.detail
      ]);
    }

    console.log(table(data));
  });

// run
commander
  .demandCommand()
  .parse();

export default commander;
