"use client";

import { Suspense, use, useState } from "react";
import {
  ScopeProvider,
  useAtom,
  useController,
  useSelect,
} from "@pumped-fn/lite-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { counterAtom, ready, scope, todosAtom, type Todo } from "./store";

export default function PumpedFnPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">@pumped-fn/lite-react demo</h1>
        <p className="text-sm text-muted-foreground">
          A counter and a todo list driven by atoms, scope, and Suspense.
        </p>
      </header>

      <Suspense fallback={<div className="text-sm">Resolving scope…</div>}>
        <Boot>
          <Counter />
          <Todos />
        </Boot>
      </Suspense>
    </main>
  );
}

function Boot({ children }: { children: React.ReactNode }) {
  use(ready);
  return <ScopeProvider scope={scope}>{children}</ScopeProvider>;
}

function Counter() {
  const count = useAtom(counterAtom);
  const ctrl = useController(counterAtom);

  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-3 font-medium">Counter</h2>
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => ctrl.update((n) => n - 1)}>
          −
        </Button>
        <div className="min-w-10 text-center text-lg font-mono">{count}</div>
        <Button variant="outline" onClick={() => ctrl.update((n) => n + 1)}>
          +
        </Button>
        <Button variant="ghost" onClick={() => ctrl.set(0)}>
          Reset
        </Button>
      </div>
    </section>
  );
}

function Todos() {
  const todos = useAtom(todosAtom);
  const remaining = useSelect(todosAtom, (list) =>
    list.filter((t) => !t.done).length,
  );
  const ctrl = useController(todosAtom);
  const [text, setText] = useState("");

  function add() {
    const trimmed = text.trim();
    if (!trimmed) return;
    ctrl.update((list) => [
      ...list,
      { id: crypto.randomUUID(), text: trimmed, done: false },
    ]);
    setText("");
  }

  function toggle(id: string) {
    ctrl.update((list) =>
      list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }

  function remove(id: string) {
    ctrl.update((list) => list.filter((t) => t.id !== id));
  }

  return (
    <section className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">Todos</h2>
        <span className="text-xs text-muted-foreground">
          {remaining} remaining
        </span>
      </div>

      <div className="mb-3 flex gap-2">
        <Input
          value={text}
          placeholder="Add a todo…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <Button onClick={add}>Add</Button>
      </div>

      <ul className="divide-y">
        {todos.map((t: Todo) => (
          <li key={t.id} className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              checked={t.done}
              onChange={() => toggle(t.id)}
              className="size-4"
            />
            <span
              className={
                t.done ? "flex-1 text-muted-foreground line-through" : "flex-1"
              }
            >
              {t.text}
            </span>
            <Button variant="ghost" size="sm" onClick={() => remove(t.id)}>
              Delete
            </Button>
          </li>
        ))}
        {todos.length === 0 && (
          <li className="py-4 text-center text-sm text-muted-foreground">
            No todos yet.
          </li>
        )}
      </ul>
    </section>
  );
}
