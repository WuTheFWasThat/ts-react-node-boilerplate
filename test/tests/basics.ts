/* globals describe, it */
import 'mocha';
import * as _ from 'lodash';

import logger from '../../src/shared/utils/logger';

function expect(val: boolean, message: string) {
  if (!val) {
    throw new Error(message);
  }
}


function expectDeepEqual<T>(actual: T, expected: T, message: string) {
  if (!_.isEqual(actual, expected)) {
    logger.flush();
    console.error(`
      \nExpected:
      \n${JSON.stringify(expected, null, 2)}
      \nBut got:
      \n${JSON.stringify(actual, null, 2)}
    `
    );
    throw new Error(message);
  }
}

function expectEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    logger.flush();
    console.error(`
      \nExpected:
      \n${expected}
      \nBut got:
      \n${actual}
    `
    );
    throw new Error(message);
  }
}

describe('random set of basic tests', function() {
  it('expect expectations', async function() {
    expect(true, "Was not true");
    expectDeepEqual({a: 2, b: {c: 3}}, {b: {c: 3}, a: 2}, "Was not deep equal");
    expectEqual("asdf", "asdf", "Was not equal");
    expect(false, "Was false!");
  });
});
