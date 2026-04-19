import { Connection, ConnectionConfig, Request, TYPES } from 'tedious';

// ─── Config ───────────────────────────────────────────────────────────────────

const config: ConnectionConfig = {
  server: 'AWASE1PENSQL01',
  authentication: {
    type: 'default',
    options: {
      userName: 'eDashboard_MESystem',
      password: 'mesystem',
    },
  },
  options: {
    database: 'eDashboard_PEN',
    encrypt: false,
    trustServerCertificate: true,
    rowCollectionOnRequestCompletion: true,
  },
};

// ─── Helper: run a stored procedure, return rows as plain objects ─────────────

export function execProc(
  procName: string,
  params: { name: string; type: any; value: any }[]
): Promise<Record<string, any>[]> {
  return new Promise((resolve, reject) => {
    const conn = new Connection(config);

    conn.on('error', err => reject(err));

    conn.connect(err => {
      if (err) return reject(err);

      const req = new Request(procName, (err, _rowCount, rowsRaw) => {
        conn.close();
        if (err) return reject(err);

        const rows: Record<string, any>[] = [];
        for (const row of rowsRaw ?? []) {
          const obj: Record<string, any> = {};
          for (const col of row) {
            obj[col.metadata.colName] = col.value;
          }
          rows.push(obj);
        }
        resolve(rows);
      });

      for (const p of params) {
        req.addParameter(p.name, p.type, p.value);
      }

      conn.callProcedure(req);
    });
  });
}

export { TYPES };
