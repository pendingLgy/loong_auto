import {
  type Accessor,
  createContext,
  createMemo,
  type ParentProps,
  Show,
  useContext,
} from "solid-js";

export function createSimpleContext<T,Props extends Record<string, any> = Record<string, any>, >(
  input: {
    name: string;
    init: (props: ParentProps<Props>) => T;
    gate?: boolean;
  }
) {
  const Ctx = createContext<T>();

  return {
    context: Ctx,
    provider: (props: ParentProps<Props>) => {
      const value = input.init(props);
      const shouldGate = input.gate ?? true;

      if (!shouldGate) {
        return <Ctx value={value}>{props.children}</Ctx>;
      }

      const isReady = createMemo(() => {
        const ready = (value as { ready?: Accessor<boolean> | boolean }).ready;
        if (ready === undefined) return true;
        return typeof ready === "function" ? Boolean(ready()) : Boolean(ready);
      });

      return (
        <Show when={isReady()}>
          <Ctx value={value}>{props.children}</Ctx>
        </Show>
      );
    },
    use() {
      const contextValue = useContext(Ctx);
      if (!contextValue) {
        throw new Error(`${input.name} context must be used within a context provider`);
      }
      return contextValue;
    },
  };
}
