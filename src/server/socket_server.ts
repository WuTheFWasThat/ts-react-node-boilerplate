import * as http from 'http';

import * as WebSocket from 'ws';

import logger from '../shared/utils/logger';

type SocketServerOptions = {
  db?: string,
  dbfolder?: string,
  password?: string,
  path?: string,
};

interface DataBackend {
  get(_key: string): string;
  set(_key: string, _val: string): void;
}

class InMemory implements DataBackend {
  private db: {[key: string]: string};
  constructor() {
    this.db = {};
  }
  public get(key: string): string {
    return this.db[key];
  }
  public set(key: string, val: string): void {
    this.db[key] = val;
  }
}

export default async function makeSocketServer(server: http.Server, options: SocketServerOptions) {
  const wss = new WebSocket.Server({ server, path: options.path });

  const dbs: {[docname: string]: DataBackend} = {};
  const clients: {[docname: string]: string} = {};

  async function getBackend(docname: string): Promise<DataBackend> {
    if (docname in dbs) {
      return dbs[docname];
    }
    let db: DataBackend;
    if (options.db === 'sqlite') {
      throw new Error('unimplemented');
    } else {
      logger.info('Using in-memory database');
      db = new InMemory();
    }
    dbs[docname] = db;
    return db;
  }

  function broadcast(message: Object): void {
    wss.clients.forEach(client => {
      client.send(JSON.stringify(message));
    });
  }

  wss.on('connection', function connection(ws) {
    logger.info('New socket connection!');
    let authed = false;
    let docname: string | null = null;
    ws.on('message', async (msg_string) => {
      logger.debug('received message: %s', msg_string);
      const msg = JSON.parse(msg_string);

      function respond(result: { value?: any, error: string | null }) {
        ws.send(JSON.stringify({
          type: 'callback',
          id: msg.id,
          result: result,
        }));
      }

      if (msg.type === 'join') {
        if (options.password) {
          if (msg.password !== options.password) {
            return respond({ error: 'Wrong password!' });
          }
        }
        authed = true;
        docname = msg.docname;
        clients[msg.docname] = msg.clientId;
        // TODO: only broadcast to client on this document?
        broadcast({
          type: 'joined',
          clientId: msg.clientId,
          docname: msg.docname,
        });
        return respond({ error: null });
      }

      if (!authed) {
        return respond({ error: 'Not authenticated!' });
      }
      if (docname == null) {
        throw new Error('No docname!');
      }
      if (msg.clientId !== clients[docname]) {
        return respond({ error: 'Other client connected!' });
      }
      const db = await getBackend(docname);

      if (msg.type === 'get') {
        const value = await db.get(msg.key);
        logger.debug('got', msg.key, value);
        respond({ value: value, error: null });
      } else if (msg.type === 'set') {
        await db.set(msg.key, msg.value);
        logger.debug('set', msg.key, msg.value);
        respond({ error: null });
      }
    });

    ws.on('close', () => {
      logger.info('Socket connection closed!');
      // TODO: clean up stuff?
    });
  });
  return server;
}
