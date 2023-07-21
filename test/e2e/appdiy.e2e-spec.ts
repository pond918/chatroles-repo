/**
 * to go through a whole app development from requirement to final deployment.
 */
import { afterEachFn, beforeEachFn } from './app-init.e2e';
import { generateBDDCases } from './bdd-role.e2e-spec';
import { afterAllSSE, beforeAllSSE } from './sse-init.e2e';
import { updateSystemUser } from './users.e2e-spec';

const baRoleId = 'biz-requirement-analyst';
const baHostId = baRoleId + '-host';

describe('AppDIY whole case (e2e)', () => {
  beforeAll(beforeAllSSE);
  afterAll(afterAllSSE);
  beforeEach(beforeEachFn);
  afterEach(afterEachFn);

  it(`appdiy whole case.`, async () => {
    // update system-user to use real platform llm resource
    const user = (await updateSystemUser()).json; // platform llm resource reload
    console.log(user);

    // create a BA, then give a requirement. generate PRD result, and continue break.
    await generateBDDCases();
  });
});
