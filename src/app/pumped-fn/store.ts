import { atom, createScope } from "@pumped-fn/lite";

export type Todo = {
  id: string;
  text: string;
  done: boolean;
};

export const counterAtom = atom<number>({
  factory: () => 0,
});

export const todosAtom = atom<Todo[]>({
  factory: () => [
    { id: "1", text: "Try @pumped-fn/lite-react", done: true },
    { id: "2", text: "Wire up a Next.js page", done: false },
  ],
});

export const scope = createScope();

export const ready = Promise.all([
  scope.resolve(counterAtom),
  scope.resolve(todosAtom),
]);
