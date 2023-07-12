export type IPlugin = object;

/**
 * tools are all invocable facilities. ToolPlugin mus be STATELESS.
 */
export abstract class AbsDriverPlugin implements IPlugin {
  /** protocol:driverName */
  pname() {
    return `${this.protocol()}:${this.name()}`;
  }

  /** driver name */
  abstract name(): string;

  /** supported protocol */
  abstract protocol(): string;
}
