import { Pool } from 'pg';
import config from './config';

const pool = new Pool({
  connectionString: config.databaseUrl
});

export default pool;
