import * as $ from 'jquery';
import * as React from 'react'; // tslint:disable-line no-unused-variable
import * as ReactDOM from 'react-dom';

import 'font-awesome/css/font-awesome.css';
import '../css/utils.sass';
import '../css/index.sass';

/*
import * as browser_utils from './utils/browser';
import * as errors from '../../shared/utils/errors';
import * as fn_utils from './utils/functional';
 */
import logger from '../../shared/utils/logger';

import AppComponent from './components/app';

declare const window: any; // because we attach globals for debugging

const appEl = $('#app')[0];

export class SocketClient {
  private callback_table: {[id: string]: (result: any) => void} = {};

  // init is like async constructor
  private ws!: WebSocket;
  private clientId: string;

  constructor() {
    this.clientId = Date.now() + '-' + ('' + Math.random()).slice(2);
  }

  public async init(host: string = '', password: string = '') {
    logger.info('Trying to connect', host);
    this.ws = new WebSocket(`${host}/socket`);
    this.ws.onerror = (err) => {
      throw new Error(`Socket connection error: ${err}`);
    };
    this.ws.onclose = () => {
      throw new Error('Socket connection closed!');
    };

    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      setTimeout(() => {
        reject('Timed out trying to connect!');
      }, 5000);
    });
    logger.info('Connected', host);

    this.ws.onmessage = (event) => {
      // tslint:disable-next-line no-console
      const message = JSON.parse(event.data);
      if (message.type === 'callback') {
        const id: string = message.id;
        if (!(id in this.callback_table)) {
          throw new Error(`ID ${id} not found in callback table`);
        }
        const callback = this.callback_table[id];
        delete this.callback_table[id];
        callback(message.result);
      } else if (message.type === 'echo') {
        console.log('blah');
      } else {
        console.log('Unhandled message', JSON.stringify(message, null, 2));
      }
    };

    await this.sendMessage({
      type: 'join',
      password: password,
    });
  }

  private async sendMessage(message: Object): Promise<string | null> {
    return new Promise((resolve: (result: string | null) => void, reject) => {
      const id = Date.now() + '-' + ('' + Math.random()).slice(2);
      if (id in this.callback_table) { throw new Error('Duplicate IDs!?'); }
      this.callback_table[id] = (result) => {
        if (result.error) {
          reject(result.error);
        } else {
          resolve(result.value);
        }
      };
      this.ws.send(JSON.stringify({
        ...message,
        id: id,
        clientId: this.clientId
      }));
    });
  }

  public async get(key: string): Promise<string | null> {
    logger.debug('Socket client: getting', key);
    return await this.sendMessage({
      type: 'get',
      key: key,
    });
  }

  public set(key: string, value: string): Promise<void> {
    logger.debug('Socket client: setting', key, 'to', value);

    this.sendMessage({
      type: 'set',
      key: key,
      value: value,
    });
    return Promise.resolve();
  }
}

ReactDOM.render(
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  }}>
    <div style={{ flexGrow: 3 }}/>
    <div style={{
      textAlign: 'center',
      alignSelf: 'center',
      color: '#999',
    }}>
      <i className='fa fa-5x fa-spin fa-spinner'/>
      <p>Loading... this can take a minute the first time</p>
    </div>
    <div style={{ flexGrow: 8 }}/>
  </div>,
  appEl
);

$(document).ready(async () => {
  // const $mainDiv = $('#view');

  async function renderMain() {
    await new Promise((resolve) => {
      ReactDOM.render(
        <AppComponent/>,
        appEl,
        resolve
      );
    });
  }
  window.renderMain = renderMain;

  await renderMain();

  const client = new SocketClient();
  await client.init('ws://localhost:3000');
});
