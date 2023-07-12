import axios from 'axios';
import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import { SimpleChatPrompt } from '../../../actors/prompts/prompts.service';
import { overrideStorageObject } from '../../../actors/prompts/scoped-storage-object';
import { toJSON } from '../../../utils';
import { AbsToolPlugin } from '../abstract-tool';

export class RestAPITool extends AbsToolPlugin {
  constructor() {
    super();
  }
  protocol() {
    return 'restAPI';
  }

  async _invoke(
    chatDto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
  ) {
    try {
      // url
      const { method, url, config } = await this.parseTo(chatPrompt.to, ctx);

      let data = chatPrompt.promptString;
      if (data && chatPrompt.isJson) data = toJSON(chatPrompt.promptString);
      await axios
        .request({
          url,
          method,
          data,
          ...config,
        })
        .then((resp) => {
          // {"data":[[{"nick":"new-test-role","goal":"for test","id":"LE25GuKiw8rO-Mi5iiolf"},{"nick":"new-test-role","goal":"for test","id":"zolJP_D9hNk_v1KyxcG2F"},{"id":"Jill2","nick":"12321erer"}]],"is_generating":false,"duration":4.18145751953125,"average_duration":3.4376360416412353}
          chatDto.data = resp.data?.data?.length ? resp.data.data[0] : [];
        })
        .catch((error) => {
          let code = 500,
            msg = error.message;
          if (error.response) {
            code = error.response.status;
            error.response.data && (msg = error.response.data);
          } else if (error.request) {
            code = 400;
            msg = url;
          }
          ChatDto.error(chatDto, code, url + '\n' + msg, chatPrompt);
        });
    } catch (err) {
      ChatDto.error(chatDto, 500, err.message, chatPrompt);
    }

    return chatDto;
  }

  /** configs are json start from second line */
  async parseTo(to: string, ctx: Record<string, any>) {
    let method = 'GET',
      url: string;
    let config = {};

    // parse config
    let idx = to.indexOf('\n');
    if (idx > 0) {
      let config_str = to.substring(idx);
      // interpolate with env, only in configs
      const ctx1 = await overrideStorageObject({ env: process.env }, ctx);
      config_str = await super.interpolate(config_str, ctx1);
      config = toJSON(config_str);

      to = to.substring(0, idx);
    }

    url = await super.interpolate(url, ctx);
    idx = to.indexOf(' ');
    if (idx > 0) {
      method = to.substring(8, idx);
    } else idx = 7;
    url = to.substring(idx + 1);

    return { method, url, config };
  }
}
