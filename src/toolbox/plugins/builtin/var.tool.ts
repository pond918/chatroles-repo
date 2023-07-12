import jexl from '@digifi/jexl';
import { ChatDto } from '../../../actors/chats/dto/chat-dto';
import { SimpleChatPrompt } from '../../../actors/prompts/prompts.service';
import { toJSON } from '../../../utils';
import { AbsToolPlugin } from '../abstract-tool';
import { templiteAsync } from '../../../infras/libs/templite';

/**
 * variables tool, to store value into task context.
 */
export class VariableTool extends AbsToolPlugin {
  /**
   * prompt expression is evaluated as value to set.
   *
   * - var:[setVarPathName][#move]: setVarPathName may empty.
   * - #move, means try to delete the source property. only applicable for path expression. NOTE: parent scope may changed
   */
  protocol() {
    return 'var';
  }

  /** match variable expression, instead of constant expression */
  protected VAR_EXP_REGEX =
    /^(?:<[<|?])?([$_a-z][$\w]*(\.[ $_a-z][$\w]*)*)(?:[?|>]>)?$/i;

  protected async interpolatePrompt() {
    // do nothing
  }

  async _invoke(
    chatDto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
  ) {
    if (!chatPrompt.promptString)
      return ChatDto.error(chatDto, 400, 'prompt must not empty.,', chatPrompt);

    let value: any;
    const { path, move } = this.parseTo(chatPrompt.to);
    if (path || move) {
      value = await this._cmdMove(move, chatDto, chatPrompt, ctx);
      if (chatDto.statusCode) return chatDto;
    }

    const { rootObj, varName } = await this._evalRoot(path, ctx);
    varName && (rootObj[varName] = value);

    return chatDto;
  }
  protected async _cmdMove(
    move: string,
    chatDto: ChatDto,
    chatPrompt: SimpleChatPrompt,
    ctx: Record<string, any>,
  ) {
    const varExp = this.VAR_EXP_REGEX.exec(chatPrompt.promptString);
    if (move) {
      if (move !== 'move') {
        ChatDto.error(
          chatDto,
          400,
          `invalid var command: #${move}, only '#move' is allowed.`,
          chatPrompt,
        );
        return null;
      }
      if (
        chatPrompt.isJson ||
        !varExp || // error if constant expression
        !/^[$_a-z][$\w]*(\.[ $_a-z][$\w]*)*$/i.test(varExp[1]?.trim()) // error if not path expression
      ) {
        ChatDto.error(
          chatDto,
          400,
          `can not #move: ${chatPrompt.promptString}, only path name string is allowed.`,
          chatPrompt,
        );
        return null;
      }
    }
    // eval and move
    const val = chatPrompt.isJson
      ? toJSON(chatPrompt.promptString)
      : await templiteAsync(chatPrompt.promptString, ctx);

    if (move) {
      const { rootObj, varName } = await this._evalRoot(varExp[1], ctx);
      if (varName == varExp[1]) {
        // change storage root
        val && (rootObj[varName] = undefined);
      } else delete rootObj[varName];
    }

    return val;
  }

  protected async _evalRoot(pathVar: string, obj: object) {
    const idx = pathVar.lastIndexOf('.');
    const varName = pathVar.substring(idx + 1);
    const rootObj =
      idx > 0 ? await jexl.eval(pathVar.substring(0, idx), obj) : obj;
    return { rootObj, varName };
  }

  protected parseTo(path: string) {
    let move: string;

    path = path.substring(4); // var:
    const idx = path.indexOf('#');
    if (idx >= 0) {
      move = path.substring(idx + 1);
      path = path.substring(0, idx);
    }

    return { path, move };
  }
}
