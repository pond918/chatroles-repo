// import * as request from 'supertest';
import EventSource from 'eventsource';
import * as pactum from 'pactum';
import { EventTopic } from '../../src/sses/event-topics.enum';
import { TestConstant } from '../test-constants';
import {
  afterAllFn,
  afterEachFn,
  beforeAllFn,
  beforeEachFn,
} from './app-init.e2e';

export const mockClientLocalLLM = async (url: string) => {
  let evtSource: any;
  if (!process.env.PORT) {
    console.log('subscribes to sse events.');
    evtSource = new EventSource(`${url}/api/events/subscribe`, {
      withCredentials: true,
      https: { rejectUnauthorized: false },
      headers: {
        heartbeatTimeout: 150000,
        Authorization: `Bearer ${TestConstant.authToken}`,
      },
    });

    evtSource.addEventListener(EventTopic.llm, async (event) => {
      const { payload } = JSON.parse(event.data);
      // handle event, then respond to server:
      // payload.statusCode = 0; // success
      const testResp = payload.options?.testResponses?.shift();
      console.log(
        `=====> [llm-req]\n${payload.text}\n=====> [llm-resp]\n${testResp}`,
      );
      testResp && (payload.text = testResp);
      await pactum
        .spec()
        .withJson(payload)
        .withBearerToken(TestConstant.authToken)
        .post(`${url}/api/events/respond/${event.lastEventId}`);
    });
    evtSource.onerror = function (event: { eventPhase: number }) {
      console.error(event);
      if (event.eventPhase == EventSource.CLOSED) {
        evtSource.close();
        console.log('Event Source Closed');
      }
    };
    evtSource.addEventListener('close', () => evtSource.close());
  } else console.log('NO SSE TEST subscription.');

  return evtSource;
};

let url: string;
let eventSource: EventSource;

export const beforeAllSSE = async () => {
  url = await beforeAllFn();
  await beforeEachFn();
  try {
    eventSource || (eventSource = await mockClientLocalLLM(url));
    await pactum.sleep(2000);
  } finally {
    await afterEachFn();
  }
};

export const afterAllSSE = async () => {
  try {
    afterAllFn();
  } finally {
    await pactum.sleep(300);
    eventSource?.close();
    eventSource = null;
  }
};
